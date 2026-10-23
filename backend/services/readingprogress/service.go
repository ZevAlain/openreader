package readingprogress

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"openreader/backend/models"
)

var (
	ErrBookNotFound    = errors.New("book not found")
	ErrInvalidProgress = errors.New("invalid progress")
	ErrChapterNotFound = errors.New("chapter not found")
	ErrChapterIdentity = errors.New("chapter identity mismatch")
)

type Input struct {
	UserID          uint
	BookID          uint
	ChapterID       uint
	ChapterIndex    int
	Offset          int
	Percent         float64
	ChapterPercent  float64
	Mode            string
	BaseUpdatedAt   string
	ClientUpdatedAt string
}

type Result struct {
	Progress models.ReadingProgress
	Book     models.Book
	Conflict bool
}

type Service struct {
	db *gorm.DB
}

func New(database *gorm.DB) *Service {
	return &Service{db: database}
}

func (s *Service) Get(userID, bookID uint) (models.ReadingProgress, bool, error) {
	var book models.Book
	if err := s.db.Select("id").Where("user_id = ? AND id = ?", userID, bookID).First(&book).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.ReadingProgress{}, false, ErrBookNotFound
		}
		return models.ReadingProgress{}, false, err
	}

	var progress models.ReadingProgress
	if err := s.db.Where("user_id = ? AND book_id = ?", userID, bookID).First(&progress).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.ReadingProgress{}, false, nil
		}
		return models.ReadingProgress{}, false, err
	}
	return progress, true, nil
}

func (s *Service) Save(input Input) (Result, error) {
	if input.UserID == 0 || input.BookID == 0 || input.ChapterIndex < 0 || input.Offset < 0 {
		return Result{}, ErrInvalidProgress
	}

	var book models.Book
	if err := s.db.Where("user_id = ? AND id = ?", input.UserID, input.BookID).First(&book).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return Result{}, ErrBookNotFound
		}
		return Result{}, err
	}

	var chapter models.Chapter
	if err := s.db.Where("book_id = ? AND `index` = ?", book.ID, input.ChapterIndex).First(&chapter).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return Result{}, ErrChapterNotFound
		}
		return Result{}, err
	}
	if input.ChapterID != 0 && input.ChapterID != chapter.ID {
		return Result{}, ErrChapterIdentity
	}

	candidate := models.ReadingProgress{
		UserID:         input.UserID,
		BookID:         input.BookID,
		ChapterID:      chapter.ID,
		ChapterIndex:   chapter.Index,
		Offset:         input.Offset,
		Percent:        ClampPercent(input.Percent),
		ChapterPercent: ClampPercent(input.ChapterPercent),
		ChapterTitle:   chapter.Title,
		Mode:           input.Mode,
		UpdatedAt:      time.Now().UTC(),
	}
	progress, conflict, err := s.saveCAS(candidate, input.BaseUpdatedAt, input.ClientUpdatedAt)
	if err != nil {
		return Result{}, err
	}
	return Result{Progress: progress, Book: book, Conflict: conflict}, nil
}

func (s *Service) saveCAS(candidate models.ReadingProgress, baseUpdatedAt, clientUpdatedAt string) (models.ReadingProgress, bool, error) {
	var existing models.ReadingProgress
	err := s.db.Where("user_id = ? AND book_id = ?", candidate.UserID, candidate.BookID).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		createErr := s.db.Create(&candidate).Error
		if createErr == nil {
			return candidate, false, nil
		}
		winner, loadErr := s.load(candidate.UserID, candidate.BookID)
		if loadErr == nil {
			return winner, true, nil
		}
		return models.ReadingProgress{}, false, createErr
	}
	if err != nil {
		return models.ReadingProgress{}, false, err
	}
	if IsStaleUpdate(existing.UpdatedAt, baseUpdatedAt, clientUpdatedAt) {
		return existing, true, nil
	}

	candidate.ID = existing.ID
	updates := map[string]any{
		"chapter_id":      candidate.ChapterID,
		"chapter_index":   candidate.ChapterIndex,
		"offset":          candidate.Offset,
		"percent":         candidate.Percent,
		"chapter_percent": candidate.ChapterPercent,
		"chapter_title":   candidate.ChapterTitle,
		"mode":            candidate.Mode,
		"updated_at":      candidate.UpdatedAt,
	}
	write := s.db.Model(&models.ReadingProgress{}).
		Where("id = ? AND user_id = ? AND book_id = ? AND updated_at = ?", existing.ID, candidate.UserID, candidate.BookID, existing.UpdatedAt).
		Updates(updates)
	if write.Error != nil {
		return models.ReadingProgress{}, false, write.Error
	}
	if write.RowsAffected == 1 {
		return candidate, false, nil
	}
	winner, err := s.load(candidate.UserID, candidate.BookID)
	if err != nil {
		return models.ReadingProgress{}, false, err
	}
	return winner, true, nil
}

func (s *Service) load(userID, bookID uint) (models.ReadingProgress, error) {
	var progress models.ReadingProgress
	err := s.db.Where("user_id = ? AND book_id = ?", userID, bookID).First(&progress).Error
	return progress, err
}

func IsStaleUpdate(serverUpdatedAt time.Time, baseUpdatedAt, clientUpdatedAt string) bool {
	if baseUpdatedAt == "" || serverUpdatedAt.IsZero() {
		return serverNewerThanClient(serverUpdatedAt, clientUpdatedAt)
	}
	base, err := time.Parse(time.RFC3339Nano, baseUpdatedAt)
	if err != nil {
		return serverNewerThanClient(serverUpdatedAt, clientUpdatedAt)
	}
	return serverUpdatedAt.After(base)
}

func serverNewerThanClient(serverUpdatedAt time.Time, clientUpdatedAt string) bool {
	if clientUpdatedAt == "" || serverUpdatedAt.IsZero() {
		return false
	}
	clientTime, err := time.Parse(time.RFC3339Nano, clientUpdatedAt)
	if err != nil {
		return false
	}
	return serverUpdatedAt.After(clientTime)
}

func ClampPercent(percent float64) float64 {
	if percent < 0 {
		return 0
	}
	if percent > 1 {
		return 1
	}
	return percent
}
