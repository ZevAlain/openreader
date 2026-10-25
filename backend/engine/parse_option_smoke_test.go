package engine

import (
	"os"
	"strings"
	"testing"

	"github.com/PuerkitoBio/goquery"

	"openreader/backend/models"
)

func TestPlainTagChapterListSelectorFindsOptions(t *testing.T) {
	data, err := os.ReadFile("testdata/chamabooks_toc.html")
	if err != nil {
		t.Skip("fixture unavailable")
	}
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(string(data)))
	if err != nil {
		t.Fatal(err)
	}
	rule := models.BookSourceRule{
		ChapterListRule: "option",
		ChapterNameRule: "text",
		ChapterURLRule:  "value",
	}
	chapters := parseChapterList(doc, rule, "option", "https://www.chamabooks.net/novel_cca9dcacb77d_1.html")
	if len(chapters) == 0 {
		t.Fatal("plain option selector found no chapters on a page with 1645 options")
	}
	if chapters[0].Title == "" || chapters[0].URL == "" {
		t.Fatalf("chapter missing fields: %+v", chapters[0])
	}
}

func TestChamabooksContentRuleExtractsBody(t *testing.T) {
	data, err := os.ReadFile("testdata/chamabooks_chapter.html")
	if err != nil {
		t.Skip("chapter fixture unavailable")
	}
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(string(data)))
	if err != nil {
		t.Fatal(err)
	}
	rule := models.BookSourceRule{ContentRule: "#novel-content@html##{{title}}"}
	base, _ := newSourceRuleRuntimeWithBookVariables("", "斗破苍穹")
	runtime, _ := base.withChapterVariables("", "第二章 斗气大陆")
	document := &sourceRuleDocument{document: doc}
	content, err := extractChapterContentFromSourceDocumentWithRuntime(document, rule, "https://www.chamabooks.net/novel_cca9dcacb77d_2.html", 0, runtime)
	if err != nil {
		t.Fatalf("evaluator content extraction failed: %v", err)
	}
	if len(content) < 100 {
		t.Fatalf("content too short: %d bytes", len(content))
	}
	if !strings.Contains(content, "斗气大陆") {
		t.Fatalf("content missing expected text, got %q", content[:80])
	}
}
