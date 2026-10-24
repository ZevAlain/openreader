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

func TestIsJunkSearchResult(t *testing.T) {
	junk := []string{
		`与""相关的小说 - (最多显示100条)`,
		`相关的小说`,
		``,
		`  `,
	}
	for _, title := range junk {
		if !isJunkSearchResult(title) {
			t.Fatalf("junk not filtered: %q", title)
		}
	}
	good := []string{`遮天`, `医手遮天`, `遮天 · 辰东`}
	for _, title := range good {
		if isJunkSearchResult(title) {
			t.Fatalf("good result filtered: %q", title)
		}
	}
}
