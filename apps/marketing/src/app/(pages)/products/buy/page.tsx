import type { Metadata } from 'next'
import BuyGold from './BuyGold'

export const metadata: Metadata = {
  title: 'Buy gold',
  description: 'How a card or bank purchase of a third-party gold token is delivered to an account only you can move.',
}

export default function Page() {
  return <BuyGold />
}
