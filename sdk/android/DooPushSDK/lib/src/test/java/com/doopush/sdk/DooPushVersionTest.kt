package com.doopush.sdk

import org.junit.Assert.assertEquals
import org.junit.Test

class DooPushVersionTest {

    @Test
    fun runtimeIdentifiersUseBuildVersion() {
        assertEquals(BuildConfig.SDK_VERSION, DooPushDevice.SDK_VERSION)
        assertEquals("DooPush-Android-SDK/${BuildConfig.SDK_VERSION}", DooPushDevice.SDK_USER_AGENT)
    }
}
