import { createFileRoute } from '@tanstack/react-router'
import { ScheduledPush } from '@/features/scheduled-push'

export const Route = createFileRoute('/_authenticated/scheduled-push')({
  component: ScheduledPush,
})
