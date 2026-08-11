import apiClient from './api-client'
import type { AppInvitation } from '@/types/api'

export class InboxService {
  static async getInbox(): Promise<AppInvitation[]> {
    return apiClient.get('/inbox')
  }

  static async getUnreadCount(): Promise<number> {
    const result = await apiClient.get<unknown, { count: number }>('/inbox/unread-count')
    return result.count
  }

  static async markRead(invitationId: number): Promise<void> {
    return apiClient.patch(`/inbox/${invitationId}/read`)
  }

  static async markAllRead(): Promise<void> {
    return apiClient.post('/inbox/read-all')
  }

  static async accept(invitationId: number): Promise<AppInvitation> {
    return apiClient.post(`/inbox/${invitationId}/accept`)
  }

  static async reject(invitationId: number): Promise<AppInvitation> {
    return apiClient.post(`/inbox/${invitationId}/reject`)
  }
}
