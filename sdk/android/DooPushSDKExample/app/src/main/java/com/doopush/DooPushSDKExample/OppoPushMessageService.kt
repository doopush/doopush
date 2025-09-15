package com.doopush.DooPushSDKExample

import android.content.Context
import com.doopush.sdk.OppoPushReceiver
import com.heytap.msp.push.mode.DataMessage
import com.heytap.msp.push.service.CompatibleDataMessageCallbackService
import org.json.JSONObject

/**
 * OPPO/OnePlus 透传消息回调服务
 * 将 Heytap SDK 的 DataMessage 转为 SDK 统一格式，转交给 OppoPushReceiver
 */
class OppoPushMessageService : CompatibleDataMessageCallbackService() {

    override fun processMessage(context: Context, message: DataMessage) {
        super.processMessage(context.applicationContext, message)

        // 将消息简化为统一 JSON，必要字段可按需扩展
        val json = JSONObject().apply {
            put("title", message.title ?: "")
            put("content", message.content ?: "")
            // 可根据业务把 message.extra / message.contentExtra 等附加进来
        }.toString()

        OppoPushReceiver.onReceiveMessage(context.applicationContext, 0, json)
    }
}


