import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_admin/devices/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_admin/devices/"!</div>
}
