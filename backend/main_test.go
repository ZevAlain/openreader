package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"openreader/backend/config"
)

func TestCORSStillCompletesOrdinaryPreflight(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(cors(config.Config{CORSOrigin: "https://reader.example"}))
	router.Handle(http.MethodOptions, "/api/example", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodOptions, "/api/example", nil))
	if response.Code != http.StatusNoContent {
		t.Fatalf("ordinary CORS preflight = %d, want 204", response.Code)
	}
}

func TestCORSWildcardNeverAdvertisesCredentialedAccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(cors(config.Config{}))
	router.GET("/api/example", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/example", nil))
	if response.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Fatalf("fallback CORS origin = %q, want *", response.Header().Get("Access-Control-Allow-Origin"))
	}
	if response.Header().Get("Access-Control-Allow-Credentials") != "" {
		t.Fatalf("wildcard CORS must not allow credentials: %q", response.Header().Get("Access-Control-Allow-Credentials"))
	}
}
