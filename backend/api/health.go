package api

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

var (
	// Overridden by CI ldflags; the local default comes from the repo's
	// VERSION file so dev builds and the workflow agree on the Vx.x.x line.
	Version   = defaultVersion()
	Commit    = "unknown"
	BuildDate = "unknown"
)

func defaultVersion() string {
	for _, candidate := range []string{"../VERSION", "VERSION", "../../VERSION"} {
		if data, err := os.ReadFile(candidate); err == nil {
			if version := strings.TrimPrefix(strings.TrimSpace(string(data)), "v"); version != "" {
				return version
			}
		}
	}
	return "dev"
}

func (s *Server) health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "ok",
		"app":       "openreader",
		"version":   Version,
		"commit":    Commit,
		"buildDate": BuildDate,
	})
}
