import type { Metadata } from 'next'
import BuyGold from './BuyGold'

export const metadata: Metadata = {
  title: 'Buy Gold | Correnthian Allocated Swiss Bullion',
  description:
    'Buy, hold, and trade 1:1 allocated investment-grade physical gold bullion (999.9 fine) stored in insured Zurich and Singapore vaults. Zero monthly storage fees, instant liquidity, and legal title.',
}

export default function Page() {
  return <BuyGold />
}
