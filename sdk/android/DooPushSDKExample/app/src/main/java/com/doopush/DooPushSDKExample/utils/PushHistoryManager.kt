package com.doopush.DooPushSDKExample.utils

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.doopush.DooPushSDKExample.models.PushHistoryItem
import com.doopush.sdk.models.PushMessage
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.*
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * 推送历史管理器
 * 
 * 负责推送消息的本地存储和管理
 */
class PushHistoryManager private constructor(private val context: Context) {
    
    companion object {
        private const val TAG = "PushHistoryManager"
        private const val PREFS_NAME = "doopush_history"
        private const val KEY_PUSH_HISTORY = "push_history"
        private const val MAX_HISTORY_SIZE = 1000 // 最多保存1000条记录
        
        @Volatile
        private var instance: PushHistoryManager? = null
        
        fun getInstance(context: Context): PushHistoryManager {
            return instance ?: synchronized(this) {
                instance ?: PushHistoryManager(context.applicationContext).also { instance = it }
            }
        }
    }
    
    private val prefs: SharedPreferences by lazy {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
    
    private val gson = Gson()
    private val historyQueue = ConcurrentLinkedQueue<PushHistoryItem>()
    private val listeners = mutableSetOf<HistoryListener>()
    
    // 协程作用域
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    init {
        // 初始化时加载历史记录
        loadHistoryFromStorage()
    }
    
    /**
     * 历史记录变化监听器
     */
    interface HistoryListener {
        fun onHistoryAdded(item: PushHistoryItem)
        fun onHistoryUpdated(items: List<PushHistoryItem>)
        fun onHistoryCleared()
    }
    
    /**
     * 添加监听器
     */
    fun addListener(listener: HistoryListener) {
        listeners.add(listener)
    }
    
    /**
     * 移除监听器
     */
    fun removeListener(listener: HistoryListener) {
        listeners.remove(listener)
    }
    
    /**
     * 添加推送消息到历史记录
     */
    fun addPushMessage(message: PushMessage) {
        scope.launch {
            try {
                val historyItem = PushHistoryItem.fromPushMessage(message)
                
                // 检查是否已存在（基于dedup_key）
                val existingItem = historyQueue.find { 
                    it.dedupKey == historyItem.dedupKey && !historyItem.dedupKey.isNullOrEmpty()
                }
                
                if (existingItem != null) {
                    Log.d(TAG, "推送消息已存在，跳过添加: ${historyItem.dedupKey}")
                    return@launch
                }
                
                // 添加到队列头部
                historyQueue.add(historyItem)
                
                // 限制历史记录数量
                while (historyQueue.size > MAX_HISTORY_SIZE) {
                    historyQueue.poll()
                }
                
                // 保存到存储
                saveHistoryToStorage()
                
                // 通知监听器
                withContext(Dispatchers.Main) {
                    listeners.forEach { it.onHistoryAdded(historyItem) }
                }
                
                Log.d(TAG, "推送消息已添加到历史记录: ${historyItem.getDisplayTitle()}")
                
            } catch (e: Exception) {
                Log.e(TAG, "添加推送消息到历史记录失败", e)
            }
        }
    }
    
    /**
     * 获取所有历史记录
     */
    suspend fun getAllHistory(): List<PushHistoryItem> = withContext(Dispatchers.IO) {
        return@withContext historyQueue.sortedByDescending { it.receivedAt }
    }
    
    /**
     * 获取所有历史记录（同步版本，用于UI）
     */
    fun getAllHistorySync(): List<PushHistoryItem> {
        return historyQueue.sortedByDescending { it.receivedAt }
    }
    
    /**
     * 根据ID获取历史记录
     */
    suspend fun getHistoryById(id: String): PushHistoryItem? = withContext(Dispatchers.IO) {
        return@withContext historyQueue.find { it.id == id }
    }
    
    /**
     * 更新历史记录项
     */
    fun updateHistoryItem(updatedItem: PushHistoryItem) {
        scope.launch {
            try {
                // 从队列中移除旧项并添加新项
                val iterator = historyQueue.iterator()
                while (iterator.hasNext()) {
                    val item = iterator.next()
                    if (item.id == updatedItem.id) {
                        iterator.remove()
                        break
                    }
                }
                
                historyQueue.add(updatedItem)
                
                // 保存到存储
                saveHistoryToStorage()
                
                // 通知监听器
                withContext(Dispatchers.Main) {
                    listeners.forEach { it.onHistoryUpdated(getAllHistorySync()) }
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "更新历史记录失败", e)
            }
        }
    }
    
    /**
     * 标记消息为已点击
     */
    fun markAsClicked(id: String) {
        scope.launch {
            val item = historyQueue.find { it.id == id }
            if (item != null) {
                val updatedItem = item.updateStatus(PushHistoryItem.PushStatus.CLICKED)
                    .copy(isRead = true)
                updateHistoryItem(updatedItem)
                Log.d(TAG, "推送消息已标记为已点击: $id")
            }
        }
    }
    
    /**
     * 清空所有历史记录
     */
    fun clearAllHistory() {
        scope.launch {
            try {
                historyQueue.clear()
                saveHistoryToStorage()
                
                withContext(Dispatchers.Main) {
                    listeners.forEach { it.onHistoryCleared() }
                }
                
                Log.d(TAG, "所有推送历史记录已清空")
                
            } catch (e: Exception) {
                Log.e(TAG, "清空历史记录失败", e)
            }
        }
    }
    
    /**
     * 获取统计信息
     */
    data class Statistics(
        val totalCount: Int,
        val todayCount: Int,
        val unreadCount: Int,
        val lastPushTime: String?
    )
    
    fun getStatistics(): Statistics {
        val allHistory = getAllHistorySync()
        return Statistics(
            totalCount = allHistory.size,
            todayCount = allHistory.count { it.isToday() },
            unreadCount = allHistory.count { !it.isRead },
            lastPushTime = allHistory.maxByOrNull { it.receivedAt }?.getFormattedDateTime()
        )
    }
    
    /**
     * 从存储加载历史记录
     */
    private fun loadHistoryFromStorage() {
        try {
            val historyJson = prefs.getString(KEY_PUSH_HISTORY, null)
            if (!historyJson.isNullOrEmpty()) {
                val listType = object : TypeToken<List<PushHistoryItem>>() {}.type
                val historyList: List<PushHistoryItem> = gson.fromJson(historyJson, listType)
                
                historyQueue.clear()
                historyQueue.addAll(historyList)
                
                Log.d(TAG, "从存储加载了 ${historyList.size} 条历史记录")
            }
        } catch (e: Exception) {
            Log.e(TAG, "加载历史记录失败", e)
        }
    }
    
    /**
     * 保存历史记录到存储
     */
    private fun saveHistoryToStorage() {
        try {
            val historyList = historyQueue.sortedByDescending { it.receivedAt }
            val historyJson = gson.toJson(historyList)
            prefs.edit().putString(KEY_PUSH_HISTORY, historyJson).apply()
            
            Log.d(TAG, "已保存 ${historyList.size} 条历史记录到存储")
            
        } catch (e: Exception) {
            Log.e(TAG, "保存历史记录失败", e)
        }
    }
    
    /**
     * 释放资源
     */
    fun destroy() {
        scope.cancel()
        listeners.clear()
        Log.d(TAG, "PushHistoryManager 已销毁")
    }
}
