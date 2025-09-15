package com.doopush.sdk

import com.doopush.sdk.models.DooPushError

/**
 * FCM Token 获取回调接口
 */
interface DooPushTokenCallback {
    /**
     * Token获取成功
     * 
     * @param token FCM注册令牌
     */
    fun onSuccess(token: String)
    
    /**
     * Token获取失败
     * 
     * @param error 错误信息
     */
    fun onError(error: DooPushError)
}
