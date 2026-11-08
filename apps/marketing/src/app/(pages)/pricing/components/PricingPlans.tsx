'use client'

import { Icon } from '@iconify/react'
import Link from 'next/link'
import { useState } from 'react'

type PricingPlanType = {
  badge: string
  badgeBgClass: string
  badgeShadowClass?: string
  description: string
  monthlyPrice?: number
  yearlyPrice?: number
  features: string[]
  buttonText: string
  buttonLink: string
  colSpanClass?: string
}

const pricingPlansData: PricingPlanType[] = [
  {
    badge: 'Network',
    badgeBgClass: 'bg-primary-8',
    badgeShadowClass: 'shadow-[0_0_20px_rgba(0,139,183,0.4)]',
    description: 'The chain fee for moving the holding. Shown on its own line when a quote exists.',
    features: ['Named on the quote', 'Not set by Correnthian', 'No rate published yet', 'Not bundled into a spread', 'Visible before you confirm'],
    buttonText: 'Ask about access',
    buttonLink: '/waitlist',
  },
  {
    badge: 'Issuer',
    badgeBgClass: 'bg-primary-2',
    description: 'The fee charged by whoever issues or redeems the token. Their line, not ours.',
    features: ['Named issuer', 'Separate from our fee', 'No contracted rate yet', 'Not estimated here'],
    buttonText: 'Ask about access',
    buttonLink: '/waitlist',
  },
  {
    badge: 'Correnthian',
    badgeBgClass: 'bg-primary-1',
    description: 'Our fee for the record and the execution. Itemised. Not a hidden spread.',
    features: ['One stated line', 'No principal risk', 'No rate until contracted', 'Early access is a waitlist'],
    buttonText: 'Join the waitlist',
    buttonLink: '/waitlist',
    colSpanClass: 'lg:col-span-1 md:col-span-2',
  },
]

const PricingPlans = () => {
  const [isYearly, setIsYearly] = useState(true)

  return (
    <section className="pt-32.5 md:pt-36 lg:pt-50">
      <div className="container">
        <div className="mb-7.5 text-center">
          <span className="border-default-200 text-default-800 inline-block rounded-full border bg-white px-5 py-1 text-sm font-medium md:py-1.5">Pricing plan</span>
          <h1 className="text-default-900 mt-2.5 text-3xl font-medium tracking-tight md:text-5xl lg:text-[68px]">Three lines. No rate yet.</h1>

          <div className="mt-5 flex items-center justify-center gap-4 lg:mt-10">
            <span className="text-default-800 text-base font-medium md:text-lg">Before</span>

            <input
              type="checkbox"
              id="toggle-count"
              checked={isYearly}
              onChange={() => setIsYearly(!isYearly)}
              className="peer before:bg-default-900 relative h-9 w-15 cursor-pointer appearance-none rounded-full border-2 border-transparent bg-white p-1 shadow-xl transition-colors duration-200 ease-in-out before:inline-block before:h-6 before:w-6 before:translate-x-0 before:transform before:rounded-full before:shadow before:transition before:duration-200 before:ease-in-out checked:bg-none checked:before:translate-x-full focus:ring-0 focus:ring-offset-0"
            />

            <span className="text-default-800 text-base font-medium md:text-lg">After</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-7.5 md:grid-cols-2 lg:grid-cols-3">
          {pricingPlansData.map((plan, idx) => {
            const price = plan.monthlyPrice !== undefined ? (isYearly ? plan.yearlyPrice : plan.monthlyPrice) : null

            return (
              <div key={idx} className={`flex flex-col rounded-2xl bg-white p-3.5 shadow-xl md:p-5 lg:p-7.5 ${plan.colSpanClass || ''}`}>
                <div className={`mb-5 self-start rounded-lg px-3.75 py-1 text-sm font-medium text-white lg:py-2 ${plan.badgeBgClass} ${plan.badgeShadowClass || ''}`}>{plan.badge}</div>

                {price !== null && (
                  <div className="mb-2.5 flex items-baseline gap-2 lg:mb-5">
                    <p className="text-default-900 text-2xl font-semibold md:text-3xl lg:text-4xl">
                      $ <span>{price}</span>
                    </p>
                    <div className="text-lg">/per month</div>
                  </div>
                )}

                <div>
                  <p className="text-default-700 text-base leading-relaxed md:text-lg">{plan.description}</p>
                </div>

                <div className="bg-default-200 my-6 h-px"></div>

                <ul className="mb-5 space-y-2.5 md:mb-7.5">
                  {plan.features.map((feature, fIdx) => (
                    <li key={fIdx} className="text-default-600 flex items-center gap-2 text-base">
                      <Icon icon="lucide:circle-check" className="text-primary-2 size-4" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div>
                  <Link href={plan.buttonLink} className="group bg-default-900 relative inline-flex items-center justify-center overflow-hidden rounded-full px-5 text-white shadow-xl! transition-all duration-300 hover:scale-95">
                    <div className="relative inline-flex flex-col items-center transition-transform duration-300 group-hover:-translate-y-full">
                      <div className="flex h-14 items-center gap-3">
                        <span className="font-medium">{plan.buttonText}</span>
                      </div>
                      <div className="absolute top-full flex h-14 items-center gap-3">
                        <span className="font-medium">{plan.buttonText}</span>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default PricingPlans
