import { useEffect, useState, type FormEvent } from 'react'
import { Loader2, Trash2, UserPlus, Users } from 'lucide-react'
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
import type { App, AppMember, AppRole } from '@/types/api'

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
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState<AppRole>('developer')
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null)
  const [removeTarget, setRemoveTarget] = useState<AppMember | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (open) void loadMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, app.id])

  const loadMembers = async () => {
    try {
      setLoading(true)
      setMembers(await AppService.getAppMembers(app.id))
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

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    const normalizedEmail = email.trim()
    if (!normalizedEmail) return

    try {
      setAdding(true)
      const member = await AppService.addAppMember(app.id, {
        email: normalizedEmail,
        role: newRole,
      })
      setMembers(current => [...current, member])
      setEmail('')
      toast.success('成员添加成功')
    } catch (error) {
      toast.error((error as Error).message || '添加成员失败')
    } finally {
      setAdding(false)
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
              {app.name} · {members.length} 位成员
            </DialogDescription>
          </DialogHeader>

          <DialogScrollBody className='space-y-5'>
            <form className='flex flex-col gap-2 sm:flex-row' onSubmit={handleAdd}>
              <Input
                type='email'
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder='同事的注册邮箱'
                aria-label='同事的注册邮箱'
                disabled={adding}
                required
              />
              <Select value={newRole} onValueChange={value => setNewRole(value as AppRole)} disabled={adding}>
                <SelectTrigger className='w-full sm:w-32' aria-label='新成员角色'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='developer'>开发者</SelectItem>
                  <SelectItem value='viewer'>观察者</SelectItem>
                  <SelectItem value='owner'>所有者</SelectItem>
                </SelectContent>
              </Select>
              <Button type='submit' disabled={adding || !email.trim()}>
                {adding ? <Loader2 className='h-4 w-4 animate-spin' /> : <UserPlus className='h-4 w-4' />}
                添加
              </Button>
            </form>

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
    </>
  )
}
