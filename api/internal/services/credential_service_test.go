package services

import (
	"reflect"
	"testing"

	"github.com/doopush/doopush/api/internal/models"
)

func TestNormalizeScopes(t *testing.T) {
	got, err := normalizeScopes([]string{models.ScopePushSend, models.ScopePushBroadcast, models.ScopePushSend})
	if err != nil {
		t.Fatalf("normalizeScopes returned error: %v", err)
	}
	want := models.StringList{models.ScopePushBroadcast, models.ScopePushSend}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("normalizeScopes() = %#v, want %#v", got, want)
	}
}

func TestNormalizeScopesRejectsUnknownAndEmpty(t *testing.T) {
	if _, err := normalizeScopes(nil); err == nil {
		t.Fatal("expected empty scopes to be rejected")
	}
	if _, err := normalizeScopes([]string{"app:delete"}); err == nil {
		t.Fatal("expected unknown scope to be rejected")
	}
}

func TestNormalizeScopesAddsPushSendForDependentScopes(t *testing.T) {
	tests := []struct {
		name   string
		scopes []string
		want   models.StringList
	}{
		{
			name:   "broadcast",
			scopes: []string{models.ScopePushBroadcast},
			want:   models.StringList{models.ScopePushBroadcast, models.ScopePushSend},
		},
		{
			name:   "schedule",
			scopes: []string{models.ScopePushSchedule},
			want:   models.StringList{models.ScopePushSchedule, models.ScopePushSend},
		},
		{
			name:   "both",
			scopes: []string{models.ScopePushSchedule, models.ScopePushBroadcast},
			want:   models.StringList{models.ScopePushBroadcast, models.ScopePushSchedule, models.ScopePushSend},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := normalizeScopes(tt.scopes)
			if err != nil {
				t.Fatalf("normalizeScopes returned error: %v", err)
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("normalizeScopes() = %#v, want %#v", got, tt.want)
			}
		})
	}
}

func TestCredentialPrefixes(t *testing.T) {
	if models.AppKeyPrefix != "dp_ak_" {
		t.Fatalf("unexpected App Key prefix: %q", models.AppKeyPrefix)
	}
	if models.AppSecretPrefix != "dp_as_" {
		t.Fatalf("unexpected App Secret prefix: %q", models.AppSecretPrefix)
	}
}
