package com.doopush.sdk

import com.doopush.sdk.models.DooPushError

/**
 * DooPush 配置异常
 */
class DooPushConfigException(
    val error: DooPushError
) : Exception(error.message) {
    
    constructor(code: Int, message: String, details: String? = null) 
            : this(DooPushError(code, message, details))
}
