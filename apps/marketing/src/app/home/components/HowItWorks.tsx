'use client'

import { Icon } from '@iconify/react'
import Image, { StaticImageData } from 'next/image'
import { useState } from 'react'

import howItWorks01 from '@/assets/images/gallery/how-it-works-01.webp'
import howItWorks02 from '@/assets/images/gallery/how-it-works-02.webp'
import howItWorks03 from '@/assets/images/gallery/how-it-works-03.webp'
import howItWorks04 from '@/assets/images/gallery/how-it-works-04.webp'
import vector10 from '@/assets/images/icons/vector-10.png'
import showcaseAllocatedVaults from '@/assets/images/workspace/showcase-allocated-vaults.webp'
import showcaseAssetsPortfolio from '@/assets/images/workspace/showcase-assets-portfolio.webp'
import showcaseBuySell from '@/assets/images/workspace/showcase-buy-sell.webp'
import showcaseMonthlyStatement from '@/assets/images/workspace/showcase-monthly-statement.webp'
import showcasePhysicalRedemption from '@/assets/images/workspace/showcase-physical-redemption.webp'

export type HowItWorksTabType = {
  id: string
  targetId: string
  label: string
  icon: string
  image: StaticImageData
  alt: string
  description: string
  statValue: string
  statLabel: string
  isActive?: boolean
}

export type ShowcaseFeatureType = {
  title: string
  description: string
  image: StaticImageData
  alt: string
}

const howItWorksTabsData: HowItWorksTabType[] = [
  {
    id: 'tabs-item-1',
    targetId: '#tabs-1',
    label: 'Buy & Trade 24/7',
    icon: 'lucide:coins',
    image: howItWorks01,
    alt: 'Investor buying physical gold on the Correnthian Digital Vault app alongside a fine gold bar',
    description: 'Buy and sell allocated physical gold, silver, and crypto 24/7 at live spot pricing — right from your phone.',
    statValue: '24/7',
    statLabel: 'Instant execution at live spot',
    isActive: true,
  },
  {
    id: 'tabs-item-2',
    targetId: '#tabs-2',
    label: 'Allocated Vaults',
    icon: 'lucide:shield-check',
    image: howItWorks02,
    alt: 'Serialized gold and silver bullion bars in Zurich vault matched to the Correnthian Digital Vault app',
    description: "Every gram is matched to serialized bullion in Zurich and Singapore vaults — insured through Lloyd's of London.",
    statValue: '100%',
    statLabel: 'Allocated & independently audited',
  },
  {
    id: 'tabs-item-3',
    targetId: '#tabs-3',
    label: 'Earn Silver Yield',
    icon: 'lucide:trending-up',
    image: howItWorks03,
    alt: 'Investor holding a 1kg fine silver bar and viewing monthly silver yield in the Correnthian app',
    description: 'Put your vaulted metals to work and earn a passive monthly income — paid directly in physical silver from day one.',
    statValue: 'Day 1',
    statLabel: 'Monthly yield paid in physical silver',
  },
  {
    id: 'tabs-item-4',
    targetId: '#tabs-4',
    label: 'Physical Redemption',
    icon: 'lucide:package-check',
    image: howItWorks04,
    alt: 'Unboxing an armored presentation case of stamped fine gold and silver bars delivered to home',
    description: 'You are the legal owner of your bullion. Redeem your holding anytime for stamped physical bars delivered to your door.',
    statValue: '999.9',
    statLabel: 'Investment-grade physical delivery',
  },
]

const showcaseFeaturesData: ShowcaseFeatureType[] = [
  {
    title: 'Buy & Sell',
    description: 'Buy and sell physical gold, silver, Bitcoin, and Ethereum 24/7 at live market rates — settled directly to your physical vault.',
    image: showcaseBuySell,
    alt: 'Buy and sell gold, silver, and crypto — Correnthian Digital Vault',
  },
  {
    title: 'Allocated Vaults',
    description: 'Track every serialized gold and silver bar held in your name across Zurich and Singapore vaults — insured, audited, and redeemable.',
    image: showcaseAllocatedVaults,
    alt: 'Allocated vault storage — Correnthian Digital Vault',
  },
  {
    title: 'Multi-Asset Portfolio',
    description: 'View your complete allocation breakdown across physical bullion and digital assets with real-time portfolio valuation.',
    image: showcaseAssetsPortfolio,
    alt: 'Multi-asset portfolio allocation — Correnthian Digital Vault',
  },
  {
    title: 'Physical Redemption',
    description: 'Inspect bar purity, weight, serial numbers, and vault location anytime — or tap Redeem for insured delivery to your door.',
    image: showcasePhysicalRedemption,
    alt: 'Physical gold bar details and redemption — Correnthian Digital Vault',
  },
  {
    title: 'Monthly Statements',
    description: 'Review transparent monthly performance statements, track gold and silver accumulation, and download audited PDF reports.',
    image: showcaseMonthlyStatement,
    alt: 'Monthly statement and PDF report — Correnthian Digital Vault',
  },
]

const HowItWorks = () => {
  const [activeTabId, setActiveTabId] = useState<string>(howItWorksTabsData[0].id)
  const [activeShowcaseIdx, setActiveShowcaseIdx] = useState<number>(0)

  return (
    <section className="relative" id="usecase">
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-60"
        style={{
          backgroundImage: 'radial-gradient(#e5e7eb 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px',
        }}
      ></div>

      <div className="relative z-10 container rounded-2xl bg-white object-cover p-8.5 text-center lg:mx-auto lg:p-25" style={{ backgroundImage: `url(${vector10.src})` }}>
        <span className="border-default-200 text-default-800 mb-3.5 inline-block rounded-full border bg-white px-5 py-1.5 text-sm font-medium">How Correnthian works</span>

        <h2 className="text-default-900 mb-8 text-2xl leading-[1.1] font-medium tracking-normal md:mb-12.5 md:text-4xl lg:text-5xl">
          From instant purchase
          <br className="hidden md:block" />
          to physical vault delivery
        </h2>

        <nav className="mb-7.5 flex flex-wrap justify-center gap-2.5 md:gap-5" aria-label="Tabs" role="tablist">
          {howItWorksTabsData.map((tab) => {
            const isActive = activeTabId === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTabId(tab.id)}
                className={`hs-tab-active:border-default-800 hs-tab-active:bg-default-100 hs-tab-active:text-default-900 bg-default-100 hover:bg-default-100 inline-flex items-center gap-x-2.5 rounded-xl border px-5 py-2.5 text-base font-medium transition-all md:text-lg ${
                  isActive ? 'active border-default-800 text-default-900' : 'border-default-200 text-default-500'
                }`}
                id={tab.id}
                data-hs-tab={tab.targetId}
                aria-controls={tab.targetId.substring(1)}
                role="tab"
                aria-selected={isActive}
              >
                <Icon icon={tab.icon} />
                {tab.label}
              </button>
            )
          })}
        </nav>

        <div className="relative mx-auto mt-8 max-w-5xl">
          {howItWorksTabsData.map((tab) => {
            const isActive = activeTabId === tab.id
            return (
              <div key={tab.targetId} id={tab.targetId.substring(1)} role="tabpanel" aria-labelledby={tab.id} className={`transition-all duration-300 ${isActive ? '' : 'hidden'}`}>
                <div className="shadow-default-200/50 relative overflow-hidden rounded-2xl shadow-2xl">
                  <Image src={tab.image} className="h-92 w-full object-cover lg:h-138" alt={tab.alt} />
                  <div className="bg-default-900/60 absolute right-2 bottom-2 w-70 rounded-3xl border border-white/10 p-3.5 text-left backdrop-blur-md md:right-4 md:bottom-4 md:w-100 md:p-5 lg:right-8 lg:bottom-8 lg:p-7.5">
                    <p className="text-default-300 mb-7.5 text-sm font-medium tracking-normal md:text-lg">{tab.description}</p>
                    <div className="flex items-center justify-between">
                      <h3 className="text-2xl leading-none font-bold text-white md:text-4xl">{tab.statValue}</h3>
                      <p className="text-default-400 text-sm font-medium tracking-tighter">{tab.statLabel}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="relative z-10 container mt-20 lg:mt-32">
        <div className="mx-auto grid w-full max-w-[1080px] grid-cols-1 gap-8 md:gap-10 lg:min-h-[540px] lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-x-[60px] lg:gap-y-0">
          <div className="lg:col-start-2 lg:row-start-1">
            <h2 className="text-default-900 max-w-[408px] text-3xl font-bold tracking-[-0.02em] md:text-[2.25rem] md:leading-[1.15]">
              Buy, vault and redeem from one account
            </h2>
          </div>

          <div className="relative aspect-[510/502] w-full overflow-hidden rounded-[20px] bg-[#dfdfdf] lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:aspect-auto">
            {showcaseFeaturesData.map((feature, idx) => {
              const isActive = activeShowcaseIdx === idx
              return (
                <Image
                  key={feature.title}
                  src={feature.image}
                  alt={feature.alt}
                  aria-hidden={!isActive}
                  fill
                  sizes="(min-width: 1024px) 510px, 100vw"
                  className={`object-contain object-center p-2 transition-[opacity,transform] duration-[600ms,900ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${
                    isActive ? 'scale-100 opacity-100' : 'scale-[1.04] opacity-0'
                  }`}
                />
              )
            })}
          </div>

          <div className="relative grid lg:col-start-2 lg:row-start-2 lg:self-end">
            <div aria-hidden="true" style={{ paddingTop: '290px' }} className="invisible [grid-area:1/1] lg:hidden">
              <p className="max-w-[400px] text-[1rem] leading-[1.5] tracking-[-0.02em]">
                Track every serialized gold and silver bar held in your name across Zurich and Singapore vaults — insured, audited, and redeemable.
              </p>
            </div>

            <div className="flex flex-col [grid-area:1/1]">
              <span
                aria-hidden="true"
                style={{ transform: `translateY(${activeShowcaseIdx * 58}px)`, top: '15px' }}
                className="pointer-events-none absolute left-0 z-[1] flex h-7 w-7 items-center justify-center rounded-[5.6px] bg-white shadow-sm transition-transform duration-[550ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none"
              >
                <svg aria-hidden="true" className="text-default-900" width="17" height="17" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M28.9383 16.6301C29.1117 16.2167 29.1117 15.7634 28.9383 15.35C28.8583 15.15 28.7383 14.9634 28.5783 14.8034L19.1517 5.37672C18.4983 4.72339 17.445 4.72339 16.7917 5.37672C16.1383 6.03005 16.1383 7.08338 16.7917 7.73671L23.3783 14.3234L4.77832 14.3234C3.85832 14.3234 3.11165 15.0701 3.11165 15.9901C3.11165 16.9101 3.85832 17.6567 4.77832 17.6567H23.3783L16.7917 24.2434C16.1383 24.8967 16.1383 25.95 16.7917 26.6034C17.1117 26.9234 17.5383 27.0967 17.965 27.0967C18.3917 27.0967 18.8183 26.9367 19.1383 26.6034L28.565 17.1767C28.725 17.0167 28.845 16.8434 28.925 16.6301H28.9383Z"
                    fill="currentColor"
                  />
                </svg>
              </span>

              {showcaseFeaturesData.map((feature, idx) => {
                const isActive = activeShowcaseIdx === idx
                return (
                  <div key={feature.title} className="flex flex-col">
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setActiveShowcaseIdx(idx)}
                      style={{ height: '58px' }}
                      className="flex cursor-pointer items-center text-left"
                    >
                      <span
                        className={`text-default-900 text-[1.25rem] leading-[1.3] font-bold tracking-[-0.02em] transition-[transform,opacity] duration-[550ms,300ms] ease-[cubic-bezier(0.2,0,0,1)] hover:opacity-100 motion-reduce:transition-none ${
                          isActive ? 'translate-x-11 opacity-100' : 'translate-x-0 opacity-90'
                        }`}
                      >
                        {feature.title}
                      </span>
                    </button>

                    <div
                      aria-hidden={!isActive}
                      className={`grid transition-[grid-template-rows] duration-[550ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${
                        isActive ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                      }`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <p
                          className={`text-default-700 max-w-[400px] text-[1rem] leading-[1.5] tracking-[-0.02em] transition-[opacity,transform] duration-[400ms,550ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${
                            isActive ? 'translate-y-0 opacity-100 delay-150' : '-translate-y-1.5 opacity-0 delay-0'
                          }`}
                        >
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HowItWorks
