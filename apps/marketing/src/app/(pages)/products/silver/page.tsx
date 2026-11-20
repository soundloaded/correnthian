import type { Metadata } from 'next'
import SilverAsset from './SilverAsset'

export const metadata: Metadata = {
  title: 'Silver',
  description: 'Silver is shown as metal only when specific metal is allocated.',
}

export default function Page() {
  return <SilverAsset />
}
