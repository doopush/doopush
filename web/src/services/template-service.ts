import apiClient from './api-client'
import type { MessageTemplate, TemplateVariable, PaginationRequest, PaginationEnvelope } from '@/types/api'

export class TemplateService {
  /**
   * 获取消息模板列表（统一分页）
   */
  static async getTemplates(appId: number, params?: PaginationRequest): Promise<PaginationEnvelope<MessageTemplate>> {
    return apiClient.get(`/apps/${appId}/templates`, { params })
  }

  /**
   * 获取模板详情
   */
  static async getTemplate(appId: number, templateId: number): Promise<MessageTemplate> {
    return apiClient.get(`/apps/${appId}/templates/${templateId}`)
  }

  /**
   * 创建消息模板
   */
  static async createTemplate(appId: number, data: {
    name: string
    title: string
    content: string
    payload?: string
    variables?: Record<string, TemplateVariable>
    platform?: string
    locale?: string
  }): Promise<MessageTemplate> {
    return apiClient.post(`/apps/${appId}/templates`, data)
  }

  /**
   * 更新消息模板
   */
  static async updateTemplate(appId: number, templateId: number, data: {
    name: string
    title: string
    content: string
    payload?: string
    variables?: Record<string, TemplateVariable>
    platform?: string
    locale?: string
    is_active: boolean
  }): Promise<MessageTemplate> {
    return apiClient.put(`/apps/${appId}/templates/${templateId}`, data)
  }

  /**
   * 删除消息模板
   */
  static async deleteTemplate(appId: number, templateId: number): Promise<void> {
    return apiClient.delete(`/apps/${appId}/templates/${templateId}`)
  }

  /**
   * 渲染模板内容
   */
  static async renderTemplate(appId: number, templateId: number, data: Record<string, string>): Promise<{
    title: string
    content: string
    payload?: string
  }> {
    return apiClient.post(`/apps/${appId}/templates/${templateId}/render`, { data })
  }
}
