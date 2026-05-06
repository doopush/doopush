package com.doopush.sdk

import org.junit.Assert.assertFalse
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment

/**
 * 验证：当厂商 appId/appKey 为空字符串时（plugin 未启用该厂商），
 * 厂商 service 的 initialize / autoInitialize 必须 noop（返回 false），
 * 不抛异常、不向厂商 SDK 注册。
 */
@RunWith(RobolectricTestRunner::class)
class VendorServiceNoopTest {

    private val ctx get() = RuntimeEnvironment.getApplication()

    @Test
    fun xiaomiInitializeWithEmptyConfigNoops() {
        val svc = XiaomiService(ctx)
        assertFalse("空 appId/appKey 时不应初始化", svc.initialize("", ""))
    }

    @Test
    fun oppoInitializeWithEmptyConfigNoops() {
        val svc = OppoService(ctx)
        assertFalse(svc.initialize("", ""))
    }

    @Test
    fun vivoInitializeWithEmptyConfigNoops() {
        val svc = VivoService(ctx)
        assertFalse(svc.initialize("", ""))
    }

    @Test
    fun meizuInitializeWithEmptyConfigNoops() {
        val svc = MeizuService(ctx)
        assertFalse(svc.initialize("", ""))
    }

    @Test
    fun honorEmptyConfigIsInvalid() {
        // Honor 通过 HonorConfig.isValid() 已有的 || 链已经天然返回 false——这里加测试做契约保障
        val emptyConfig = DooPushConfig.HonorConfig(
            clientId = "", clientSecret = "", appId = "", developerId = ""
        )
        assertFalse("全空 HonorConfig 应判定为 invalid", emptyConfig.isValid())
    }
}
