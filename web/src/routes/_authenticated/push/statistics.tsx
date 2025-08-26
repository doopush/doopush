import { createFileRoute } from '@tanstack/react-router'
import { PushStatistics } from '@/features/push'

export const Route = createFileRoute('/_authenticated/push/statistics')({
  component: () => <PushStatistics />,
})
