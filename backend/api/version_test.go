package api

import "testing"

func TestDefaultVersionFromRepoVersionFile(t *testing.T) {
	version := defaultVersion()
	if version == "" || version == "dev" {
		t.Fatalf("default version = %q, want the VERSION file content", version)
	}
	if len(version) > 0 && (version[0] == 'v' || version[0] == 'V') {
		t.Fatalf("version keeps its v-prefix, want bare x.y.z: %q", version)
	}
}
