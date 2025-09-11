package com.doopush.DooPushSDKExample

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.DialogInterface
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.doopush.DooPushSDKExample.adapters.PushHistoryAdapter
import com.doopush.DooPushSDKExample.databinding.ActivityPushHistoryBinding
import com.doopush.DooPushSDKExample.models.PushHistoryItem
import com.doopush.DooPushSDKExample.utils.PushHistoryManager
import kotlinx.coroutines.launch

/**
 * 推送历史页面
 * 
 * 显示接收到的所有推送消息历史记录
 */
class PushHistoryActivity : AppCompatActivity(), PushHistoryManager.HistoryListener {
    
    companion object {
        private const val TAG = "PushHistoryActivity"
    }
    
    private lateinit var binding: ActivityPushHistoryBinding
    private lateinit var historyManager: PushHistoryManager
    private lateinit var adapter: PushHistoryAdapter
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        binding = ActivityPushHistoryBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        // 初始化组件
        initViews()
        initRecyclerView()
        
        // 获取历史管理器
        historyManager = PushHistoryManager.getInstance(this)
        historyManager.addListener(this)
        
        // 加载数据
        loadHistoryData()
        
        Log.d(TAG, "PushHistoryActivity 创建完成")
    }
    
    /**
     * 初始化视图
     */
    private fun initViews() {
        // 设置工具栏
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
        
        // 刷新按钮
        binding.btnRefresh.setOnClickListener {
            refreshData()
        }
        
        // 清空历史按钮
        binding.btnClearHistory.setOnClickListener {
            showClearHistoryDialog()
        }
        
        // 下拉刷新
        binding.swipeRefreshLayout.setOnRefreshListener {
            refreshData()
        }
        
        // 设置刷新颜色
        binding.swipeRefreshLayout.setColorSchemeResources(
            R.color.colorPrimary,
            R.color.colorSecondary
        )
    }
    
    /**
     * 初始化RecyclerView
     */
    private fun initRecyclerView() {
        adapter = PushHistoryAdapter(
            onItemClick = { item ->
                onHistoryItemClick(item)
            },
            onItemLongClick = { item ->
                onHistoryItemLongClick(item)
            }
        )
        
        binding.recyclerView.layoutManager = LinearLayoutManager(this)
        binding.recyclerView.adapter = adapter
        
        // 添加分隔线
        val dividerItemDecoration = androidx.recyclerview.widget.DividerItemDecoration(
            this,
            LinearLayoutManager.VERTICAL
        )
        binding.recyclerView.addItemDecoration(dividerItemDecoration)
    }
    
    /**
     * 加载历史数据
     */
    private fun loadHistoryData() {
        showLoading(true)
        
        lifecycleScope.launch {
            try {
                val historyList = historyManager.getAllHistory()
                
                runOnUiThread {
                    adapter.submitList(historyList) {
                        showLoading(false)
                        updateStatistics()
                        updateEmptyState(historyList.isEmpty())
                    }
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "加载历史数据失败", e)
                runOnUiThread {
                    showLoading(false)
                    showToast("加载历史数据失败: ${e.message}")
                }
            }
        }
    }
    
    /**
     * 刷新数据
     */
    private fun refreshData() {
        Log.d(TAG, "刷新推送历史数据")
        loadHistoryData()
    }
    
    /**
     * 显示清空历史确认对话框
     */
    private fun showClearHistoryDialog() {
        AlertDialog.Builder(this)
            .setTitle("清空历史记录")
            .setMessage("确定要清空所有推送历史记录吗？此操作不可撤销。")
            .setPositiveButton("确定") { _, _ ->
                clearAllHistory()
            }
            .setNegativeButton("取消", null)
            .show()
    }
    
    /**
     * 清空所有历史记录
     */
    private fun clearAllHistory() {
        historyManager.clearAllHistory()
        showToast("历史记录已清空")
        Log.d(TAG, "推送历史记录已清空")
    }
    
    /**
     * 历史记录项点击事件
     */
    private fun onHistoryItemClick(item: PushHistoryItem) {
        Log.d(TAG, "点击推送历史项: ${item.getDisplayTitle()}")
        
        // 标记为已点击
        historyManager.markAsClicked(item.id)
        
        // 这里可以添加更多点击处理逻辑，比如显示详情对话框
        showItemDetailDialog(item)
    }
    
    /**
     * 历史记录项长按事件
     */
    private fun onHistoryItemLongClick(item: PushHistoryItem) {
        Log.d(TAG, "长按推送历史项: ${item.getDisplayTitle()}")
        
        // 显示操作选项
        showItemActionDialog(item)
    }
    
    /**
     * 显示推送项详情对话框
     */
    private fun showItemDetailDialog(item: PushHistoryItem) {
        AlertDialog.Builder(this)
            .setTitle(getString(R.string.history_detail_title))
            .setMessage(item.getExtendedInfo())
            .setPositiveButton("关闭", null)
            .setNeutralButton("复制详情") { _, _ ->
                copyToClipboard("推送详情", item.getExtendedInfo())
            }
            .show()
    }
    
    /**
     * 显示推送项操作对话框
     */
    private fun showItemActionDialog(item: PushHistoryItem) {
        val actions = arrayOf("复制标题", "复制内容", "复制推送ID", "复制详情", "分享")
        
        AlertDialog.Builder(this)
            .setTitle("选择操作")
            .setItems(actions) { _, which ->
                when (which) {
                    0 -> copyToClipboard("推送标题", item.getDisplayTitle())
                    1 -> copyToClipboard("推送内容", item.getDisplayBody())
                    2 -> copyToClipboard("推送ID", item.pushLogId ?: "无")
                    3 -> copyToClipboard("推送详情", item.getExtendedInfo())
                    4 -> shareItem(item)
                }
            }
            .show()
    }
    
    /**
     * 复制到剪贴板
     */
    private fun copyToClipboard(label: String, text: String) {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText(label, text)
        clipboard.setPrimaryClip(clip)
        showToast("已复制到剪贴板")
    }
    
    /**
     * 分享推送项
     */
    private fun shareItem(item: PushHistoryItem) {
        val shareText = """
            推送消息详情
            
            标题: ${item.getDisplayTitle()}
            内容: ${item.getDisplayBody()}
            时间: ${item.getFormattedDateTime()}
            推送ID: ${item.pushLogId ?: "无"}
            状态: ${item.status.displayName}
        """.trimIndent()
        
        val shareIntent = android.content.Intent().apply {
            action = android.content.Intent.ACTION_SEND
            type = "text/plain"
            putExtra(android.content.Intent.EXTRA_TEXT, shareText)
        }
        
        startActivity(android.content.Intent.createChooser(shareIntent, "分享推送详情"))
    }
    
    /**
     * 更新统计信息
     */
    private fun updateStatistics() {
        val statistics = historyManager.getStatistics()
        
        binding.tvTotalCount.text = statistics.totalCount.toString()
        binding.tvTodayCount.text = statistics.todayCount.toString()
        binding.tvLastTime.text = statistics.lastPushTime ?: "--:--"
    }
    
    /**
     * 更新空状态显示
     */
    private fun updateEmptyState(isEmpty: Boolean) {
        binding.layoutEmpty.visibility = if (isEmpty) View.VISIBLE else View.GONE
        binding.recyclerView.visibility = if (isEmpty) View.GONE else View.VISIBLE
    }
    
    /**
     * 显示/隐藏加载状态
     */
    private fun showLoading(show: Boolean) {
        if (show) {
            binding.layoutLoading.visibility = View.VISIBLE
            binding.layoutEmpty.visibility = View.GONE
            binding.recyclerView.visibility = View.GONE
        } else {
            binding.layoutLoading.visibility = View.GONE
            binding.swipeRefreshLayout.isRefreshing = false
        }
    }
    
    /**
     * 显示Toast消息
     */
    private fun showToast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }
    
    // PushHistoryManager.HistoryListener 实现
    
    override fun onHistoryAdded(item: PushHistoryItem) {
        runOnUiThread {
            Log.d(TAG, "新推送消息添加到历史: ${item.getDisplayTitle()}")
            loadHistoryData()
        }
    }
    
    override fun onHistoryUpdated(items: List<PushHistoryItem>) {
        runOnUiThread {
            Log.d(TAG, "推送历史更新: ${items.size} 条记录")
            adapter.submitList(items) {
                updateStatistics()
                updateEmptyState(items.isEmpty())
            }
        }
    }
    
    override fun onHistoryCleared() {
        runOnUiThread {
            Log.d(TAG, "推送历史已清空")
            adapter.submitList(emptyList()) {
                updateStatistics()
                updateEmptyState(true)
            }
        }
    }
    
    override fun onResume() {
        super.onResume()
        // 页面恢复时刷新统计信息
        updateStatistics()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        
        // 移除监听器
        if (::historyManager.isInitialized) {
            historyManager.removeListener(this)
        }
        
        Log.d(TAG, "PushHistoryActivity 销毁")
    }
}
