import { createFileRoute } from '@tanstack/react-router'
import { SettingsAccount } from '@/features/settings'

export const Route = createFileRoute('/_authenticated/settings/account')({
  component: SettingsAccount,
})
