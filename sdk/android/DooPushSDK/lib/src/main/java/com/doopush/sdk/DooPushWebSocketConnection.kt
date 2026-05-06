package com.doopush.sdk

import android.util.Log
import okhttp3.*
import okio.ByteString
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 维护设备到平台的 WebSocket 长连接。
 *
 * 仅承担：
 *   1. 建连后向平台标记设备在线（握手 query 鉴权）
 *   2. 30s 周期 Ping 维持心跳
 *   3. 断线指数退避重连
 *
 * 不再承载任何应用层消息。
 */
class DooPushWebSocketConnection(
    private val baseUrl: String,
    private val appId: String,
    private val appKey: String,
    private val token: String,
    private val listener: Listener,
) {
    interface Listener {
        fun onOpen()
        fun onClosed(code: Int, reason: String)
        fun onFailure(t: Throwable)
    }

    private val client: OkHttpClient = OkHttpClient.Builder()
        .pingInterval(30, TimeUnit.SECONDS)  // OkHttp 自动发 Ping
        .build()

    @Volatile
    private var ws: WebSocket? = null
    private val active = AtomicBoolean(false)
    @Volatile
    private var reconnectDelayMs = 1_000L
    @Volatile
    private var openSinceMs: Long = 0L
    private val maxReconnectMs = 15_000L
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    fun connect() {
        if (active.getAndSet(true)) return
        doConnect()
    }

    fun disconnect() {
        active.set(false)
        ws?.close(1000, "client disconnect")
        ws = null
    }

    private fun doConnect() {
        val wsUrl = wsUrlFromBase(baseUrl)
        val req = Request.Builder()
            .url("$wsUrl?appid=$appId&appkey=$appKey&token=$token")
            .build()
        ws = client.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i(TAG, "ws open")
                openSinceMs = System.currentTimeMillis()
                // 不再无条件重置 reconnectDelayMs，由 onClosed/onFailure 时基于稳定时长决定
                dispatch { listener.onOpen() }
            }

            override fun onMessage(webSocket: WebSocket, text: String) { /* 应用层消息预留，本期忽略 */ }
            override fun onMessage(webSocket: WebSocket, bytes: ByteString) { /* 同上 */ }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(code, reason)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.i(TAG, "ws closed code=$code reason=$reason")
                maybeResetBackoff()
                dispatch { listener.onClosed(code, reason) }
                if (shouldReconnect(code)) scheduleReconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.w(TAG, "ws failure: ${t.message}, http=${response?.code}")
                maybeResetBackoff()
                dispatch { listener.onFailure(t) }
                if (shouldReconnectOnFailure(response)) scheduleReconnect()
            }
        })
    }

    private fun shouldReconnect(code: Int): Boolean {
        if (!active.get()) return false
        // 不重连：1000/1001 正常关闭、4001 被新连挤掉
        // 重连：1008 (pong 超时，多半网络抖动)、其他异常
        return code != 4001 && code != 1000 && code != 1001
    }

    private fun shouldReconnectOnFailure(response: Response?): Boolean {
        if (!active.get()) return false
        // 鉴权失败 (HTTP 4xx) 不重连，由上层重新 register 拿新 token
        val httpCode = response?.code ?: 0
        if (httpCode in 400..499) return false
        return true
    }

    private fun dispatch(block: () -> Unit) {
        handler.post(block)
    }

    private fun maybeResetBackoff() {
        val openedFor = System.currentTimeMillis() - openSinceMs
        // 至少稳定 30s 才视为正常运行，重置退避
        if (openSinceMs > 0 && openedFor >= 30_000L) {
            reconnectDelayMs = 1_000L
        }
        openSinceMs = 0L
    }

    private fun scheduleReconnect() {
        val delay = reconnectDelayMs
        reconnectDelayMs = (reconnectDelayMs * 2).coerceAtMost(maxReconnectMs)
        handler.postDelayed({ if (active.get()) doConnect() }, delay)
    }

    companion object {
        private const val TAG = "DooPushWS"
        internal fun wsUrlFromBase(baseUrl: String): String {
            val uri = java.net.URI(baseUrl)
            val scheme = if (uri.scheme.equals("https", ignoreCase = true)) "wss" else "ws"
            // authority 包含 host[:port]；fallback 到 host 以应对边角输入
            val authority = uri.authority ?: uri.host ?: throw IllegalArgumentException("invalid baseUrl: $baseUrl")
            return "$scheme://$authority/ws"
        }
    }
}
