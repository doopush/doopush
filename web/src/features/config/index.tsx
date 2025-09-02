import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  MoreHorizontal,
  Play,
  Shield,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Cog
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

import { useAuthStore } from '@/stores/auth-store'
import { ConfigService } from '@/services/config-service'
import { NoAppSelected } from '@/components/no-app-selected'
import { APP_SELECTION_DESCRIPTIONS } from '@/utils/app-utils'
import { CreateConfigDialog } from './components/create-config-dialog'
import { EditConfigDialog } from './components/edit-config-dialog'
import { DeleteConfigDialog } from './components/delete-config-dialog'
import { TestConfigDialog } from './components/test-config-dialog'
import { AppConfigTab } from './components/app-config-tab'
import { Apple, Android } from '@/components/platform-icon'
import type { AppConfig } from '@/types/api'
import { toast } from 'sonner'
import { ANDROID_VENDORS, ANDROID_VENDOR_ICONS } from '@/lib/constants'

export function PushConfig() {
  const { currentApp } = useAuthStore()
  const [configs, setConfigs] = useState<AppConfig[]>([])
  const [activeTab, setActiveTab] = useState('app')

  
  // 对话框状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [selectedConfig, setSelectedConfig] = useState<AppConfig | null>(null)

  // 防重复调用的ref
  const loadingRef = useRef(false)

  // 加载配置列表
  const loadConfigs = useCallback(async (showSuccessToast = false) => {
    if (!currentApp) return
    
    // 防重复调用检查
    if (loadingRef.current) {
      return
    }
    
    try {
      loadingRef.current = true
      const data = await ConfigService.getConfigs(currentApp.id)
      setConfigs(data)
      if (showSuccessToast) {
        toast.success('配置列表刷新成功')
      }
    } catch (error) {
      console.error('加载配置列表失败:', error)
      toast.error('加载配置列表失败')
    } finally {
      loadingRef.current = false
    }
  }, [currentApp])

  useEffect(() => {
    if (currentApp) {
      loadConfigs()
    }
  }, [currentApp, loadConfigs])

  // 操作处理
  const handleEditConfig = (config: AppConfig) => {
    setSelectedConfig(config)
    setEditDialogOpen(true)
  }

  const handleDeleteConfig = (config: AppConfig) => {
    setSelectedConfig(config)
    setDeleteDialogOpen(true)
  }

  const handleTestConfig = (config: AppConfig) => {
    setSelectedConfig(config)
    setTestDialogOpen(true)
  }

  const handleConfigCreated = (createdPlatform?: string) => {
    setCreateDialogOpen(false)
    loadConfigs()
    // 如果提供了平台信息，切换到对应的tab
    if (createdPlatform) {
      setActiveTab(createdPlatform)
    }
  }

  const handleConfigUpdated = () => {
    setEditDialogOpen(false)
    setSelectedConfig(null)
    loadConfigs()
  }

  const handleConfigDeleted = () => {
    setDeleteDialogOpen(false)
    setSelectedConfig(null)
    loadConfigs()
  }



  const getChannelInfo = (channel: string) => {
    const channelMap: Record<string, { name: string; icon: React.ReactNode }> = {
      apns: { name: 'Apple Push', icon: <Apple className="h-4 w-4" /> },
      fcm: { name: 'Firebase Cloud Messaging', icon: '🔥' },
      ...Object.fromEntries(
        Object.entries(ANDROID_VENDORS).map(([key, vendor]) => [
          key,
          { name: vendor.name, icon: ANDROID_VENDOR_ICONS[key as keyof typeof ANDROID_VENDOR_ICONS] }
        ])
      ),
    }
    return channelMap[channel] || { name: channel, icon: '📱' }
  }

  // 按平台分组配置
  const iosConfigs = configs.filter(c => c.platform === 'ios')
  const androidConfigs = configs.filter(c => c.platform === 'android')

  // 检查应用是否支持某个平台
  const supportsPlatform = useCallback((platform: 'ios' | 'android'): boolean => {
    if (!currentApp) return false
    return currentApp.platform === platform || currentApp.platform === 'both'
  }, [currentApp])

  // 获取可用的标签页
  const availableTabs = useMemo(() => {
    const tabs = ['app']
    if (supportsPlatform('ios')) tabs.push('ios')
    if (supportsPlatform('android')) tabs.push('android')
    return tabs
  }, [supportsPlatform])

  // 确保当前选中的标签页可用，如果不可用则切换到应用配置
  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab('app')
    }
  }, [currentApp, activeTab, availableTabs])

  return (
    <>
      <Header>
        <Search />
        <div className='ms-auto flex items-center gap-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      {!currentApp ? (
        <NoAppSelected 
          icon={<Settings className="h-16 w-16 text-muted-foreground" />}
          description={APP_SELECTION_DESCRIPTIONS.config}
        />
      ) : (
        <Main>
            <div className='flex items-center justify-between mb-6 gap-4'>
              <div className='flex flex-col gap-1'>
                <h1 className='text-2xl font-bold tracking-tight'>推送配置</h1>
                <p className='text-muted-foreground'>
                  管理应用 "{currentApp.name}" 的推送服务配置
                </p>
              </div>
              {/* 只在非应用配置tab时显示按钮 */}
              {activeTab !== 'app' && (
                <div className='flex items-center gap-2'>
                  <Button variant="outline" onClick={() => loadConfigs(true)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    刷新
                  </Button>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    添加配置
                  </Button>
                </div>
              )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className='mb-4'>
                <TabsTrigger value="app" className="flex items-center gap-2">
                  <Cog className="h-4 w-4" />
                  应用配置
                </TabsTrigger>
                {supportsPlatform('ios') && (
                  <TabsTrigger value="ios" className="flex items-center gap-2">
                    <Apple className="h-4 w-4" />
                    iOS配置
                    <Badge variant="secondary">{iosConfigs.length}</Badge>
                  </TabsTrigger>
                )}
                {supportsPlatform('android') && (
                  <TabsTrigger value="android" className="flex items-center gap-2">
                    <Android className="h-4 w-4" />
                    Android配置
                    <Badge variant="secondary">{androidConfigs.length}</Badge>
                  </TabsTrigger>
                )}
              </TabsList>

              {/* 应用配置 */}
              <TabsContent value="app" className="space-y-4">
                <AppConfigTab />
              </TabsContent>

              {/* iOS配置 */}
              <TabsContent value="ios" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      iOS 推送配置
                    </CardTitle>
                    <CardDescription>
                      配置 Apple Push Notification Service (APNs) 证书和密钥
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {iosConfigs.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        暂无iOS推送配置
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>推送通道</TableHead>
                            <TableHead>配置状态</TableHead>
                            <TableHead>推送环境</TableHead>
                            <TableHead>创建时间</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {iosConfigs.map((config) => (
                            <TableRow key={config.id}>
                              <TableCell>
                                <div className="flex items-center gap-4">
                                  {getChannelInfo(config.channel).icon}
                                  <div>
                                    <div className="font-medium">{getChannelInfo(config.channel).name}</div>
                                    <div className="text-sm text-muted-foreground">{config.channel}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-green-100 text-green-800">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  已配置
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  let env = '开发环境'
                                  let badgeClass = 'bg-yellow-100 text-yellow-800'
                                  try {
                                    const configObj = JSON.parse(config.config)
                                    if (configObj.production) {
                                      env = '生产环境'
                                      badgeClass = 'bg-green-100 text-green-800'
                                    }
                                  } catch {
                                    // 解析失败，默认开发环境
                                  }
                                  return (
                                    <Badge className={badgeClass}>
                                      {env}
                                    </Badge>
                                  )
                                })()}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {new Date(config.created_at).toLocaleString('zh-CN', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleTestConfig(config)}>
                                      <Play className="mr-2 h-4 w-4" />
                                      测试配置
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEditConfig(config)}>
                                      <Edit className="mr-2 h-4 w-4" />
                                      编辑配置
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => handleDeleteConfig(config)}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      删除配置
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Android配置 */}
              <TabsContent value="android" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Android 推送配置
                    </CardTitle>
                    <CardDescription>
                      配置多厂商Android推送通道（FCM, 华为, 小米, OPPO, VIVO等）
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {androidConfigs.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        暂无Android推送配置
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>推送通道</TableHead>
                            <TableHead>配置状态</TableHead>
                            <TableHead>创建时间</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {androidConfigs.map((config) => (
                            <TableRow key={config.id}>
                              <TableCell>
                                <div className="flex items-center gap-4">
                                  {getChannelInfo(config.channel).icon}
                                  <div>
                                    <div className="font-medium">{getChannelInfo(config.channel).name}</div>
                                    <div className="text-sm text-muted-foreground">{config.channel}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-green-100 text-green-800">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  已配置
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {new Date(config.created_at).toLocaleString('zh-CN', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleTestConfig(config)}>
                                      <Play className="mr-2 h-4 w-4" />
                                      测试配置
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEditConfig(config)}>
                                      <Edit className="mr-2 h-4 w-4" />
                                      编辑配置
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => handleDeleteConfig(config)}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      删除配置
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* 只在非应用配置tab时显示配置说明 */}
            {activeTab !== 'app' && (
              <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  配置说明
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`grid gap-6 ${supportsPlatform('ios') && supportsPlatform('android') ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                  {supportsPlatform('ios') && (
                    <div>
                      <h4 className="font-medium mb-3">iOS 推送配置</h4>
                      <ul className="text-sm text-muted-foreground space-y-2">
                        <li>• 需要提供 Apple Developer 证书文件</li>
                        <li>• 支持生产环境和开发环境证书</li>
                        <li>• 配置 Bundle ID 和 Team ID</li>
                        <li>• 支持 P8 密钥和 P12 证书两种方式</li>
                      </ul>
                    </div>
                  )}

                  {supportsPlatform('android') && (
                    <div>
                      <h4 className="font-medium mb-3">Android 推送配置</h4>
                      <ul className="text-sm text-muted-foreground space-y-2">
                        <li>• FCM: 需要 google-services.json 或服务器密钥</li>
                        <li>• 华为: HMS Core App ID 和 App Secret</li>
                        <li>• 小米: AppID、AppKey 和 AppSecret</li>
                        <li>• OPPO/VIVO: AppID、AppKey 和 MasterSecret</li>
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* 对话框组件 */}
            <CreateConfigDialog 
              open={createDialogOpen}
              onOpenChange={setCreateDialogOpen}
              onSuccess={handleConfigCreated}
              defaultPlatform={activeTab as 'ios' | 'android'}
            />
            
            {selectedConfig && (
              <>
                <EditConfigDialog
                  config={selectedConfig}
                  open={editDialogOpen}
                  onOpenChange={setEditDialogOpen}
                  onSuccess={handleConfigUpdated}
                />
                
                <DeleteConfigDialog
                  config={selectedConfig}
                  open={deleteDialogOpen}
                  onOpenChange={setDeleteDialogOpen}
                  onSuccess={handleConfigDeleted}
                />
                
                <TestConfigDialog
                  config={selectedConfig}
                  open={testDialogOpen}
                  onOpenChange={setTestDialogOpen}
                />
              </>
            )}
        </Main>
      )}
    </>
  )
}
