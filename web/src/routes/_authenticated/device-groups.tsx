import { createFileRoute } from '@tanstack/react-router'
import { DeviceGroups } from '@/features/device-groups'

export const Route = createFileRoute('/_authenticated/device-groups')({
  component: DeviceGroups,
})
