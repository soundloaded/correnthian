import { Icon } from '@iconify/react'
import Image, { StaticImageData } from 'next/image'
import Link from 'next/link'

import cryptoBitcoin02 from '@/assets/images/about/crypto-bitcoin-02.webp'
import metalSilver01 from '@/assets/images/about/metal-silver-01.webp'
import metalSilver02 from '@/assets/images/about/metal-silver-02.webp'
import platformCard01 from '@/assets/images/about/platform-card-01.webp'
import platformCard02 from '@/assets/images/about/platform-card-02.webp'
import platformCard03 from '@/assets/images/about/platform-card-03.webp'
import platformCard04 from '@/assets/images/about/platform-card-04.webp'
import vaultGold01 from '@/assets/images/about/vault-gold-01.webp'
import vaultGold02 from '@/assets/images/about/vault-gold-02.webp'
import vaultSecure02 from '@/assets/images/about/vault-secure-02.webp'
import avatar01 from '@/assets/images/team/avatar-01.webp'
import avatar02 from '@/assets/images/team/avatar-02.webp'
import avatar03 from '@/assets/images/team/avatar-03.webp'

type Card = {
  image: StaticImageData
  alt: string
  eyebrow: string
  headline: string
  subline?: string
  stat?: string
}

const cards: Card[] = [
  {
    image: platformCard01,
    alt: 'Correnthian Digital Vault mobile app flanked by fine silver and fine gold bullion bars',
    eyebrow: 'Trade 24/7',
    headline: 'Buy and sell using our best-in-class mobile app',
    subline: 'Live spot execution even when traditional markets are closed',
    stat: '24/7',
  },
  {
    image: vaultGold01,
    alt: 'Stacked allocated gold bars inside a vault',
    eyebrow: 'Allocated, not paper',
    headline: 'Every gram matched to a named bar in the vault',
    stat: '100% backed',
  },
  {
    image: platformCard02,
    alt: 'Correnthian Digital Vault AutoInvest recurring order screen for Zurich Gold and Singapore Silver',
    eyebrow: 'AutoInvest',
    headline: 'Schedule your investing with automated recurring buys',
    subline: 'Build your allocated gold and silver stack effortlessly',
    stat: 'From $10',
  },
  {
    image: vaultGold02,
    alt: 'One-kilogram fine gold bar ready for redemption',
    eyebrow: 'Take it out',
    headline: 'Redeem for physical bars when the stack is big enough',
    stat: 'Real metal',
  },
  {
    image: platformCard03,
    alt: 'Correnthian black and gold Mastercard flanked by fine gold and silver bullion bars',
    eyebrow: 'Correnthian Card',
    headline: 'Spend your metal as currency with no transaction fees',
    subline: 'Use the Correnthian Card anywhere Mastercard is accepted',
    stat: '$0 Fees',
  },
  {
    image: vaultSecure02,
    alt: 'Gloved hand placing a gold bar into a vault drawer',
    eyebrow: 'Independently vaulted',
    headline: 'Stored with professional custodians, audited and disclosed',
    stat: 'Audited',
  },
  {
    image: platformCard04,
    alt: 'Glowing gold and silver market price lines with automated limit order trigger nodes',
    eyebrow: 'Limit Orders',
    headline: 'Never miss another market movement with automated targets',
    subline: 'Set your target entry or exit price for gold and silver 24/7',
    stat: 'Auto-fill',
  },
  {
    image: metalSilver01,
    alt: 'Stacked fine silver bars',
    eyebrow: 'Gold and silver',
    headline: 'Split across both metals in one account',
    stat: '2 metals',
  },
  {
    image: metalSilver02,
    alt: 'Sovereign silver bullion coins alongside stamped 100g fine silver bars',
    eyebrow: 'Bars & Coins',
    headline: 'Convert your vaulted metals into physical bars and coins',
    subline: 'Delivered insured straight to your front door anytime',
    stat: '999.9',
  },
  {
    image: cryptoBitcoin02,
    alt: 'Correnthian mobile portfolio alongside 1 oz 999.9 fine gold bullion coins',
    eyebrow: 'The Bullion Card',
    headline: 'Invest as you spend and earn 4% back in gold & silver',
    subline: 'Turn everyday purchases into allocated physical bullion',
    stat: '4% Back',
  },
]

const CardFigure = ({ card, hidden = false }: { card: Card; hidden?: boolean }) => (
  <div aria-hidden={hidden || undefined} className="group relative flex h-75 w-95 shrink-0 flex-col justify-between overflow-hidden rounded-2xl p-7.5 md:h-128">
    <Image src={card.image} className="absolute inset-0 h-full w-full object-cover" alt={card.alt} />
    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
    <div className="relative z-10">
      <p className="text-sm font-medium tracking-wide text-white/70 uppercase">{card.eyebrow}</p>
    </div>
    <div className="relative z-10">
      {card.stat && <h3 className="mb-1 text-4xl font-black text-white md:text-5xl">{card.stat}</h3>}
      <p className="text-lg leading-tight font-medium whitespace-normal text-white">{card.headline}</p>
      {card.subline && <p className="mt-1 text-sm font-normal whitespace-normal text-white/70">{card.subline}</p>}
    </div>
  </div>
)

const PlatformFeatures = () => {
  return (
    <section className="py-25 lg:py-50" id="metrics">
      <div className="container">
        <div className="mb-8 flex flex-col items-end justify-between gap-4 md:mb-12.5 md:flex-row md:gap-8">
          <h2 className="text-default-900 text-3xl leading-tight font-medium tracking-tight md:w-lg md:text-4xl lg:text-5xl">Own, redeem, & spend like currency — all in one platform</h2>

          <div className="flex flex-col items-start justify-start space-y-2.5 text-start md:items-end md:justify-end">
            <div className="flex items-center justify-start md:justify-end">
              <div className="flex -space-x-4">
                <Image className="border-default-800 h-10 w-10 rounded-full border-2 object-cover" src={avatar01} alt="Early member" />
                <Image className="border-default-800 h-10 w-10 rounded-full border-2 object-cover" src={avatar02} alt="Early member" />
                <Image className="border-default-800 h-10 w-10 rounded-full border-2 object-cover" src={avatar03} alt="Early member" />
                <div className="border-default-800 bg-default-900 flex h-10 w-10 items-center justify-center rounded-full border-2 text-[8px] font-medium text-white">You?</div>
              </div>
            </div>
            <div className="text-primary-1 flex gap-1.75">
              <Icon icon="tabler:star-filled" className="size-4" />
              <Icon icon="tabler:star-filled" className="size-4" />
              <Icon icon="tabler:star-filled" className="size-4" />
              <Icon icon="tabler:star-filled" className="size-4" />
              <Icon icon="tabler:star-filled" className="size-4" />
            </div>
            <div className="text-default-600 text-lg font-medium">
              Join the waitlist —{' '}
              <Link href="/waitlist" className="underline underline-offset-4">
                be first in
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="relative flex overflow-hidden">
        <div className="animate-marquee flex gap-7.5 py-4 pr-7.5 whitespace-nowrap">
          {cards.map((card) => (
            <CardFigure key={card.eyebrow} card={card} />
          ))}
          {cards.map((card) => (
            <CardFigure key={`dup-${card.eyebrow}`} card={card} hidden />
          ))}
        </div>
      </div>
    </section>
  )
}

export default PlatformFeatures
