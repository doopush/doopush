import { createFileRoute } from '@tanstack/react-router'
import { DeviceTags } from '@/features/device-tags'

export const Route = createFileRoute('/_authenticated/device-tags')({
  component: DeviceTags,
})
