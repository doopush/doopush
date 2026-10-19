package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestUploadsSecurityHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	dir := t.TempDir()
	for _, name := range []string{"a.svg", "b.png"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	r := gin.New()
	r.Group("/uploads", UploadsSecurityHeaders()).Static("/", dir)

	for name, wantCSP := range map[string]bool{"a.svg": true, "b.png": false} {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/uploads/"+name, nil))
		if w.Code != http.StatusOK {
			t.Fatalf("%s: status %d", name, w.Code)
		}
		if got := w.Header().Get("X-Content-Type-Options"); got != "nosniff" {
			t.Fatalf("%s: nosniff = %q", name, got)
		}
		if got := w.Header().Get("Content-Security-Policy"); (got == uploadSVGCSP) != wantCSP || (!wantCSP && got != "") {
			t.Fatalf("%s: csp = %q", name, got)
		}
	}
}
