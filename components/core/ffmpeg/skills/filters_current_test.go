package skills

import "testing"

func TestCurrentAndLegacyFilterColumns(t *testing.T) {
	for _, flags := range []string{"..", ".S", "TS", "...", ".S.", "TSC"} {
		filters := parseFilters([]byte("Filters:\n  T.. = Timeline support\n  ------\n " + flags + " transpose         V->V       Transpose input video.\n"))
		if len(filters) != 1 || filters[0].Id != "transpose" || filters[0].Name != "Transpose input video." {
			t.Fatalf("flags %q: %+v", flags, filters)
		}
	}
}
