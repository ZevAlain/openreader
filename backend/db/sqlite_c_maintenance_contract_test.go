package db

import (
	"bytes"
	"context"
	"database/sql"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"

	"github.com/mattn/go-sqlite3"
	"openreader/backend/config"
)

const sqliteMaintenanceCase = "OPENREADER_TEST_SQLITE_MAINTENANCE_CASE"
const sqliteEntered = "SQLITE_MAINTENANCE_ENTERED\n"
const sqliteCompleted = "SQLITE_MAINTENANCE_COMPLETED\n"

// These are library-level, two-row/empty-table correctness checks, not an API
// exploit or a reproducer for the separate WAL-reset critical timing window.
func TestSQLiteCMaintenanceBoundedBehavior(t *testing.T) {
	for _, name := range []string{"empty-aggregate-not-null", "redundant-upsert-index", "bound-values-simple-upsert", "null-empty-control", "wal-rollback-checkpoint-reopen"} {
		t.Run(name, func(t *testing.T) { runSQLiteMaintenanceWorker(t, name) })
	}
}

type sqliteMaintenanceOutput struct {
	mu       sync.Mutex
	buf      bytes.Buffer
	entered  chan struct{}
	once     sync.Once
	cancel   context.CancelFunc
	tooLarge bool
}

func (o *sqliteMaintenanceOutput) Write(p []byte) (int, error) {
	o.mu.Lock()
	if o.buf.Len()+len(p) > 16<<10 {
		o.tooLarge = true
		o.mu.Unlock()
		o.cancel()
		return len(p), nil
	}
	_, _ = o.buf.Write(p)
	if bytes.Contains(o.buf.Bytes(), []byte(sqliteEntered)) {
		o.once.Do(func() { close(o.entered) })
	}
	o.mu.Unlock()
	return len(p), nil
}

func (o *sqliteMaintenanceOutput) snapshot() (string, bool) {
	o.mu.Lock()
	defer o.mu.Unlock()
	return o.buf.String(), o.tooLarge
}

func runSQLiteMaintenanceWorker(t *testing.T, name string) {
	t.Helper()
	executable, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, executable, "-test.run=^TestSQLiteCMaintenanceOwnedWorker$", "-test.count=1")
	cmd.Env = append(os.Environ(), sqliteMaintenanceCase+"="+name)
	cmd.WaitDelay = 2 * time.Second
	output := &sqliteMaintenanceOutput{entered: make(chan struct{}), cancel: cancel}
	cmd.Stdout, cmd.Stderr = output, output
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(interrupt)
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	done, waited := make(chan error, 1), false
	go func() { done <- cmd.Wait() }()
	defer func() {
		if !waited {
			cancel()
			_ = cmd.Process.Kill()
			select {
			case <-done:
			case <-time.After(3 * time.Second):
				t.Error("owned SQLite worker not reaped")
			}
		}
	}()
	check := func(err error) {
		t.Helper()
		text, tooLarge := output.snapshot()
		if tooLarge {
			t.Fatal("owned SQLite worker exceeded output budget")
		}
		if !strings.Contains(text, sqliteEntered) {
			t.Fatalf("SQLite fixture never entered work (not a behavior red): %v %s", err, text)
		}
		if err != nil || !strings.Contains(text, sqliteCompleted) {
			t.Fatalf("actual SQLite invariant failed: %v %s", err, text)
		}
	}
	select {
	case <-output.entered:
	case err := <-done:
		waited = true
		check(err)
		return
	case <-interrupt:
		t.Fatal("SQLite fixture interrupted")
	case <-time.After(5 * time.Second):
		t.Fatal("SQLite startup deadline (not a behavior red)")
	}
	select {
	case err := <-done:
		waited = true
		check(err)
	case <-interrupt:
		t.Fatal("SQLite fixture interrupted")
	case <-time.After(2 * time.Second):
		t.Fatal("actual SQLite work exceeded tiny-input deadline")
	}
}

func TestSQLiteCMaintenanceOwnedWorker(t *testing.T) {
	name := os.Getenv(sqliteMaintenanceCase)
	if name == "" {
		return
	}
	valid := map[string]bool{"empty-aggregate-not-null": true, "redundant-upsert-index": true,
		"bound-values-simple-upsert": true, "null-empty-control": true, "wal-rollback-checkpoint-reopen": true}
	if !valid[name] {
		t.Fatal("unknown owned SQLite case")
	}
	version, _, _ := sqlite3.Version()
	t.Logf("actual C SQLite version %s; bounded owned fixture %s", version, name)
	fmt.Print(sqliteEntered)
	if name == "wal-rollback-checkpoint-reopen" {
		runSQLiteWALNormalControl(t)
		fmt.Print(sqliteCompleted)
		return
	}
	database, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	database.SetMaxOpenConns(1)
	execute := func(statement string, args ...any) {
		t.Helper()
		if _, err := database.Exec(statement, args...); err != nil {
			t.Fatal(err)
		}
	}
	switch name {
	case "empty-aggregate-not-null":
		execute("CREATE TABLE empty_probe (value INTEGER NOT NULL)")
		var isNull, count int
		if err := database.QueryRow("SELECT value IS NULL, count(*) FROM empty_probe").Scan(&isNull, &count); err != nil {
			t.Fatal(err)
		}
		if isNull != 1 || count != 0 {
			t.Fatalf("empty aggregate bare value must be NULL: got (%d,%d), want (1,0)", isNull, count)
		}
	case "redundant-upsert-index":
		execute("CREATE TABLE key_probe (id INTEGER PRIMARY KEY ON CONFLICT REPLACE, value INTEGER UNIQUE)")
		execute("INSERT INTO key_probe VALUES (0,33),(11,22)")
		// Own two-row variant of the maintainer's redundant conflict-clause boundary.
		execute("REPLACE INTO key_probe VALUES (0,11) ON CONFLICT(value) DO UPDATE SET id=value,value=value ON CONFLICT(value) DO UPDATE SET id=id,value=id")
		var tableCount, indexCount int
		if err := database.QueryRow("SELECT count(*) FROM key_probe NOT INDEXED").Scan(&tableCount); err != nil {
			t.Fatal(err)
		}
		if err := database.QueryRow("SELECT count(*) FROM key_probe WHERE value>8").Scan(&indexCount); err != nil {
			t.Fatal(err)
		}
		if tableCount != 2 || indexCount != tableCount {
			t.Fatalf("index disagrees with table: table=%d index=%d", tableCount, indexCount)
		}
		var integrity string
		if err := database.QueryRow("PRAGMA integrity_check").Scan(&integrity); err != nil || integrity != "ok" {
			t.Fatalf("owned index integrity=%q err=%v", integrity, err)
		}
	case "bound-values-simple-upsert":
		execute("CREATE TABLE normal_probe (id INTEGER PRIMARY KEY, value TEXT UNIQUE)")
		value := "中文 ' ; -- 一段正常的绑定数据"
		execute("INSERT INTO normal_probe VALUES (?,?)", 1, value)
		execute("INSERT INTO normal_probe VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value", 1, value+"更新")
		var actual string
		if err := database.QueryRow("SELECT value FROM normal_probe WHERE id=?", 1).Scan(&actual); err != nil || actual != value+"更新" {
			t.Fatalf("bound upsert changed: %q %v", actual, err)
		}
	case "null-empty-control":
		execute("CREATE TABLE null_probe (value INTEGER)")
		var value sql.NullInt64
		var count int
		if err := database.QueryRow("SELECT value,count(*) FROM null_probe").Scan(&value, &count); err != nil || value.Valid || count != 0 {
			t.Fatalf("normal empty aggregate: value=%v count=%d err=%v", value, count, err)
		}
	}
	fmt.Print(sqliteCompleted)
}

func runSQLiteWALNormalControl(t *testing.T) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "owned-wal.db")
	database, err := Open(config.Config{DatabasePath: path})
	if err != nil {
		t.Fatal(err)
	}
	pool, err := database.DB()
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	pool.SetMaxOpenConns(3)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	first, err := pool.Conn(ctx)
	if err != nil {
		t.Fatal(err)
	}
	second, err := pool.Conn(ctx)
	if err != nil {
		first.Close()
		t.Fatal(err)
	}
	defer first.Close()
	defer second.Close()
	for _, conn := range []*sql.Conn{first, second} {
		var mode string
		if err := conn.QueryRowContext(ctx, "PRAGMA journal_mode").Scan(&mode); err != nil || mode != "wal" {
			t.Fatalf("WAL mode=%q err=%v", mode, err)
		}
	}
	for _, statement := range []string{"CREATE TABLE normal_wal(id INTEGER PRIMARY KEY,value TEXT)", "INSERT INTO normal_wal VALUES(1,'原有正文')"} {
		if _, err := first.ExecContext(ctx, statement); err != nil {
			t.Fatal(err)
		}
	}
	tx, err := first.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tx.ExecContext(ctx, "UPDATE normal_wal SET value=? WHERE id=1", "不应提交"); err != nil {
		tx.Rollback()
		t.Fatal(err)
	}
	if err := tx.Rollback(); err != nil {
		t.Fatal(err)
	}
	var busy, log, checkpointed int
	if err := second.QueryRowContext(ctx, "PRAGMA wal_checkpoint(TRUNCATE)").Scan(&busy, &log, &checkpointed); err != nil || busy != 0 {
		t.Fatalf("checkpoint=%d/%d/%d err=%v", busy, log, checkpointed, err)
	}
	if err := first.Close(); err != nil {
		t.Fatal(err)
	}
	if err := second.Close(); err != nil {
		t.Fatal(err)
	}
	if err := pool.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := sql.Open("sqlite3", path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	var actual, integrity string
	if err := reopened.QueryRow("SELECT value FROM normal_wal WHERE id=1").Scan(&actual); err != nil || actual != "原有正文" {
		t.Fatalf("rollback/reopen lost original: %q %v", actual, err)
	}
	if err := reopened.QueryRow("PRAGMA integrity_check").Scan(&integrity); err != nil || integrity != "ok" {
		t.Fatalf("normal WAL integrity=%q err=%v", integrity, err)
	}
}
