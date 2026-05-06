package gateway

import (
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestParseHandshakeParams_OK(t *testing.T) {
	r := httptest.NewRequest("GET", "/ws?appid=42&appkey=secret&token=abc", nil)
	p, err := parseHandshakeParams(r)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.AppID != 42 || p.AppKey != "secret" || p.Token != "abc" {
		t.Fatalf("got %+v", p)
	}
}

func TestParseHandshakeParams_Missing(t *testing.T) {
	cases := []url.Values{
		{"appkey": {"x"}, "token": {"y"}},
		{"appid": {"1"}, "token": {"y"}},
		{"appid": {"1"}, "appkey": {"x"}},
		{"appid": {"abc"}, "appkey": {"x"}, "token": {"y"}}, // 非数字 appid
	}
	for i, q := range cases {
		r := httptest.NewRequest("GET", "/ws?"+q.Encode(), nil)
		if _, err := parseHandshakeParams(r); err == nil {
			t.Fatalf("case %d expected error, got nil", i)
		}
	}
}
