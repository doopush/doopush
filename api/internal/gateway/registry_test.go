package gateway

import (
	"sync"
	"testing"
	"time"
)

// fakeConn 满足 closer 接口，记录 Close 调用
type fakeConn struct {
	mu     sync.Mutex
	closed bool
	code   int
	reason string
	done   chan struct{}
}

func newFakeConn() *fakeConn {
	return &fakeConn{done: make(chan struct{})}
}

func (f *fakeConn) CloseWith(code int, reason string) {
	f.mu.Lock()
	f.closed = true
	f.code = code
	f.reason = reason
	f.mu.Unlock()
	close(f.done)
}

func (f *fakeConn) snapshot() (bool, int, string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.closed, f.code, f.reason
}

func TestRegistry_Register_NewToken(t *testing.T) {
	reg := newRegistry()
	c := newFakeConn()
	reg.register("tok1", c)
	if got := reg.get("tok1"); got != c {
		t.Fatalf("expected stored conn")
	}
}

func TestRegistry_Register_KicksOld(t *testing.T) {
	reg := newRegistry()
	old := newFakeConn()
	reg.register("tok1", old)
	newC := newFakeConn()
	reg.register("tok1", newC)

	select {
	case <-old.done:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for old conn to be closed")
	}

	closed, code, reason := old.snapshot()
	if !closed || code != 4001 || reason != "replaced by new connection" {
		t.Fatalf("old conn close mismatch: closed=%v code=%d reason=%q", closed, code, reason)
	}
	if reg.get("tok1") != newC {
		t.Fatalf("registry should now hold new conn")
	}
}

func TestRegistry_Unregister_OnlyIfMatches(t *testing.T) {
	reg := newRegistry()
	c1 := newFakeConn()
	reg.register("tok1", c1)
	// 不同实例 unregister 返回 false 且 registry 不变
	c2 := newFakeConn()
	if reg.unregister("tok1", c2) {
		t.Fatalf("unregister with non-matching conn should return false")
	}
	if reg.get("tok1") != c1 {
		t.Fatalf("registry should still hold c1")
	}
	// 不存在的 token unregister 也是 false
	if reg.unregister("no-such-token", c1) {
		t.Fatalf("unregister for missing token should return false")
	}
	// 同实例可以 unregister，返回 true
	if !reg.unregister("tok1", c1) {
		t.Fatalf("unregister with matching conn should return true")
	}
	if reg.get("tok1") != nil {
		t.Fatalf("registry should be empty after matching unregister")
	}
}
