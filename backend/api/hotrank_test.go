package api

import (
	"strings"
	"testing"
)

func TestParseHotRankHTMLExtractsEntries(t *testing.T) {
	page := `<html><body><ul>
	<li><div class="list_num red">1.</div>
	<div class="pic"><a href="http://product.dangdang.com/29771261.html"><img/></a></div>
	<div class="name"><a href="http://product.dangdang.com/29771261.html" target="_blank" title="长标题">短标题<span class='dot'>...</span></a></div>
	<div class="publisher_info"><a href="http://search.dangdang.com/?key=甲" title="甲" target="_blank">甲</a></div></li>
	<li><div class="name"><a href="http://product.dangdang.com/2.html">第二本</a></div>
	<div class="publisher_info">（德）<a href="x" title="乙">乙</a></div></li>
	</ul></body></html>`
	items := parseHotRankHTML(page)
	if len(items) != 2 {
		t.Fatalf("items = %d, want 2: %+v", len(items), items)
	}
	first := items[0]
	if first.BookID != "29771261" || first.Title != "短标题..." || first.Author != "甲" || first.Rank != 1 {
		t.Fatalf("first item = %+v", first)
	}
	if items[1].BookID != "2" || items[1].Rank != 2 || items[1].Author != "乙" {
		t.Fatalf("second item = %+v", items[1])
	}
}

func TestParseHotRankHTMLEmptyPage(t *testing.T) {
	if items := parseHotRankHTML("<html></html>"); len(items) != 0 {
		t.Fatalf("empty page produced %d items", len(items))
	}
	if strings.Contains("", "x") {
		t.Fatal("unreachable")
	}
}
