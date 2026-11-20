import type { Metadata } from 'next'
import Faq from './components/Faq'

export const metadata: Metadata = {
  title: 'FAQs | Correnthian Digital Vault',
  description:
    'Answers on buying allocated gold and silver, Swiss vault storage, zero custody fees, 24/7 swaps, and physical bar redemption.',
}

const Page = () => {
  return (
    <>
      <Faq />
    </>
  )
}

export default Page
