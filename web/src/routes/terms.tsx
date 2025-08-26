import { createFileRoute } from '@tanstack/react-router'
import { Terms } from '@/features/legal'

export const Route = createFileRoute('/terms')({
  component: Terms,
})
