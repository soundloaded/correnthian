import Image, { StaticImageData } from 'next/image'
import Link from 'next/link'

import icon42 from '@/assets/images/icons/correnthian-trust-01.svg'
import icon43 from '@/assets/images/icons/correnthian-trust-02.svg'
import icon44 from '@/assets/images/icons/correnthian-trust-03.svg'
import icon12 from '@/assets/images/icons/correnthian-trust-04.svg'
import icon13 from '@/assets/images/icons/correnthian-trust-05.svg'
import icon16 from '@/assets/images/icons/correnthian-trust-06.svg'
import icon17 from '@/assets/images/icons/correnthian-trust-07.svg'
import featureBg3 from '@/assets/images/locations/correnthian-audit-bg.webp'
import featureBg1 from '@/assets/images/locations/correnthian-faq-bg.webp'
import featureBg4 from '@/assets/images/locations/correnthian-ownership-bg.webp'
import featureBg2 from '@/assets/images/locations/correnthian-vaults-bg.webp'
import dashboard09 from '@/assets/images/workspace/correnthian-allocated-bars.png'

export type StreakRule = {
  bgColorClass: string
  icon: StaticImageData
  label: string
}

const streakRules: StreakRule[] = [
  { bgColorClass: 'bg-primary-1', icon: icon42, label: 'Fully allocated' },
  { bgColorClass: 'bg-primary-6', icon: icon43, label: 'In your name' },
  { bgColorClass: 'bg-primary-8', icon: icon44, label: 'Insured vaults' },
  { bgColorClass: 'bg-primary-2', icon: icon12, label: 'Independent audits' },
  { bgColorClass: 'bg-primary-3', icon: icon13, label: 'Daily settlement' },
  { bgColorClass: 'bg-primary-4', icon: icon16, label: 'Global vaults' },
  { bgColorClass: 'bg-primary-7', icon: icon17, label: 'Physical redemption' },
]

const Features = () => {
  return (
    <section id="features" className="relative pb-8 md:pb-25 lg:pb-50">
      <div className="container">
        <div className="mb-12.5 grid grid-cols-1 items-center gap-3.5 md:grid-cols-2 lg:gap-8">
          <div>
            <div className="mb-3.5 inline-flex">
              <span className="border-default-200 text-default-800 inline-block rounded-full border bg-white px-5 py-1.5 text-sm font-medium">Own it outright</span>
            </div>
            <h2 className="text-3xl leading-tight font-medium md:text-4xl lg:w-lg lg:text-5xl">Gold, held in your name.</h2>
          </div>
          <div>
            <p className="text-default-600 float-end text-lg leading-normal lg:w-md">Buy, hold, and sell physical gold with insured storage and an online account for what you own.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-7.5 lg:grid-cols-2">
          <div className="bg-default-200 overflow-hidden rounded-3xl">
            <div className="px-3.5 py-3.5 md:px-5 md:py-5 lg:px-10 lg:pt-10 lg:pb-12.5">
              <h3 className="text-default-800 mb-2.5 text-xl font-semibold md:text-2xl">Owned by you</h3>
              <p className="text-default-600 max-w-md text-lg">Fully allocated metal held in your name — separate from our balance sheet, backed by independent checks.</p>
            </div>

            <div className="relative mb-7.5 overflow-hidden">
              <Image src={dashboard09} alt="Allocated gold bars" className="mx-auto w-62 rounded-lg object-cover md:h-75 md:w-100" />
            </div>

            <div className="relative overflow-hidden">
              <div className="animate-marquee flex w-max gap-5 pb-5 lg:pb-20">
                {streakRules.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-3 rounded-full bg-white py-2.5 ps-2.5 pe-5 backdrop-blur-sm">
                    <div className={`flex size-8 items-center justify-center rounded-full ${rule.bgColorClass}`}>
                      <Image src={rule.icon} alt="" className="size-3.25" />
                    </div>
                    <span className="text-default-800 text-sm font-medium whitespace-nowrap">{rule.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-y-5 rounded-3xl p-3.5 md:p-5 lg:gap-y-12.5 lg:p-10" style={{ backgroundImage: `url(${featureBg1.src})` }}>
            <div>
              <h3 className="mb-2.5 text-xl font-semibold text-white md:text-2xl">Before you begin</h3>
              <p className="text-lg text-gray-400 lg:w-md">Three answers worth knowing before you open a Holding.</p>
            </div>
            <div className="min-h-40 lg:min-h-60">
              <p className="text-4xl leading-tight font-extrabold text-white md:text-5xl lg:text-6xl">
                Gold you own,
                <br />
                vaults you trust.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="relative overflow-hidden rounded-2xl bg-black bg-cover bg-top p-3.5 md:p-5 lg:p-10" style={{ backgroundImage: `url(${featureBg2.src})` }}>
              <div className="absolute inset-0 bg-black/40"></div>
              <div className="relative z-10 grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-10">
                <div className="flex h-full flex-col justify-between">
                  <div className="lg:max-w-md">
                    <h3 className="mb-2.5 text-xl leading-tight font-semibold text-white md:text-2xl">Your Holding — an account for what you own</h3>
                    <p className="text-default-400 mb-5 text-base leading-relaxed md:mb-7.5 md:text-lg">Open and verify your account, fund and purchase your chosen metals, then manage everything online.</p>
                    <Link href="/contact" className="group relative inline-flex overflow-hidden rounded-full bg-white px-3.5 py-3 text-sm font-medium text-black transition-all duration-300 hover:scale-95 md:px-8.5 md:py-3 md:text-lg">
                      <span className="relative block overflow-hidden">
                        <span className="block transition-transform duration-300 group-hover:-translate-y-full">Open your holding</span>
                        <span className="absolute top-full left-0 block transition-transform duration-300 group-hover:-translate-y-full">Open your holding</span>
                      </span>
                    </Link>
                  </div>
                  <p className="text-default-500 mt-5 text-sm md:mt-14">*Fund by bank transfer. Buy, hold, or sell through your account.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative min-h-105 overflow-hidden rounded-3xl bg-cover bg-center p-3.5 md:p-5 lg:min-h-130 lg:p-10" style={{ backgroundImage: `url(${featureBg3.src})` }}>
            <div className="absolute inset-0 bg-linear-to-b from-black/30 via-black/50 to-black/80"></div>
            <div className="relative z-10">
              <div className="mb-6 max-w-2xl md:mb-12.5">
                <h3 className="mb-2.5 text-xl leading-tight font-semibold text-white md:text-2xl">Stamped bars. Sealed vaults.</h3>
                <p className="text-default-300 text-base leading-relaxed md:w-sm md:text-lg">Investment-grade gold and silver, stamped and stored behind vault doors — verified by independent checks, so your holding is always the real metal.</p>
              </div>
            </div>
          </div>

          <div className="relative flex min-h-80 items-center overflow-hidden rounded-3xl bg-cover bg-center p-5 lg:min-h-105 lg:p-10" style={{ backgroundImage: `url(${featureBg4.src})` }}>
            <div className="absolute inset-0 bg-black/50"></div>
            <div className="relative z-10">
              <div className="max-w-xl">
                <h3 className="mb-2.5 text-3xl leading-tight font-extrabold text-white md:text-4xl">Own your gold. Always.</h3>
                <p className="text-default-300 w-sm text-lg leading-relaxed">You are the legal owner of your gold, no matter what. We’ll even deliver your gold straight to your front door, any time.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Features
