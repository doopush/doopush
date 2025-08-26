import { createFileRoute } from '@tanstack/react-router'
import { UserTags } from '@/features/user-tags'

export const Route = createFileRoute('/_authenticated/user-tags')({
  component: UserTags,
})
