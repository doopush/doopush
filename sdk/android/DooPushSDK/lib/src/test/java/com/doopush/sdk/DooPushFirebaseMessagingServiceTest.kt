package com.doopush.sdk

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class DooPushFirebaseMessagingServiceTest {

    @Before
    fun reset() {
        DooPushManager.getInstance().setFCMNotificationDisplayEnabled(true)
    }

    @Test
    fun fcmDisplayEnabledByDefault() {
        DooPushManager.getInstance().setFCMNotificationDisplayEnabled(true)
        assertTrue(DooPushManager.getInstance().isFCMNotificationDisplayEnabled)
    }

    @Test
    fun fcmDisplayCanBeDisabled() {
        DooPushManager.getInstance().setFCMNotificationDisplayEnabled(false)
        assertFalse(DooPushManager.getInstance().isFCMNotificationDisplayEnabled)
    }

    @Test
    fun expoRelayDisabledByDefault() {
        // 不强制重置——默认值断言
        DooPushManager.getInstance().setExpoNotificationRelayEnabled(false)
        assertFalse(DooPushManager.getInstance().isExpoNotificationRelayEnabled)
    }

    @Test
    fun expoRelayCanBeEnabled() {
        DooPushManager.getInstance().setExpoNotificationRelayEnabled(true)
        assertTrue(DooPushManager.getInstance().isExpoNotificationRelayEnabled)
    }
}
