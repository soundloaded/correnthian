import type { Metadata } from 'next'
import Faq from './components/Faq'

export const metadata: Metadata = {
  title: 'FAQs',
  description: 'Answers on card and bank purchases, registered tokens, fees, swaps, and redemption. A purchase stays refused until a provider is contracted.',
}

const Page = () => {
  return (
    <>
      <Faq />
    </>
  )
}

export default Page
