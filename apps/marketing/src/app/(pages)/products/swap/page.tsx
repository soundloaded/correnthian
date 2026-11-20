import type { Metadata } from 'next'
import Swap from './Swap'

export const metadata: Metadata = {
  title: 'Swap',
  description: 'A swap spends assets you already hold: the server prepares an unsigned quote, your device signs, and a live fill waits until a liquidity provider is contracted.',
}

export default function Page() {
  return <Swap />
}
