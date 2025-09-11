package com.doopush.DooPushSDKExample.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.doopush.DooPushSDKExample.R
import com.doopush.DooPushSDKExample.databinding.ItemPushMessageBinding
import com.doopush.DooPushSDKExample.models.PushHistoryItem

/**
 * 推送历史列表适配器
 */
class PushHistoryAdapter(
    private val onItemClick: (PushHistoryItem) -> Unit = {},
    private val onItemLongClick: (PushHistoryItem) -> Unit = {}
) : ListAdapter<PushHistoryItem, PushHistoryAdapter.ViewHolder>(DiffCallback()) {

    companion object {
        private const val TAG = "PushHistoryAdapter"
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemPushMessageBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding, onItemClick, onItemLongClick)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class ViewHolder(
        private val binding: ItemPushMessageBinding,
        private val onItemClick: (PushHistoryItem) -> Unit,
        private val onItemLongClick: (PushHistoryItem) -> Unit
    ) : RecyclerView.ViewHolder(binding.root) {

        private var currentItem: PushHistoryItem? = null
        private var isExpanded = false

        init {
            // 点击事件
            binding.root.setOnClickListener {
                currentItem?.let { item ->
                    // 标记为已读
                    if (!item.isRead) {
                        item.markAsRead()
                        updateReadStatus()
                    }
                    
                    // 切换展开状态
                    toggleExpanded()
                    
                    onItemClick(item)
                }
            }

            // 长按事件
            binding.root.setOnLongClickListener {
                currentItem?.let { item ->
                    onItemLongClick(item)
                }
                true
            }
        }

        fun bind(item: PushHistoryItem) {
            currentItem = item

            // 设置基本信息
            binding.tvTitle.text = item.getDisplayTitle()
            binding.tvBody.text = item.getDisplayBody()
            binding.tvTime.text = item.getFormattedTime()
            binding.tvPushId.text = item.getPushIdDisplay()
            binding.tvStatus.text = item.status.displayName

            // 设置状态指示器颜色
            val statusColor = when (item.status) {
                PushHistoryItem.PushStatus.RECEIVED -> R.color.colorSuccess
                PushHistoryItem.PushStatus.CLICKED -> R.color.colorInfo
                PushHistoryItem.PushStatus.DISMISSED -> R.color.colorWarning
            }
            binding.statusIndicator.backgroundTintList = 
                androidx.core.content.ContextCompat.getColorStateList(binding.root.context, statusColor)
            binding.tvStatus.setTextColor(
                androidx.core.content.ContextCompat.getColor(binding.root.context, statusColor)
            )

            // 设置已读状态
            updateReadStatus()

            // 设置扩展信息
            binding.tvExtendedInfo.text = item.getExtendedInfo()
            
            // 重置展开状态
            isExpanded = false
            binding.layoutExtended.visibility = View.GONE
        }

        private fun updateReadStatus() {
            val item = currentItem ?: return
            
            // 根据已读状态调整透明度
            val alpha = if (item.isRead) 1.0f else 0.7f
            binding.root.alpha = alpha
            
            // 未读消息使用粗体
            val textStyle = if (item.isRead) 
                android.graphics.Typeface.NORMAL 
            else 
                android.graphics.Typeface.BOLD
            
            binding.tvTitle.setTypeface(null, textStyle)
        }

        private fun toggleExpanded() {
            isExpanded = !isExpanded
            binding.layoutExtended.visibility = if (isExpanded) View.VISIBLE else View.GONE
            
            // 可以添加动画效果
            if (isExpanded) {
                binding.layoutExtended.alpha = 0f
                binding.layoutExtended.animate()
                    .alpha(1f)
                    .setDuration(200)
                    .start()
            }
        }
    }

    /**
     * DiffUtil 回调，用于高效更新列表
     */
    class DiffCallback : DiffUtil.ItemCallback<PushHistoryItem>() {
        override fun areItemsTheSame(oldItem: PushHistoryItem, newItem: PushHistoryItem): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: PushHistoryItem, newItem: PushHistoryItem): Boolean {
            return oldItem == newItem
        }
    }

    /**
     * 获取今日推送数量
     */
    fun getTodayCount(): Int {
        return currentList.count { it.isToday() }
    }

    /**
     * 获取未读推送数量
     */
    fun getUnreadCount(): Int {
        return currentList.count { !it.isRead }
    }

    /**
     * 获取最后推送时间
     */
    fun getLastPushTime(): String? {
        return currentList.maxByOrNull { it.receivedAt }?.getFormattedDateTime()
    }

    /**
     * 标记所有消息为已读
     */
    fun markAllAsRead() {
        val updatedList = currentList.map { item ->
            if (!item.isRead) {
                item.copy(isRead = true)
            } else {
                item
            }
        }
        submitList(updatedList)
    }

    /**
     * 根据关键词筛选
     */
    fun filter(query: String, originalList: List<PushHistoryItem>) {
        val filteredList = if (query.isEmpty()) {
            originalList
        } else {
            originalList.filter { item ->
                item.title?.contains(query, ignoreCase = true) == true ||
                item.body?.contains(query, ignoreCase = true) == true ||
                item.pushLogId?.contains(query, ignoreCase = true) == true
            }
        }
        submitList(filteredList)
    }
}
