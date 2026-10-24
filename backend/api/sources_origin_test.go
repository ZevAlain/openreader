package api

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"openreader/backend/models"
)

func TestRemoteOriginCountAndDeleteByOrigin(t *testing.T) {
	router, server := setupTestServer(t)
	auth := authHeader(t, router)

	for i := 1; i <= 3; i++ {
		if err := server.db.Create(&models.BookSource{
			Name: fmt.Sprintf("溯源源%d", i), BaseURL: fmt.Sprintf("https://origin-%d.example/", i),
			OriginURL: "https://collection.example/one.json", Enabled: true,
		}).Error; err != nil {
			t.Fatal(err)
		}
	}

	countRequest := httptest.NewRequest(http.MethodGet, "/api/sources/origin-count?url=https%3A%2F%2Fcollection.example%2Fone.json", nil)
	countRequest.Header.Set("Authorization", auth)
	countWriter := httptest.NewRecorder()
	router.ServeHTTP(countWriter, countRequest)
	if countWriter.Code != http.StatusOK || !strings.Contains(countWriter.Body.String(), `"count":3`) {
		t.Fatalf("origin count = %d %s", countWriter.Code, countWriter.Body.String())
	}

	deleteRequest := httptest.NewRequest(http.MethodDelete, "/api/sources/origin?url=https%3A%2F%2Fcollection.example%2Fone.json", nil)
	deleteRequest.Header.Set("Authorization", auth)
	deleteWriter := httptest.NewRecorder()
	router.ServeHTTP(deleteWriter, deleteRequest)
	if deleteWriter.Code != http.StatusOK || !strings.Contains(deleteWriter.Body.String(), `"deleted":3`) {
		t.Fatalf("origin delete = %d %s", deleteWriter.Code, deleteWriter.Body.String())
	}

	after, err := server.bookSources.CountByOrigin(1, "https://collection.example/one.json")
	if err != nil {
		t.Fatal(err)
	}
	if after != 0 {
		t.Fatalf("sources survived origin delete: %d", after)
	}
}
