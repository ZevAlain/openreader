package api

import (
	"math"
	"strconv"
	"strings"
)

// Community-maintained Legado sources regularly ship numeric fields as JSON
// strings ("lastUpdateTime":"1783245325095"). Strict int64 decoding rejects
// the whole import, so import payloads accept both spellings.
type flexibleInt64 int64

type flexibleInt int

func parseFlexible(raw []byte) (int64, error) {
	text := strings.TrimSpace(strings.Trim(strings.TrimSpace(string(raw)), `"`))
	if text == "" || text == "null" {
		return 0, nil
	}
	value, err := strconv.ParseFloat(text, 64)
	if err != nil {
		return 0, err
	}
	if math.IsInf(value, 0) || math.IsNaN(value) {
		return 0, strconv.ErrSyntax
	}
	return int64(value), nil
}

func (f *flexibleInt64) UnmarshalJSON(raw []byte) error {
	value, err := parseFlexible(raw)
	if err != nil {
		return err
	}
	*f = flexibleInt64(value)
	return nil
}

func (f *flexibleInt) UnmarshalJSON(raw []byte) error {
	value, err := parseFlexible(raw)
	if err != nil {
		return err
	}
	*f = flexibleInt(value)
	return nil
}
