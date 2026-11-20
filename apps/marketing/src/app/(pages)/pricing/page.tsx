import type { Metadata } from 'next'
import PricingCompare from './components/PricingCompare'
import PricingFaq from './components/PricingFaq'
import PricingPlans from './components/PricingPlans'

export const metadata: Metadata = {
  title: 'Fees',
  description: 'Provider, Network, and Correnthian are three named lines on the quote. None of them has a published rate.',
}

const Page = () => {
  return (
    <>
      <PricingPlans />
      <PricingCompare />
      <PricingFaq />
    </>
  )
}

export default Page
