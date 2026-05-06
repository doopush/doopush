package com.doopush.sdk

import org.junit.Assert.assertEquals
import org.junit.Test

class DooPushWebSocketConnectionTest {

    @Test
    fun wsUrlFromBase_strips_path_and_uses_wss_for_https() {
        assertEquals(
            "wss://doopush.com/ws",
            DooPushWebSocketConnection.wsUrlFromBase("https://doopush.com/api/v1")
        )
    }

    @Test
    fun wsUrlFromBase_uses_ws_for_http() {
        assertEquals(
            "ws://localhost:8080/ws",
            DooPushWebSocketConnection.wsUrlFromBase("http://localhost:8080")
        )
    }

    @Test
    fun wsUrlFromBase_preserves_port() {
        assertEquals(
            "wss://gw.example.com:8443/ws",
            DooPushWebSocketConnection.wsUrlFromBase("https://gw.example.com:8443/some/path")
        )
    }

    @Test
    fun wsUrlFromBase_handles_trailing_slash() {
        assertEquals(
            "wss://doopush.com/ws",
            DooPushWebSocketConnection.wsUrlFromBase("https://doopush.com/")
        )
    }
}
