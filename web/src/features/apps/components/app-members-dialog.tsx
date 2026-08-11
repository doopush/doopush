import { useEffect, useState, type FormEvent } from 'react'
import { Clock3, Loader2, Search, Send, Trash2, Users, X } from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogScrollBody,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AppService } from '@/services/app-service'
import { useAuthStore } from '@/stores/auth-store'
import type { App, AppInvitation, AppInviteCandidate, AppMember, AppRole } from '@/types/api'

interface AppMembersDialogProps {
  app: App
  open: boolean
  onOpenChange: (open: boolean) => void
}

const roleLabels: Record<AppRole, string> = {
  owner: '所有者',
  developer: '开发者',
  viewer: '观察者',
}

export function AppMembersDialog({ app, open, onOpenChange }: AppMembersDialogProps) {
  const currentUser = useAuthStore(state => state.user)
  const setUserApps = useAuthStore(state => state.setUserApps)
  const [members, setMembers] = useState<AppMember[]>([])
  const [invitations, setInvitations] = useState<AppInvitation[]>([])
  const [email, setEmail] = useState('')
  const [candidate, setCandidate] = useState<AppInviteCandidate | null>(null)
  const [newRole, setNewRole] = useState<AppRole>('developer')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [sending, setSending] = useState(false)
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null)
  const [removeTarget, setRemoveTarget] = useState<AppMember | null>(null)
  const [cancelTarget, setCancelTarget] = useState<AppInvitation | null>(null)
  const [removing, setRemoving] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (open) void loadMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, app.id])

  const loadMembers = async () => {
    try {
      setLoading(true)
      const [memberItems, invitationItems] = await Promise.all([
        AppService.getAppMembers(app.id),
        AppService.getPendingInvitations(app.id),
      ])
      setMembers(memberItems)
      setInvitations(invitationItems)
    } catch (error) {
      toast.error((error as Error).message || '加载成员失败')
    } finally {
      setLoading(false)
    }
  }

  const refreshAppAccess = async () => {
    try {
      setUserApps(await AppService.getApps())
    } catch {
      toast.error('刷新应用权限失败')
    }
  }

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault()
    const normalizedEmail = email.trim()
    if (!normalizedEmail) return

    try {
      setSearching(true)
      setCandidate(await AppService.lookupInviteCandidate(app.id, normalizedEmail))
    } catch (error) {
      setCandidate(null)
      toast.error((error as Error).message || '未找到该用户')
    } finally {
      setSearching(false)
    }
  }

  const handleInvite = async () => {
    if (!candidate || candidate.state !== 'available') return
    try {
      setSending(true)
      const invitation = await AppService.createInvitation(app.id, {
        invitee_id: candidate.user_id,
        role: newRole,
      })
      setInvitations(current => [invitation, ...current])
      setEmail('')
      setCandidate(null)
      toast.success('邀请已发送')
    } catch (error) {
      toast.error((error as Error).message || '发送邀请失败')
    } finally {
      setSending(false)
    }
  }

  const handleCancelInvitation = async () => {
    if (!cancelTarget) return
    try {
      setCancelling(true)
      await AppService.cancelInvitation(app.id, cancelTarget.id)
      setInvitations(current => current.filter(item => item.id !== cancelTarget.id))
      setCancelTarget(null)
      toast.success('邀请已撤回')
    } catch (error) {
      toast.error((error as Error).message || '撤回邀请失败')
    } finally {
      setCancelling(false)
    }
  }

  const handleRoleChange = async (member: AppMember, role: AppRole) => {
    if (member.role === role) return
    try {
      setUpdatingUserId(member.user_id)
      const updated = await AppService.updateAppMember(app.id, member.user_id, role)
      setMembers(current => current.map(item => item.user_id === member.user_id ? updated : item))
      toast.success('成员角色已更新')
      if (member.user_id === currentUser?.id && role !== 'owner') {
        onOpenChange(false)
        await refreshAppAccess()
      }
    } catch (error) {
      toast.error((error as Error).message || '更新成员角色失败')
    } finally {
      setUpdatingUserId(null)
    }
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    try {
      setRemoving(true)
      await AppService.removeAppMember(app.id, removeTarget.user_id)
      setMembers(current => current.filter(item => item.user_id !== removeTarget.user_id))
      if (removeTarget.user_id === currentUser?.id) {
        onOpenChange(false)
        await refreshAppAccess()
      }
      setRemoveTarget(null)
      toast.success('成员已移除')
    } catch (error) {
      toast.error((error as Error).message || '移除成员失败')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='flex max-h-[85vh] flex-col overflow-hidden sm:max-w-[760px]'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Users className='h-5 w-5' />
              成员管理
            </DialogTitle>
            <DialogDescription>
              {app.name} · {members.length} 位成员{invitations.length > 0 ? ` · ${invitations.length} 个待处理邀请` : ''}
            </DialogDescription>
          </DialogHeader>

          <DialogScrollBody className='space-y-5'>
            <form className='flex flex-col gap-2 sm:flex-row' onSubmit={handleSearch}>
              <Input
                type='email'
                value={email}
                onChange={event => {
                  setEmail(event.target.value)
                  setCandidate(null)
                }}
                placeholder='同事的注册邮箱'
                aria-label='同事的注册邮箱'
                disabled={searching || sending}
                required
              />
              <Button type='submit' variant='outline' disabled={searching || sending || !email.trim()}>
                {searching ? <Loader2 className='h-4 w-4 animate-spin' /> : <Search className='h-4 w-4' />}
                搜索
              </Button>
            </form>

            {candidate && (
              <div className='flex flex-col gap-3 border-y py-4 sm:flex-row sm:items-center'>
                <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted font-medium'>
                  {(candidate.nickname || candidate.username).slice(0, 1).toUpperCase()}
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='truncate text-sm font-medium'>{candidate.nickname || candidate.username}</div>
                  <div className='truncate text-xs text-muted-foreground'>{candidate.email}</div>
                </div>
                {candidate.state === 'available' ? (
                  <div className='flex items-center gap-2'>
                    <Select value={newRole} onValueChange={value => setNewRole(value as AppRole)} disabled={sending}>
                      <SelectTrigger className='w-28' aria-label='邀请角色'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='developer'>开发者</SelectItem>
                        <SelectItem value='viewer'>观察者</SelectItem>
                        <SelectItem value='owner'>所有者</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type='button' onClick={() => void handleInvite()} disabled={sending}>
                      {sending ? <Loader2 className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
                      发送邀请
                    </Button>
                  </div>
                ) : (
                  <Badge variant='secondary'>
                    {candidate.state === 'member' ? '已经是成员' : '邀请待处理'}
                  </Badge>
                )}
              </div>
            )}

            <div className='overflow-hidden rounded-md border'>
              {loading ? (
                <div className='space-y-3 p-4'>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className='h-12 animate-pulse rounded bg-muted' />
                  ))}
                </div>
              ) : members.length === 0 ? (
                <div className='py-10 text-center text-sm text-muted-foreground'>暂无成员</div>
              ) : (
                <div className='divide-y'>
                  {members.map(member => {
                    const displayName = member.nickname || member.username
                    const updating = updatingUserId === member.user_id
                    const isOnlyOwner = member.role === 'owner' && members.filter(item => item.role === 'owner').length === 1
                    return (
                      <div key={member.user_id} className='flex min-w-0 items-center gap-3 px-4 py-3'>
                        <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium'>
                          {displayName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className='min-w-0 flex-1'>
                          <div className='flex items-center gap-2'>
                            <span className='truncate text-sm font-medium'>{displayName}</span>
                            {member.user_id === currentUser?.id && <Badge variant='secondary'>我</Badge>}
                          </div>
                          <div className='truncate text-xs text-muted-foreground'>{member.email}</div>
                        </div>
                        <Select
                          value={member.role}
                          onValueChange={value => void handleRoleChange(member, value as AppRole)}
                          disabled={updating || removing || isOnlyOwner}
                        >
                          <SelectTrigger className='w-28' aria-label={`${displayName}的角色`}>
                            {updating ? <Loader2 className='h-4 w-4 animate-spin' /> : <SelectValue />}
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(roleLabels) as AppRole[]).map(role => (
                              <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className='shrink-0 text-muted-foreground hover:text-destructive'
                          onClick={() => setRemoveTarget(member)}
                          disabled={updating || removing || isOnlyOwner}
                          aria-label={`移除${displayName}`}
                          title={isOnlyOwner ? '应用必须保留一位所有者' : '移除成员'}
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {invitations.length > 0 && (
              <div className='space-y-2'>
                <div className='flex items-center gap-2 text-sm font-medium'>
                  <Clock3 className='h-4 w-4' />
                  待处理邀请
                </div>
                <div className='divide-y rounded-md border'>
                  {invitations.map(invitation => (
                    <div key={invitation.id} className='flex min-w-0 items-center gap-3 px-4 py-3'>
                      <div className='min-w-0 flex-1'>
                        <div className='truncate text-sm font-medium'>{invitation.invitee_name}</div>
                        <div className='truncate text-xs text-muted-foreground'>{invitation.invitee_email}</div>
                      </div>
                      <Badge variant='outline'>{roleLabels[invitation.role]}</Badge>
                      <span className='hidden text-xs text-muted-foreground sm:inline'>
                        {new Date(invitation.created_at).toLocaleString('zh-CN')}
                      </span>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        onClick={() => setCancelTarget(invitation)}
                        aria-label={`撤回发给${invitation.invitee_name}的邀请`}
                        title='撤回邀请'
                      >
                        <X className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DialogScrollBody>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removeTarget)} onOpenChange={open => !open && !removing && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>移除成员</AlertDialogTitle>
            <AlertDialogDescription>
              确定要将 {removeTarget?.nickname || removeTarget?.username} 从 {app.name} 移除吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>取消</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={event => { event.preventDefault(); void handleRemove() }}
              disabled={removing}
            >
              {removing && <Loader2 className='h-4 w-4 animate-spin' />}
              确认移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(cancelTarget)} onOpenChange={open => !open && !cancelling && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>撤回邀请</AlertDialogTitle>
            <AlertDialogDescription>
              确定撤回发给 {cancelTarget?.invitee_name} 的应用邀请吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={event => { event.preventDefault(); void handleCancelInvitation() }}
              disabled={cancelling}
            >
              {cancelling && <Loader2 className='h-4 w-4 animate-spin' />}
              确认撤回
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
