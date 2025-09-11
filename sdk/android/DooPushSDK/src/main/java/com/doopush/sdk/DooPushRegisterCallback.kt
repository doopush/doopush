package com.doopush.sdk

import com.doopush.sdk.models.DooPushError

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
     * 注册失败
     * 
     * @param error 错误信息
     */
    fun onError(error: DooPushError)
}
