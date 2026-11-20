import type { Metadata } from 'next'
import Portfolio from './Portfolio'

export const metadata: Metadata = {
  title: 'Portfolio',
  description: 'Correnthian shows holdings the account already controls, does not custody them, and leaves an unpriced holding out of the total.',
}

export default function Page() {
  return <Portfolio />
}
