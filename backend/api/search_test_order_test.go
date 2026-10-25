package api

import (
	"testing"

	"openreader/backend/engine"
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

func TestResultMentionsKeyword(t *testing.T) {
	assert := func(title, author, keyword string, want bool) {
		t.Helper()
		if got := resultMentionsKeyword(engine.SearchResult{Title: title, Author: author}, keyword); got != want {
			t.Fatalf("mentions(%q,%q,%q) = %v, want %v", title, author, keyword, got, want)
		}
	}
	assert("遮天", "辰东", "遮天", true)
	assert("医手遮天：皇叔请自重", "", "遮天", true)
	assert("", "辰东", "遮天", false)
	assert("称霸异世界", "", "遮天", false)
	assert("末日的虫族", "遮天作者", "遮天", true)
	assert("任何书", "任何作者", "", true)
}
