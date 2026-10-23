package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"openreader/backend/models"
)

type bookGroupContractRow struct {
	Key         string `json:"key"`
	Kind        string `json:"kind"`
	Semantic    string `json:"semantic"`
	CategoryID  *uint  `json:"categoryId"`
	Name        string `json:"name"`
	DefaultName string `json:"defaultName"`
	Show        bool   `json:"show"`
	SortOrder   int    `json:"sortOrder"`
	Assignable  bool   `json:"assignable"`
	Deletable   bool   `json:"deletable"`
}

func TestBookGroupsProjectFourPersistedBuiltInsAndUserCategories(t *testing.T) {
	router, server := setupTestServer(t)
	auth := authHeader(t, router)
	var owner models.User
	if err := server.db.Where("username = ?", "testuser").First(&owner).Error; err != nil {
		t.Fatal(err)
	}
	category := models.Category{UserID: owner.ID, Name: "自定义分组", Show: true, SortOrder: 20}
	if err := server.db.Create(&category).Error; err != nil {
		t.Fatal(err)
	}

	groups := getBookGroupContractRows(t, router, auth)
	assertBookGroupContractKeys(t, groups, []string{
		"builtin:all", "builtin:local", "builtin:audio", "builtin:ungrouped", "category:" + strconv.FormatUint(uint64(category.ID), 10),
	})
	defaults := []struct {
		key, semantic, name string
		order               int
	}{
		{"builtin:all", "all", "全部", -10},
		{"builtin:local", "local", "本地", -9},
		{"builtin:audio", "audio", "音频", -8},
		{"builtin:ungrouped", "ungrouped", "未分组", -7},
	}
	for index, expected := range defaults {
		row := groups[index]
		if row.Key != expected.key || row.Kind != "builtin" || row.Semantic != expected.semantic || row.Name != expected.name || row.DefaultName != expected.name || row.SortOrder != expected.order || !row.Show || row.Assignable || row.Deletable || row.CategoryID != nil {
			t.Fatalf("unexpected built-in %s: %+v", expected.key, row)
		}
	}
	custom := groups[len(groups)-1]
	if custom.Kind != "category" || custom.Semantic != "category" || custom.CategoryID == nil || *custom.CategoryID != category.ID || !custom.Assignable || !custom.Deletable || custom.DefaultName != "" {
		t.Fatalf("unexpected category projection: %+v", custom)
	}

	updated := bookGroupContractRequest(t, router, auth, http.MethodPut, "/api/book-groups/all", `{"name":"所有藏书","show":false}`)
	if updated.Code != http.StatusOK {
		t.Fatalf("update built-in: status=%d body=%s", updated.Code, updated.Body.String())
	}
	var all bookGroupContractRow
	if err := json.Unmarshal(updated.Body.Bytes(), &all); err != nil {
		t.Fatal(err)
	}
	if all.Key != "builtin:all" || all.Name != "所有藏书" || all.Show || all.DefaultName != "全部" {
		t.Fatalf("built-in update was not persisted: %+v", all)
	}
	groups = getBookGroupContractRows(t, router, auth)
	if groups[0].Name != "所有藏书" || groups[0].Show {
		t.Fatalf("subsequent projection lost built-in update: %+v", groups[0])
	}

	for path, body := range map[string]string{
		"/api/book-groups/all":     `{"name":"  "}`,
		"/api/book-groups/missing": `{"show":false}`,
		"/api/book-groups/local":   `{}`,
	} {
		response := bookGroupContractRequest(t, router, auth, http.MethodPut, path, body)
		if response.Code != http.StatusBadRequest {
			t.Fatalf("invalid built-in update %s: status=%d body=%s", path, response.Code, response.Body.String())
		}
	}

	otherAuth, other := registerBookGroupContractUser(t, router, server, "groupother")
	otherGroups := getBookGroupContractRows(t, router, otherAuth)
	if other.ID == owner.ID || otherGroups[0].Name != "全部" || !otherGroups[0].Show || len(otherGroups) != 4 {
		t.Fatalf("book groups leaked between users: owner=%d other=%d groups=%+v", owner.ID, other.ID, otherGroups)
	}
}

func TestBookGroupsMixedReorderIsCompleteAtomicAndAppendsNewCategories(t *testing.T) {
	router, server := setupTestServer(t)
	auth := authHeader(t, router)
	var owner models.User
	if err := server.db.Where("username = ?", "testuser").First(&owner).Error; err != nil {
		t.Fatal(err)
	}
	first := models.Category{UserID: owner.ID, Name: "第一分组", Show: true, SortOrder: 10}
	second := models.Category{UserID: owner.ID, Name: "第二分组", Show: true, SortOrder: 20}
	if err := server.db.Create(&first).Error; err != nil {
		t.Fatal(err)
	}
	if err := server.db.Create(&second).Error; err != nil {
		t.Fatal(err)
	}
	firstKey := "category:" + strconv.FormatUint(uint64(first.ID), 10)
	secondKey := "category:" + strconv.FormatUint(uint64(second.ID), 10)
	wanted := []string{secondKey, "builtin:audio", "builtin:all", firstKey, "builtin:local", "builtin:ungrouped"}
	response := bookGroupContractRequest(t, router, auth, http.MethodPut, "/api/book-groups/reorder", `{"keys":["`+strings.Join(wanted, `","`)+`"]}`)
	if response.Code != http.StatusOK {
		t.Fatalf("mixed reorder: status=%d body=%s", response.Code, response.Body.String())
	}
	var reordered []bookGroupContractRow
	if err := json.Unmarshal(response.Body.Bytes(), &reordered); err != nil {
		t.Fatal(err)
	}
	assertBookGroupContractKeys(t, reordered, wanted)
	for index, row := range reordered {
		if row.SortOrder != (index+1)*10 {
			t.Fatalf("mixed order %s=%d, want %d", row.Key, row.SortOrder, (index+1)*10)
		}
	}

	before := append([]string(nil), wanted...)
	invalidBodies := []string{
		`{"keys":["builtin:all"]}`,
		`{"keys":["` + strings.Join(append([]string(nil), wanted[:len(wanted)-1]...), `","`) + `"]}`,
		`{"keys":["` + strings.Join(append(append([]string(nil), wanted...), wanted[0]), `","`) + `"]}`,
		`{"keys":["` + strings.Join(append(append([]string(nil), wanted...), "category:999999"), `","`) + `"]}`,
	}
	for _, body := range invalidBodies {
		invalid := bookGroupContractRequest(t, router, auth, http.MethodPut, "/api/book-groups/reorder", body)
		if invalid.Code != http.StatusBadRequest {
			t.Fatalf("invalid mixed reorder: status=%d body=%s request=%s", invalid.Code, invalid.Body.String(), body)
		}
		assertBookGroupContractKeys(t, getBookGroupContractRows(t, router, auth), before)
	}

	created := bookGroupContractRequest(t, router, auth, http.MethodPost, "/api/categories", `{"name":"最后新增"}`)
	if created.Code != http.StatusCreated {
		t.Fatalf("create category after mixed reorder: status=%d body=%s", created.Code, created.Body.String())
	}
	var newCategory models.Category
	if err := json.Unmarshal(created.Body.Bytes(), &newCategory); err != nil {
		t.Fatal(err)
	}
	groups := getBookGroupContractRows(t, router, auth)
	if groups[len(groups)-1].Key != "category:"+strconv.FormatUint(uint64(newCategory.ID), 10) || groups[len(groups)-1].SortOrder <= reordered[len(reordered)-1].SortOrder {
		t.Fatalf("new category was not appended after unified max: %+v", groups)
	}
}

func TestBookGroupPreferencesAreDeletedWithUserData(t *testing.T) {
	router, server := setupTestServer(t)
	_ = authHeader(t, router)
	auth, user := registerBookGroupContractUser(t, router, server, "groupdelete")
	_ = getBookGroupContractRows(t, router, auth)
	var before int64
	if err := server.db.Raw("SELECT COUNT(*) FROM book_group_preferences WHERE user_id = ?", user.ID).Scan(&before).Error; err != nil {
		t.Fatal(err)
	}
	if before != 4 {
		t.Fatalf("expected four preference rows before delete, got %d", before)
	}
	if _, _, err := server.deleteUserData(context.Background(), []uint{user.ID}, 0); err != nil {
		t.Fatal(err)
	}
	var after int64
	if err := server.db.Raw("SELECT COUNT(*) FROM book_group_preferences WHERE user_id = ?", user.ID).Scan(&after).Error; err != nil {
		t.Fatal(err)
	}
	if after != 0 {
		t.Fatalf("deleted user left %d book group preference rows", after)
	}
}

func getBookGroupContractRows(t *testing.T, router *gin.Engine, auth string) []bookGroupContractRow {
	t.Helper()
	response := bookGroupContractRequest(t, router, auth, http.MethodGet, "/api/book-groups", "")
	if response.Code != http.StatusOK {
		t.Fatalf("get book groups: status=%d body=%s", response.Code, response.Body.String())
	}
	var rows []bookGroupContractRow
	if err := json.Unmarshal(response.Body.Bytes(), &rows); err != nil {
		t.Fatal(err)
	}
	return rows
}

func bookGroupContractRequest(t *testing.T, router *gin.Engine, auth string, method string, path string, body string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Authorization", auth)
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func registerBookGroupContractUser(t *testing.T, router *gin.Engine, server *Server, username string) (string, models.User) {
	t.Helper()
	request := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(`{"username":"`+username+`","password":"password8"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("register %s: status=%d body=%s", username, response.Code, response.Body.String())
	}
	var payload struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	var user models.User
	if err := server.db.Where("username = ?", username).First(&user).Error; err != nil {
		t.Fatal(err)
	}
	return "Bearer " + payload.Token, user
}

func assertBookGroupContractKeys(t *testing.T, rows []bookGroupContractRow, expected []string) {
	t.Helper()
	actual := make([]string, 0, len(rows))
	for _, row := range rows {
		actual = append(actual, row.Key)
	}
	if strings.Join(actual, "|") != strings.Join(expected, "|") {
		t.Fatalf("book group keys=%v, want %v", actual, expected)
	}
}

func findBookGroupContractRow(t *testing.T, rows []bookGroupContractRow, key string) bookGroupContractRow {
	t.Helper()
	for _, row := range rows {
		if row.Key == key {
			return row
		}
	}
	t.Fatalf("book group %s not found in %+v", key, rows)
	return bookGroupContractRow{}
}
