import { createFileRoute } from '@tanstack/react-router'
import { PushLogs } from '@/features/push'

export const Route = createFileRoute('/_authenticated/push/logs')({
  component: () => <PushLogs />,
})
