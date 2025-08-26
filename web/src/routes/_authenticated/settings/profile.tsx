import { createFileRoute } from '@tanstack/react-router'
import { SettingsProfile } from '@/features/settings'

export const Route = createFileRoute('/_authenticated/settings/profile')({
  component: SettingsProfile,
})
