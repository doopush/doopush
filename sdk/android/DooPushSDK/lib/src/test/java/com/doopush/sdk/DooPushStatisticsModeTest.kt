package com.doopush.sdk

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class DooPushStatisticsModeTest {

    @After
    fun tearDown() {
        DooPushStatistics.clearQueue()
        val field = DooPushStatistics::class.java.getDeclaredField("reportingEnabled")
        field.isAccessible = true
        field.setBoolean(DooPushStatistics, true)
    }

    @Test
    fun disabledReportingDropsNotificationEvents() {
        DooPushStatistics.disableReporting()

        DooPushStatistics.recordNotificationReceived(
            DooPushNotificationHandler.NotificationData(
                pushLogId = "push-1",
                dedupKey = "dedup-1",
            )
        )

        assertFalse(DooPushStatistics.isReportingEnabled())
        assertEquals(0, DooPushStatistics.getQueueSize())
    }
}
