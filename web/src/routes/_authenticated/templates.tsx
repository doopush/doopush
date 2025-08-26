import { createFileRoute } from '@tanstack/react-router'
import { Templates } from '@/features/templates'

export const Route = createFileRoute('/_authenticated/templates')({
  component: () => <Templates />,
})
