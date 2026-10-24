package api

import (
	"testing"

	"openreader/backend/models"
)

func TestSortSearchSourcesByRespondTime(t *testing.T) {
	sources := []models.BookSource{
		{ID: 1, Name: "dead", RespondTime: 0}, // unknown → last
		{ID: 2, Name: "slow", RespondTime: 9_000},
		{ID: 3, Name: "fast", RespondTime: 120},
		{ID: 4, Name: "negative", RespondTime: -5}, // unusable → last
	}
	sortSearchSourcesByRespondTime(sources)
	if sources[0].Name != "fast" || sources[1].Name != "slow" {
		t.Fatalf("order = %s,%s want fast,slow first", sources[0].Name, sources[1].Name)
	}
	if sources[2].Name != "dead" || sources[3].Name != "negative" {
		t.Fatalf("unknown-health sources must sort last, got %s,%s", sources[2].Name, sources[3].Name)
	}
}
