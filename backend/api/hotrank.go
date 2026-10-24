package api

import (
	"context"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/text/encoding/simplifiedchinese"
)

// The discovery board on the search page ships with the app so it works even
// before the user imports explore-capable sources. It reads Dangdang's public
// 24-hour book bestseller ranking (stable SSR page, no sign-in) and caches the
// parse server-side; tapping an entry simply seeds the normal search flow
// with the book title. Qidian's mobile rank is client-rendered and its PC
// page sits behind a bot challenge, so it is not usable server-side.

const (
	hotRankURL         = "https://bang.dangdang.com/books/bestsellers/01.00.00.00.00.00-24hours-0-0-1-1"
	hotRankMaxItems    = 20
	hotRankCacheLength = 30 * time.Minute
	// Refreshes are suppressed for two minutes after an upstream failure.
	hotRankNegativeCache = 2 * time.Minute
	hotRankUserAgent     = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)

type HotRankItem struct {
	Title  string `json:"title"`
	Author string `json:"author"`
	BookID string `json:"bookId"`
	Rank   int    `json:"rank"`
}

type hotRankCache struct {
	mu      sync.Mutex
	items   []HotRankItem
	fetched time.Time
	// failedAt suppresses refetches for a short window after an upstream
	// failure so a dead upstream is not hammered on every request.
	failedAt time.Time
}

func (s *Server) getHotRank(c *gin.Context) {
	items, fetchedAt, err := s.loadHotRank(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to load hot rank"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "fetchedAt": fetchedAt})
}

func (s *Server) loadHotRank(ctx context.Context) ([]HotRankItem, time.Time, error) {
	s.hotRank.mu.Lock()
	defer s.hotRank.mu.Unlock()
	if len(s.hotRank.items) > 0 && time.Since(s.hotRank.fetched) < hotRankCacheLength {
		return s.hotRank.items, s.hotRank.fetched, nil
	}
	if !s.hotRank.failedAt.IsZero() && time.Since(s.hotRank.failedAt) < hotRankNegativeCache {
		return nil, time.Time{}, errors.New("hot rank upstream recently failed")
	}
	page, err := fetchHotRankPage(ctx)
	if err != nil {
		s.hotRank.failedAt = time.Now()
		return nil, time.Time{}, err
	}
	items := parseHotRankHTML(page)
	if len(items) == 0 {
		s.hotRank.failedAt = time.Now()
		return nil, time.Time{}, errors.New("hot rank page had no entries")
	}
	s.hotRank.items = items
	s.hotRank.fetched = time.Now()
	return items, s.hotRank.fetched, nil
}

func fetchHotRankPage(ctx context.Context) (string, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, hotRankURL, nil)
	if err != nil {
		return "", err
	}
	request.Header.Set("User-Agent", hotRankUserAgent)
	request.Header.Set("Accept", "text/html")
	client := &http.Client{Timeout: 15 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", errors.New("hot rank endpoint returned " + response.Status)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, 4<<20))
	if err != nil {
		return "", err
	}
	decoded, decodeErr := simplifiedchinese.GB18030.NewDecoder().Bytes(body)
	if decodeErr != nil {
		return string(body), nil
	}
	return string(decoded), nil
}

var (
	hotRankNameRe   = regexp.MustCompile(`(?s)<div class="name"><a href="https?://product\.dangdang\.com/(\d+)\.html"[^>]*>(.*?)</a>`)
	hotRankTagRe    = regexp.MustCompile(`<[^>]+>`)
	hotRankAuthorRe = regexp.MustCompile(`(?s)<div class="publisher_info">.*?<a [^>]*title="([^"]*)"`)
)

func parseHotRankHTML(page string) []HotRankItem {
	items := make([]HotRankItem, 0, hotRankMaxItems)
	for _, match := range hotRankNameRe.FindAllStringSubmatch(page, -1) {
		if len(items) >= hotRankMaxItems {
			break
		}
		bookID := match[1]
		title := strings.TrimSpace(hotRankTagRe.ReplaceAllString(match[2], ""))
		if title == "" {
			continue
		}
		author := ""
		if authorMatch := hotRankAuthorRe.FindStringSubmatch(page[matchEnd(page, match):]); authorMatch != nil {
			author = strings.TrimSpace(authorMatch[1])
		}
		items = append(items, HotRankItem{
			Title:  title,
			Author: author,
			BookID: bookID,
			Rank:   len(items) + 1,
		})
	}
	return items
}

func matchEnd(page string, match []string) int {
	position := strings.Index(page, match[0])
	if position < 0 {
		return 0
	}
	end := position + len(match[0])
	if end > len(page) {
		return len(page)
	}
	return end
}
