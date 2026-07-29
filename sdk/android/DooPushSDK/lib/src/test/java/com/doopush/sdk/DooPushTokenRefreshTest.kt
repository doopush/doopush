package com.doopush.sdk

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
class DooPushTokenRefreshTest {

    @Test
    fun refreshedFcmTokenUpdatesExistingDeviceById() {
        val server = MockWebServer()
        server.enqueue(MockResponse().setResponseCode(200).setBody("{\"code\":200,\"message\":\"成功\"}"))
        server.start()

        try {
            val manager = DooPushManager.getInstance()
            manager.configure(
                RuntimeEnvironment.getApplication(),
                appId = "test-app",
                apiKey = "test_api_key_1234",
                baseURL = server.url("/api/v1").toString()
            )

            setPrivateField(manager, "cachedToken", "old-token")
            setPrivateField(manager, "cachedDeviceId", "42")
            invokePrivate(
                manager,
                "persistRegistration",
                arrayOf<Class<*>>(String::class.java, String::class.java, String::class.java),
                arrayOf<Any>("old-token", "42", "fcm")
            )

            invokePrivate(
                manager,
                "handleTokenRefresh",
                arrayOf<Class<*>>(String::class.java),
                arrayOf<Any>("new-token")
            )

            val request = server.takeRequest(5, TimeUnit.SECONDS)
                ?: error("Token refresh request was not sent")
            assertEquals("PUT", request.method)
            assertEquals("/api/v1/apps/test-app/devices/42/token", request.path)
            assertTrue(request.body.readUtf8().contains("\"token\":\"new-token\""))
        } finally {
            server.shutdown()
        }
    }

    private fun setPrivateField(target: Any, name: String, value: Any?) {
        target.javaClass.getDeclaredField(name).apply {
            isAccessible = true
            set(target, value)
        }
    }

    private fun invokePrivate(
        target: Any,
        name: String,
        parameterTypes: Array<Class<*>>,
        args: Array<Any>
    ) {
        target.javaClass.getDeclaredMethod(name, *parameterTypes).apply {
            isAccessible = true
            invoke(target, *args)
        }
    }
}
