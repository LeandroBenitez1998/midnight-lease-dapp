import { createFileRoute } from '@tanstack/react-router'
import { LeasePage } from '@/pages/lease'

export const Route = createFileRoute('/lease')({
  component: LeasePage,
})
