import type { Metadata } from 'next'
import Activity from './Activity'

export const metadata: Metadata = {
  title: 'Activity',
  description: 'The signed-in account’s own buys, swaps, and sends. Amounts use the asset’s decimals from the registry. If decimals are missing, the raw value is shown. Correnthian does not sign the transaction.',
}

export default function Page() {
  return <Activity />
}
