package backup

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"openreader/backend/config"
	"openreader/backend/models"
)

type contextBackupGenerator interface {
	RunNowForUserContext(context.Context, uint, string) (string, error)
}

func requireContextBackupGenerator(t *testing.T, service *Service) contextBackupGenerator {
	t.Helper()
	generator, ok := any(service).(contextBackupGenerator)
	if !ok {
		t.Fatal("backup service must expose context-aware logical generation entry points")
	}
	return generator
}

func TestBackupGenerationRejectsCanceledContextBeforeWork(t *testing.T) {
	database := backupTestDB(t)
	root := t.TempDir()
	service := New(database, filepath.Join(root, "webdav"), config.Config{LibraryDir: filepath.Join(root, "library")})
	generator := requireContextBackupGenerator(t, service)
	var queries atomic.Int64
	if err := database.Callback().Query().Before("gorm:query").Register("test:count-pre-canceled-queries", func(*gorm.DB) {
		queries.Add(1)
	}); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if _, err := generator.RunNowForUserContext(ctx, 1, "canceled-logical"); !errors.Is(err, context.Canceled) {
		t.Fatalf("logical pre-cancel error = %v, want context.Canceled", err)
	}
	if got := queries.Load(); got != 0 {
		t.Fatalf("pre-canceled backup generation executed %d database queries, want 0", got)
	}
	assertNoBackupGenerationArtifacts(t, root)
}

func TestCanceledBackupGenerationWaiterDoesNotStartAfterLockRelease(t *testing.T) {
	database := backupTestDB(t)
	root := t.TempDir()
	service := New(database, filepath.Join(root, "webdav"), config.Config{LibraryDir: filepath.Join(root, "library")})
	generator := requireContextBackupGenerator(t, service)
	started := make(chan struct{})
	release := make(chan struct{})
	var blocked atomic.Bool
	if err := database.Callback().Query().Before("gorm:query").Register("test:block-first-backup", func(tx *gorm.DB) {
		if tx.Statement.Table == "rss_sources" && blocked.CompareAndSwap(false, true) {
			close(started)
			<-release
		}
	}); err != nil {
		t.Fatal(err)
	}

	firstDone := make(chan error, 1)
	go func() {
		_, err := generator.RunNowForUserContext(context.Background(), 1, "first-backup")
		firstDone <- err
	}()
	select {
	case <-started:
	case <-time.After(2 * time.Second):
		t.Fatal("first backup did not reach the blocking query")
	}

	ctx, cancel := context.WithCancel(context.Background())
	secondDone := make(chan error, 1)
	go func() {
		_, err := generator.RunNowForUserContext(ctx, 2, "canceled-waiter")
		secondDone <- err
	}()
	cancel()
	select {
	case err := <-secondDone:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("canceled waiter error = %v, want context.Canceled", err)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("canceled waiter remained blocked behind active backup")
	}

	close(release)
	if err := <-firstDone; err != nil {
		t.Fatalf("first backup failed after release: %v", err)
	}
	entries, err := filepath.Glob(filepath.Join(root, "webdav", "users", "canceled-waiter", "backup_*.zip"))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Fatalf("canceled waiter started after lock release: %v", entries)
	}
}

func TestLogicalBackupGenerationCancelsInFlightAndCleansTemporaryFile(t *testing.T) {
	database := backupTestDB(t)
	root := t.TempDir()
	service := New(database, filepath.Join(root, "webdav"))
	started := make(chan struct{})
	if err := database.Callback().Query().Before("gorm:query").Register("test:block-logical-backup", func(tx *gorm.DB) {
		if tx.Statement.Table != "rss_sources" {
			return
		}
		close(started)
		<-tx.Statement.Context.Done()
		tx.AddError(tx.Statement.Context.Err())
	}); err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		_, err := service.RunNowForUserContext(ctx, 1, "in-flight-logical")
		done <- err
	}()
	select {
	case <-started:
	case <-time.After(2 * time.Second):
		cancel()
		t.Fatal("logical backup did not reach the blocking snapshot query")
	}
	cancel()
	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("in-flight logical cancellation error = %v, want context.Canceled", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("logical backup did not stop after cancellation")
	}
	assertNoBackupGenerationArtifacts(t, root)
}

func TestBackupGenerationKeepsPackageWhenCanceledAfterDurableRename(t *testing.T) {
	database := backupTestDB(t)
	root := t.TempDir()
	service := New(database, filepath.Join(root, "webdav"))
	writer := &blockingBackupLogWriter{started: make(chan struct{}), release: make(chan struct{})}
	previous := log.Writer()
	log.SetOutput(writer)
	t.Cleanup(func() { log.SetOutput(previous) })

	ctx, cancel := context.WithCancel(context.Background())
	type backupResult struct {
		path string
		err  error
	}
	done := make(chan backupResult, 1)
	go func() {
		path, err := service.RunNowForUserContext(ctx, 1, "durable-rename")
		done <- backupResult{path: path, err: err}
	}()
	select {
	case <-writer.started:
	case <-time.After(2 * time.Second):
		cancel()
		close(writer.release)
		t.Fatal("backup did not reach its post-rename success log")
	}
	cancel()
	close(writer.release)
	result := <-done
	if result.err != nil {
		t.Fatalf("post-rename cancellation changed durable success to error: %v", result.err)
	}
	reader, err := zip.OpenReader(result.path)
	if err != nil {
		t.Fatalf("durable backup is not readable after request cancellation: %v", err)
	}
	_ = reader.Close()
	if strings.HasPrefix(filepath.Base(result.path), ".backup-") {
		t.Fatalf("durable result still uses a temporary name: %s", result.path)
	}
}

func TestBackupGenerationSuccessLogDoesNotExposeHostPath(t *testing.T) {
	database := backupTestDB(t)
	root := t.TempDir()
	service := New(database, filepath.Join(root, "private-mounted-webdav"))
	var output bytes.Buffer
	previous := log.Writer()
	log.SetOutput(&output)
	t.Cleanup(func() { log.SetOutput(previous) })

	path, err := service.RunNowForUser(1, "log-redaction")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(output.String(), root) || strings.Contains(output.String(), filepath.Dir(path)) {
		t.Fatalf("backup success log exposed host path: %s", output.String())
	}
	if !strings.Contains(output.String(), filepath.Base(path)) {
		t.Fatalf("backup success log omitted safe basename: %s", output.String())
	}
}

func assertNoBackupGenerationArtifacts(t *testing.T, root string) {
	t.Helper()
	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		name := entry.Name()
		if strings.HasPrefix(name, "backup_") || strings.HasPrefix(name, ".backup-") {
			t.Fatalf("canceled generation left artifact %s", path)
		}
		return nil
	})
	if err != nil && !os.IsNotExist(err) {
		t.Fatal(err)
	}
}

type blockingBackupLogWriter struct {
	started chan struct{}
	release chan struct{}
	wrote   atomic.Bool
}

func (w *blockingBackupLogWriter) Write(data []byte) (int, error) {
	if w.wrote.CompareAndSwap(false, true) {
		close(w.started)
	}
	<-w.release
	return len(data), nil
}

func backupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	database, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "backup.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := database.AutoMigrate(
		&models.User{},
		&models.UserSession{},
		&models.BookSource{},
		&models.UserBookSource{},
		&models.BookSourceNamespace{},
		&models.SourceFailure{},
		&models.RSSSource{},
		&models.UserSetting{},
		&models.Category{},
		&models.Book{},
		&models.Chapter{},
		&models.Bookmark{},
		&models.ReadingProgress{},
		&models.ReplaceRule{},
		&models.BookCategory{},
		&models.BookGroupPreference{},
	); err != nil {
		t.Fatal(err)
	}
	return database
}
