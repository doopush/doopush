package gateway

import "sync"

// closer 抽象任何能被以 close code + reason 关闭的连接
type closer interface {
	CloseWith(code int, reason string)
}

// registry 维护 token → 连接的进程内单例映射
type registry struct {
	mu sync.Mutex
	m  map[string]closer
}

func newRegistry() *registry {
	return &registry{m: make(map[string]closer)}
}

// register 注册新连接；若同 token 已有旧连接，先用 4001 关掉
func (r *registry) register(token string, c closer) {
	r.mu.Lock()
	old, ok := r.m[token]
	r.m[token] = c
	r.mu.Unlock()
	if ok {
		// 异步关闭，避免持锁
		go old.CloseWith(4001, "replaced by new connection")
	}
}

// unregister 仅当当前注册项就是 c 时才删除；返回 true 表示真删了
// （被挤掉的老连解锁清理时会走到这里，但 registry 已被替换为新连，
//   返回 false 让上层跳过 MarkOffline，避免清掉新连的在线态）
func (r *registry) unregister(token string, c closer) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if cur, ok := r.m[token]; ok && cur == c {
		delete(r.m, token)
		return true
	}
	return false
}

// get 主要给测试用
func (r *registry) get(token string) closer {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.m[token]
}

// closeAll 主动关闭所有当前注册的连接（用于 server shutdown）
// 不持锁调用 CloseWith，避免与连接自身的 unregister 形成锁顺序问题
func (r *registry) closeAll(code int, reason string) {
	r.mu.Lock()
	conns := make([]closer, 0, len(r.m))
	for _, c := range r.m {
		conns = append(conns, c)
	}
	r.mu.Unlock()
	for _, c := range conns {
		c.CloseWith(code, reason)
	}
}
