import { Icon } from '@iconify/react'
import Image from 'next/image'
import Link from 'next/link'

import metalSilver01 from '@/assets/images/about/metal-silver-01.webp'
import vaultSecure02 from '@/assets/images/about/vault-secure-02.webp'
import floatBar01 from '@/assets/images/workspace/correnthian-float-bar-01.png'
import floatBar02 from '@/assets/images/workspace/correnthian-float-bar-02.png'
import floatBar03 from '@/assets/images/workspace/correnthian-float-bar-03.png'
import correnthianPortfolioPhone from '@/assets/images/workspace/correnthian-portfolio-phone.png'
import silverBgImage from '@/assets/images/workspace/correnthian-silver-bg.webp'
import silverPhoneMockup from '@/assets/images/workspace/correnthian-silver-phone.png'

type PillarItem = {
  icon: string
  title: string
  description: string
}

type Pillar = {
  title: string
  icon: string
  bgColorClass: string
  items: PillarItem[]
}

const pillarsData: Pillar[] = [
  {
    title: 'Simplicity',
    icon: 'lucide:zap',
    bgColorClass: 'bg-primary-3',
    items: [
      {
        icon: 'lucide:rocket',
        title: 'Start in Minutes',
        description: 'Create an account or download the mobile app with a few clicks',
      },
      {
        icon: 'lucide:clock',
        title: 'Trade 24/7',
        description: 'Buy and sell even when markets are closed',
      },
      {
        icon: 'lucide:headset',
        title: 'Get Live Support',
        description: 'Call, email, or chat 5 days a week',
      },
    ],
  },
  {
    title: 'Value',
    icon: 'lucide:gem',
    bgColorClass: 'bg-primary-7',
    items: [
      {
        icon: 'lucide:arrow-left-right',
        title: 'High Liquidity',
        description: 'Sell metal and withdraw cash seamlessly',
      },
      {
        icon: 'lucide:badge-percent',
        title: 'Low Premiums',
        description: 'Industry low prices and regular "at spot" promotions',
      },
      {
        icon: 'lucide:receipt',
        title: 'No Sales Tax',
        description: 'No sales tax on vaulted metal',
      },
    ],
  },
  {
    title: 'Trust',
    icon: 'lucide:shield-check',
    bgColorClass: 'bg-primary-6',
    items: [
      {
        icon: 'lucide:lock',
        title: 'Physically Secured Vaults',
        description: 'Store metal with trusted industry leaders',
      },
      {
        icon: 'lucide:clipboard-check',
        title: 'Fully Audited',
        description: 'Regular third-party audits',
      },
      {
        icon: 'lucide:umbrella',
        title: 'Fully Insured',
        description: "Metals are insured through Lloyd's of London",
      },
    ],
  },
  {
    title: 'Access',
    icon: 'lucide:globe',
    bgColorClass: 'bg-primary-2',
    items: [
      {
        icon: 'lucide:credit-card',
        title: 'Global Coverage',
        description: 'Use the Correnthian Card anywhere MasterCard is accepted',
      },
      {
        icon: 'lucide:smartphone',
        title: 'Mobile Convenience',
        description: 'Manage your portfolio from our best-in-class mobile app.',
      },
      {
        icon: 'lucide:landmark',
        title: 'Skip the Banks',
        description: 'Spend the gold and silver you have with no banks involved',
      },
    ],
  },
]

type WhyChooseItem = {
  icon: string
  bgColorClass: string
  text: string
}

const whyChooseLeftData: WhyChooseItem[] = [
  {
    icon: 'lucide:coins',
    bgColorClass: 'bg-primary-1',
    text: 'Passive monthly yield, paid directly in physical silver',
  },
  {
    icon: 'lucide:shield-check',
    bgColorClass: 'bg-primary-3',
    text: '100% allocated bullion stored in audited, insured vaults',
  },
]

const whyChooseRightData: WhyChooseItem[] = [
  {
    icon: 'lucide:arrow-left-right',
    bgColorClass: 'bg-primary-6',
    text: 'Instant liquidity across gold, silver, cash, and crypto',
  },
  {
    icon: 'lucide:package-check',
    bgColorClass: 'bg-primary-2',
    text: 'Redeem for physical bars delivered straight to your door',
  },
]

const WhyChooseCard = ({ item }: { item: WhyChooseItem }) => (
  <article className="relative flex min-h-[180px] flex-1 flex-col justify-between rounded-2xl bg-white p-6 transition-[transform,box-shadow] duration-300 md:min-h-[163px] [@media(hover:hover)]:hover:z-10 [@media(hover:hover)]:hover:scale-105 [@media(hover:hover)]:hover:shadow-[0px_8px_24px_rgba(0,0,0,0.06)]">
    <div className={`${item.bgColorClass} flex size-10 shrink-0 items-center justify-center rounded-full`}>
      <Icon icon={item.icon} className="size-5 text-white" />
    </div>
    <p className="text-default-900 text-base leading-[1.45] font-medium md:text-lg">{item.text}</p>
  </article>
)

const BentoPillarCard = ({ pillar, flexClass }: { pillar: Pillar; flexClass: string }) => (
  <article className={`relative flex flex-col gap-4 rounded-2xl bg-white p-6 transition-[background-color,box-shadow,transform] duration-300 md:min-h-[303px] md:justify-between md:gap-6 [@media(hover:hover)]:hover:z-10 [@media(hover:hover)]:hover:scale-[1.03] [@media(hover:hover)]:hover:bg-white [@media(hover:hover)]:hover:shadow-[0px_8px_24px_rgba(0,0,0,0.06)] ${flexClass}`}>
    <div className="flex items-center gap-3">
      <div className={`${pillar.bgColorClass} flex size-10 shrink-0 items-center justify-center rounded-full md:size-11`}>
        <Icon icon={pillar.icon} className="size-5 text-white" />
      </div>
      <h4 className="text-default-900 text-[1.25rem] leading-[1.1] font-bold tracking-[-0.02em] md:text-[1.5rem]">{pillar.title}</h4>
    </div>

    <div className="text-default-900 flex flex-col gap-3.5 md:gap-4">
      {pillar.items.map((item) => (
        <div key={item.title} className="flex items-start gap-3">
          <div className="bg-default-100 text-default-800 mt-0.5 flex size-7.5 shrink-0 items-center justify-center rounded-lg">
            <Icon icon={item.icon} className="size-4" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h5 className="text-sm leading-[1.2] font-semibold tracking-[-0.01em] md:text-base">{item.title}</h5>
            <p className="text-xs leading-[1.45] opacity-70 md:text-sm">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  </article>
)

const SilverYield = () => {
  return (
    <section className="pb-25 lg:pb-50" id="smart-assist">
      <div className="container">
        <div className="mb-20 grid grid-cols-1 items-center gap-7.5 md:grid-cols-2">
          <div>
            <span className="border-default-200 text-default-800 mb-2.5 inline-block rounded-full border bg-white px-5 py-1.5 text-sm font-medium">Allocated physical silver</span>
            <h3 className="text-default-900 mb-2.5 text-3xl leading-tight font-medium tracking-tight md:text-4xl lg:text-5xl">
              Choose the metal
              <br className="hidden md:block" />
              powering the future
            </h3>
            <p className="text-default-500 mb-6 max-w-lg text-base leading-normal md:text-lg md:leading-relaxed">Harness the limitless potential of silver. Own the metal that makes innovation possible and earn a passive monthly income – paid in silver – from day 1.</p>
            <div>
              <Link href="" className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-black px-8.5 text-white shadow-xl transition-all duration-300 hover:scale-95">
                <span className="relative inline-flex flex-col items-center transition-transform duration-300 group-hover:-translate-y-full">
                  <span className="flex h-14 items-center gap-3">
                    <span className="font-medium">Learn about silver</span>
                  </span>
                  <span className="absolute top-full flex h-14 items-center gap-3">
                    <span className="font-medium">Learn about silver</span>
                  </span>
                </span>
              </Link>
            </div>
          </div>

          <div
            className="group relative mx-auto flex h-100 w-full items-center justify-center overflow-hidden rounded-2xl bg-cover bg-center shadow-2xl md:aspect-video lg:aspect-[4/3] lg:h-142 lg:max-w-4xl"
            style={{ backgroundImage: `url(${silverBgImage.src})` }}
          >
            <div className="absolute top-10 -right-16 transition-transform duration-700 ease-out md:top-20">
              <Image src={silverPhoneMockup} alt="Correnthian Digital Vault Assets Smartphone Mockup" className="h-auto -rotate-20 lg:w-xs" />
            </div>

            <div className="absolute top-12 left-6 z-30 hidden flex-col gap-4 md:top-20 md:left-12 lg:flex">
              <div className="animate-float">
                <Image src={floatBar01} alt="Correnthian 100g Fine Silver 999.0 Bar" className="w-48 drop-shadow-2xl md:w-64" />
              </div>
              <div className="animate-float">
                <Image src={floatBar02} alt="Correnthian Fine Gold Bullion Bar" className="ms-2 w-48 drop-shadow-2xl md:ms-4 md:w-64" />
              </div>
              <div className="animate-float">
                <Image src={floatBar03} alt="Correnthian Fine Silver Bullion Bar" className="w-48 drop-shadow-2xl md:w-64" />
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/15 to-transparent"></div>
          </div>
        </div>

        <div className="mt-24 flex w-full flex-col gap-3 md:gap-5 lg:flex-row">
          <div className="contents md:flex md:flex-1 md:flex-col md:gap-5">
            <div className="contents md:flex md:flex-row md:gap-5">
              <BentoPillarCard pillar={pillarsData[0]} flexClass="md:flex-[347]" />
              <BentoPillarCard pillar={pillarsData[1]} flexClass="md:flex-[438]" />
            </div>

            <div className="contents md:flex md:flex-row md:gap-5">
              <div className="relative h-[200px] overflow-hidden rounded-2xl md:h-auto md:min-h-[303px] md:flex-[255]">
                <Image src={metalSilver01} alt="Allocated fine silver bars" fill className="block object-cover" sizes="(max-width: 768px) 100vw, 255px" />
              </div>
              <BentoPillarCard pillar={pillarsData[2]} flexClass="md:flex-[256]" />
              <BentoPillarCard pillar={pillarsData[3]} flexClass="md:flex-[255]" />
            </div>
          </div>

          <div className="relative h-[200px] overflow-hidden rounded-2xl md:hidden md:h-auto md:min-h-[303px] lg:block lg:w-[257px]">
            <Image src={vaultSecure02} alt="Secured precious metals vault custody" fill className="block object-cover" sizes="(max-width: 1024px) 100vw, 257px" />
          </div>
        </div>

        <div className="mt-24 flex w-full flex-col items-start gap-8 md:items-center md:gap-14 lg:mt-32">
          <h2 className="text-default-900 text-left text-3xl leading-tight font-medium tracking-tight md:text-center md:text-4xl lg:text-5xl">Why choose Correnthian?</h2>

          <div className="flex w-full flex-col gap-3 md:gap-5 lg:min-h-[440px] lg:flex-row lg:items-stretch">
            <div className="contents md:flex md:gap-5 lg:flex-[255] lg:flex-col">
              {whyChooseLeftData.map((item) => (
                <WhyChooseCard key={item.text} item={item} />
              ))}
            </div>

            <div className="relative min-h-[360px] w-full overflow-hidden rounded-2xl bg-white md:min-h-[420px] lg:h-auto lg:flex-[530]">
              <Image src={correnthianPortfolioPhone} alt="Correnthian Digital Vault portfolio app" fill className="block object-contain p-3" sizes="(max-width: 1024px) 100vw, 530px" />
            </div>

            <div className="contents md:flex md:gap-5 lg:flex-[255] lg:flex-col">
              {whyChooseRightData.map((item) => (
                <WhyChooseCard key={item.text} item={item} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default SilverYield
