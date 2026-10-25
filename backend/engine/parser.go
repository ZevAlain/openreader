package engine

import (
	"strings"

	"github.com/PuerkitoBio/goquery"
)

func Extract(sel *goquery.Selection, rule string) []string {
	parts := strings.Split(rule, "|")
	selector := strings.TrimSpace(parts[0])
	operation := "text"
	if len(parts) > 1 {
		operation = strings.TrimSpace(parts[1])
	}

	values := make([]string, 0)
	// Community sources write bare keywords (text/ownText/html/value) to read
	// the selected item itself — e.g. chapterListRule "option" with
	// chapterNameRule "text" and chapterUrlRule "value". Treating them as CSS
	// selectors matches nothing, so they resolve against the item directly.
	operate := func(selection *goquery.Selection) {
		switch {
		case operation == "text":
			values = append(values, strings.TrimSpace(selection.Text()))
		case operation == "ownText":
			var builder strings.Builder
			contents := selection.Contents()
			for index := 0; index < contents.Length(); index++ {
				node := contents.Get(index)
				if node.Type == 3 {
					builder.WriteString(node.Data)
				}
			}
			values = append(values, strings.TrimSpace(builder.String()))
		case operation == "html":
			html, _ := selection.Html()
			values = append(values, strings.TrimSpace(html))
		case operation == "value":
			if value, exists := selection.Attr("value"); exists {
				values = append(values, strings.TrimSpace(value))
			}
		case strings.HasPrefix(operation, "attr:"):
			attr := strings.TrimPrefix(operation, "attr:")
			if value, exists := selection.Attr(attr); exists {
				values = append(values, strings.TrimSpace(value))
			}
		}
	}
	switch selector {
	case "", "text", "ownText", "html":
		operate(sel)
	case "value":
		// Bare "value" reads the item's own value attribute regardless of the
		// default text operation.
		if value, exists := sel.Attr("value"); exists {
			values = append(values, strings.TrimSpace(value))
		}
	default:
		sel.Find(selector).Each(func(_ int, selection *goquery.Selection) {
			operate(selection)
		})
	}
	return values
}
