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
}

func (f *fakeConn) CloseWith(code int, reason string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.closed = true
	f.code = code
	f.reason = reason
}

func TestRegistry_Register_NewToken(t *testing.T) {
	reg := newRegistry()
	c := &fakeConn{}
	reg.register("tok1", c)
	if got := reg.get("tok1"); got != c {
		t.Fatalf("expected stored conn")
	}
}

func TestRegistry_Register_KicksOld(t *testing.T) {
	reg := newRegistry()
	old := &fakeConn{}
	reg.register("tok1", old)
	newC := &fakeConn{}
	reg.register("tok1", newC)

	time.Sleep(10 * time.Millisecond) // allow async close goroutine to run

	if !old.closed || old.code != 4001 {
		t.Fatalf("old conn should be closed with 4001, got closed=%v code=%d", old.closed, old.code)
	}
	if reg.get("tok1") != newC {
		t.Fatalf("registry should now hold new conn")
	}
}

func TestRegistry_Unregister_OnlyIfMatches(t *testing.T) {
	reg := newRegistry()
	c1 := &fakeConn{}
	reg.register("tok1", c1)
	// 不同实例 unregister 返回 false 且 registry 不变
	c2 := &fakeConn{}
	if reg.unregister("tok1", c2) {
		t.Fatalf("unregister with non-matching conn should return false")
	}
	if reg.get("tok1") != c1 {
		t.Fatalf("registry should still hold c1")
	}
	// 同实例可以 unregister，返回 true
	if !reg.unregister("tok1", c1) {
		t.Fatalf("unregister with matching conn should return true")
	}
	if reg.get("tok1") != nil {
		t.Fatalf("registry should be empty after matching unregister")
	}
}
