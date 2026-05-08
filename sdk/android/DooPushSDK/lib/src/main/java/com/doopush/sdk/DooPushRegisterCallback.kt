package com.doopush.sdk

import com.doopush.sdk.models.DooPushError

/**
 * 推送注册成功结果。
 *
 * v1.2+ 新增 deviceId/vendor 字段，用于上层 bridge（React Native / Expo）
 * 在一次 register 调用里拿到服务端设备 ID。保留旧的 onSuccess(token)
 * 回调以兼容既有 Android 原生调用方。
 */
data class DooPushRegisterResult(
    val token: String,
    val deviceId: String,
    val vendor: String
)

/**
 * 推送注册回调接口
 */
interface DooPushRegisterCallback {
    /**
     * 注册成功
     * 
     * @param token 注册成功后获得的推送令牌
     */
    fun onSuccess(token: String)

    /**
     * 注册成功（包含服务端设备 ID 和推送通道）。
     *
     * 默认委托给旧版 onSuccess(token)，保持源码兼容。SDK v1.2+ 的内部
     * 注册链路会优先调用该重载；如果实现类同时覆盖两个 onSuccess，
     * 正常情况下只会进入该 result 重载，不会再额外调用 token 重载。
     */
    fun onSuccess(result: DooPushRegisterResult) {
        onSuccess(result.token)
    }
    
    /**
     * 注册失败
     * 
     * @param error 错误信息
     */
    fun onError(error: DooPushError)
}
