package api

import "testing"

func TestParseFlexibleNumberEdges(t *testing.T) {
	cases := []struct {
		raw  string
		want int64
		err  bool
	}{
		{raw: `0`, want: 0},
		{raw: `""`, want: 0},
		{raw: `null`, want: 0},
		{raw: `"1783245325095"`, want: 1783245325095},
		{raw: `" 12 "`, want: 12},
		{raw: `"3.9"`, want: 3},
		{raw: `-2.9`, want: -2},
		{raw: `"-5"`, want: -5},
		{raw: `"abc"`, err: true},
		{raw: `"1e309"`, err: true},
		{raw: `"Inf"`, err: true},
		{raw: `"NaN"`, err: true},
	}
	for _, tc := range cases {
		got, err := parseFlexible([]byte(tc.raw))
		if tc.err {
			if err == nil {
				t.Errorf("parseFlexible(%s) = %d, want error", tc.raw, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("parseFlexible(%s) unexpected error: %v", tc.raw, err)
			continue
		}
		if got != tc.want {
			t.Errorf("parseFlexible(%s) = %d, want %d", tc.raw, got, tc.want)
		}
	}
}
