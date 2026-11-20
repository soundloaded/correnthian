import type { Metadata } from 'next'
import Redemption from './Redemption'

export const metadata: Metadata = {
  title: 'Redemption',
  description: 'The issuer delivers the metal. Correnthian records the request.',
}

export default function Page() {
  return <Redemption />
}
