import { createFileRoute } from '@tanstack/react-router'
import { PushConfig } from '@/features/config'

export const Route = createFileRoute('/_authenticated/config')({
  component: () => <PushConfig />,
})
