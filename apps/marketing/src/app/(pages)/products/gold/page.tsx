import type { Metadata } from 'next'
import GoldAsset from './GoldAsset'

export const metadata: Metadata = {
  title: 'Gold',
  description: 'How Correnthian names a third-party gold token. It is shown as gold you hold only when specific metal is allocated. Correnthian does not mint it.',
}

export default function Page() {
  return <GoldAsset />
}
