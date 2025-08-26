import { createFileRoute } from '@tanstack/react-router'
import { SettingsAppearance } from '@/features/settings'

export const Route = createFileRoute('/_authenticated/settings/appearance')({
  component: SettingsAppearance,
})