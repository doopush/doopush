import { createFileRoute } from '@tanstack/react-router'
import { PushSend } from '@/features/push'

export const Route = createFileRoute('/_authenticated/push/')({
  component: () => <PushSend />,
})
