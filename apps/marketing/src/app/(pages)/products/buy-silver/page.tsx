import type { Metadata } from 'next'
import BuySilver from './BuySilver'

export const metadata: Metadata = {
  title: 'Buy silver',
  description: 'How a card or bank purchase of a third-party silver token is delivered to an account only you can move.',
}

export default function Page() {
  return <BuySilver />
}
