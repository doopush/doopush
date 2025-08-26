import { createFileRoute } from '@tanstack/react-router'
import { Privacy } from '@/features/legal'

export const Route = createFileRoute('/privacy')({
  component: Privacy,
})
