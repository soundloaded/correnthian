import type { Metadata } from 'next'
import MobileApp from './MobileApp'

export const metadata: Metadata = {
  title: 'Mobile app',
  description: 'The App Store and Google Play listings are not live. There is no Correnthian app to download.',
}

export default function Page() {
  return <MobileApp />
}
