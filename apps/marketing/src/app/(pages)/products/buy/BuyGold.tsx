import goldBar from '@/assets/images/about/vault-gold-02.webp'
import goldStack from '@/assets/images/about/vault-gold-01.webp'
import silverBars from '@/assets/images/about/metal-silver-01.webp'
import { Icon } from '@iconify/react'
import Image, { type StaticImageData } from 'next/image'
import Link from 'next/link'

type Way = {
  id: 'card' | 'bank' | 'hold'
  label: string
  title: string
  body: string
  image: StaticImageData
  alt: string
  href: string
  link: string
}

const ways: readonly Way[] = [
  {
    id: 'card',
    label: 'Card',
    title: 'The card never reaches us',
    body: 'A provider would take the card and run the check. Correnthian does not see the number and does not hold the payment. That screen stays closed until a provider is contracted.',
    image: goldBar,
    alt: 'A single fine gold bar on dark cloth',
    href: '/waitlist',
    link: 'Join the waitlist',
  },
  {
    id: 'bank',
    label: 'Bank transfer',
    title: 'The transfer stays with the provider',
    body: 'A bank transfer is the same closed path. The provider would take the money and deliver the gold token to an account only you can move. Correnthian does not hold the bank account.',
    image: goldStack,
    alt: 'Stacked gold bars',
    href: '/waitlist',
    link: 'Join the waitlist',
  },
  {
    id: 'hold',
    label: 'Assets you hold',
    title: 'Gold you can already reach',
    body: 'If you already hold assets, gold is a swap. The server can prepare an unsigned quote. Your device signs it. A quote does not move funds, and a live fill waits on a liquidity provider.',
    image: goldBar,
    alt: 'A single fine gold bar on dark cloth',
    href: '/products/swap',
    link: 'See the swap',
  },
]

const facts = [
  {
    icon: 'lucide:fingerprint',
    title: 'Named on the record',
    body: 'Chain, contract, and issuer say which gold token this is. Someone else issued it. Correnthian lists it.',
  },
  {
    icon: 'lucide:layers',
    title: 'Allocated, or labeled otherwise',
    body: 'The holding is shown as gold you can take out only when specific metal is reserved for that token. A price tracker is labeled as price exposure.',
  },
  {
    icon: 'lucide:wallet',
    title: 'An account only you can move',
    body: 'The token is delivered to your account. The key stays on your device. Correnthian has no key that can move it.',
  },
  {
    icon: 'lucide:receipt',
    title: 'Three fee lines',
    body: 'Provider, network, and Correnthian are itemised on the quote. No percentage is published, and the purchase is refused.',
  },
  {
    icon: 'lucide:package',
    title: 'A request to take it out',
    body: 'Taking gold out is a request the issuer fulfils. The jurisdiction comes from the account. Correnthian does not ship the bars.',
  },
]

const worlds = [
  {
    title: 'The metal, when it is metal',
    image: goldStack,
    alt: 'Stacked gold bars',
    items: [
      ['Named, not assumed', 'Chain, contract, and issuer'],
      ['Allocated means reserved', 'Specific gold for that token'],
      ['Otherwise it is a tracker', 'Price exposure stays labeled'],
      ['Not a Correnthian bar', 'We do not mint it or vault it'],
    ],
  },
  {
    title: 'The account you move',
    image: goldBar,
    alt: 'A single fine gold bar on dark cloth',
    items: [
      ['The key stays with you', 'Correnthian cannot move the holding'],
      ['A quote is not a fill', 'Your device signs. A live fill waits'],
      ['Buying is refused', 'Until a provider is contracted'],
      ['Three lines, no rate', 'Provider, network, and Correnthian'],
    ],
  },
] as const

const comparisons = [
  {
    label: 'What you hold',
    here: 'A token someone else issued',
    bullion: 'The bar itself',
    cash: 'A bank balance',
  },
  {
    label: 'Who can move it',
    here: 'Only your device',
    bullion: 'Whoever holds the bar',
    cash: 'You, and the bank',
  },
  {
    label: 'Buy with a card today',
    here: 'Refused',
    bullion: 'From a dealer',
    cash: 'At your bank',
  },
  {
    label: 'Fees before you pay',
    here: 'Three named lines, no rate',
    bullion: 'The dealer’s premium',
    cash: 'The bank’s fees',
  },
  {
    label: 'Where the metal sits',
    here: 'With the issuer, if allocated',
    bullion: 'With you, or a vault you choose',
    cash: 'There is no metal',
  },
  {
    label: 'Take metal out',
    here: 'A request the issuer fulfils',
    bullion: 'You already have it',
    cash: 'Not metal',
  },
  {
    label: 'A yield on gold',
    here: 'None',
    bullion: 'None from this page',
    cash: 'Set by the bank',
  },
] as const

const startSteps = [
  {
    image: goldBar,
    alt: 'A single fine gold bar on dark cloth',
    title: 'Join the waitlist',
    body: 'Tell us you want the card and bank path. The buy screen stays closed.',
  },
  {
    image: goldStack,
    alt: 'Stacked gold bars',
    title: 'Read the three lines',
    body: 'Provider, network, and Correnthian are named. No percentage is published.',
  },
  {
    image: goldBar,
    alt: 'A single fine gold bar on dark cloth',
    title: 'The purchase stays refused',
    body: 'Nothing on this page takes a card or a transfer.',
  },
]

const faqs = [
  {
    question: 'How do I buy gold?',
    answer: 'A card or a bank transfer would go through a licensed provider. No provider is contracted, so the buy screen refuses a purchase and says so.',
  },
  {
    question: 'How do I hold gold here?',
    answer: 'You hold a token someone else issued, in an account only you can move. Correnthian does not run an exchange and does not mint the token.',
  },
  {
    question: 'How is the price shown?',
    answer: 'This page does not publish a live gold price. When a purchase is open, the quote shows the amount and the three fee lines. No rate is published yet.',
  },
  {
    question: 'Does this gold pay a yield?',
    answer: 'No. Correnthian does not pay a yield, in gold or in anything else.',
  },
]

const related = [
  {
    href: '/products/gold',
    title: 'Gold',
    body: 'The registry entry: who issued the token, and whether specific metal is allocated.',
    image: goldStack,
    alt: 'Stacked gold bars',
    link: 'See the asset',
  },
  {
    href: '/products/swap',
    title: 'Swap',
    body: 'Move assets you already hold. The server prepares an unsigned quote. Your device signs.',
    image: goldBar,
    alt: 'A single fine gold bar on dark cloth',
    link: 'See the swap',
  },
  {
    href: '/products/buy-silver',
    title: 'Buy silver',
    body: 'The card or bank path for silver, on its own page. That purchase is refused too.',
    image: silverBars,
    alt: 'Stacked fine silver bars',
    link: 'See buy silver',
  },
]

function PrimaryLink({ href, children, light = false }: { href: string; children: string; light?: boolean }) {
  return (
    <Link href={href} className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition-all hover:scale-95 ${light ? 'bg-white text-black' : 'bg-default-900 text-white'}`}>
      {children}
    </Link>
  )
}

function SecondaryLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="text-default-900 inline-flex items-center justify-center rounded-full bg-zinc-100 px-6 py-3 text-sm font-medium transition-all hover:scale-95">
      {children}
    </Link>
  )
}

function Split({
  id,
  title,
  paragraphs,
  primary,
  secondary,
  image,
  alt,
  imageFirst,
}: {
  id: string
  title: string
  paragraphs: readonly string[]
  primary: { href: string; label: string }
  secondary: { href: string; label: string }
  image: StaticImageData
  alt: string
  imageFirst?: boolean
}) {
  const textClass = imageFirst
    ? 'col-span-4 md:col-span-6 md:col-start-2 lg:col-span-5 lg:col-start-auto xl:col-span-4 xl:col-start-8 lg:order-last'
    : 'col-span-4 md:col-span-6 md:col-start-2 lg:col-span-5 lg:col-start-auto xl:col-span-4 xl:col-start-2 lg:order-first'
  const imageClass = imageFirst
    ? 'relative col-span-4 md:col-span-8 lg:col-span-7 xl:col-span-6 lg:order-first'
    : 'relative col-span-4 md:col-span-8 lg:col-span-7 xl:col-span-6 lg:order-last xl:col-start-7'

  return (
    <section id={id}>
      <div className="container px-6">
        <div className="grid grid-cols-4 items-center md:grid-cols-8 lg:grid-cols-12">
          <div className={textClass}>
            <div className="pt-16 pb-8 md:pt-20 md:pb-10 lg:pb-20">
              <h2 className="text-default-900 text-4xl tracking-tight md:text-5xl">{title}</h2>
              <div className="text-default-600 mt-4 space-y-4 text-base leading-relaxed md:mt-6 md:text-lg">
                {paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3 md:mt-10">
                <PrimaryLink href={primary.href}>{primary.label}</PrimaryLink>
                <SecondaryLink href={secondary.href}>{secondary.label}</SecondaryLink>
              </div>
            </div>
          </div>
          <div className={imageClass}>
            <Image src={image} alt={alt} className={`aspect-video w-full rounded-3xl object-cover ${image === goldStack ? 'object-bottom' : ''}`} />
          </div>
        </div>
      </div>
    </section>
  )
}

export default function BuyGold() {
  return (
    <>
      <section className="relative isolate flex min-h-[78vh] items-center overflow-hidden text-center">
        <Image src={goldBar} alt="" fill priority className="object-cover object-center" />
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 container px-6 py-16 sm:py-20">
          <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12">
            <div className="col-span-4 md:col-span-6 md:col-start-2 lg:col-span-8 lg:col-start-3">
              <h1 className="text-4xl tracking-tight text-white md:text-6xl lg:text-7xl">Name the gold before you buy it</h1>
            </div>
            <div className="col-span-4 md:col-span-6 md:col-start-2 lg:col-span-6 lg:col-start-4">
              <p className="mt-6 text-base leading-relaxed text-white/90 md:text-lg">A third-party gold token, in an account only you can move. Card and bank stay closed until a provider is contracted. This page does not show a live price.</p>
              <div className="mt-8 flex justify-center sm:mt-10">
                <PrimaryLink href="/waitlist" light>
                  Join the waitlist
                </PrimaryLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sticky top-20 z-30 border-y border-zinc-100 bg-white md:top-28 lg:top-36">
        <div className="container px-6 py-3 lg:py-4">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm">
            <span className="text-default-900 inline-flex items-center gap-2 font-medium">
              <Icon icon="lucide:receipt" className="size-5" />
              Fees on the quote
            </span>
            <span className="text-default-900 font-medium">Provider</span>
            <span className="text-default-900 font-medium">Network</span>
            <span className="text-default-900 font-medium">Correnthian</span>
            <span className="text-default-500 hidden sm:inline">No rate is published. A purchase is refused.</span>
            <Link href="/pricing" className="text-default-900 font-medium underline-offset-4 hover:underline">
              How fees are shown
            </Link>
          </div>
        </div>
      </section>

      <section className="overflow-hidden py-16 md:py-20">
        <div className="container px-6">
          <div className="mb-8 grid grid-cols-4 md:mb-10 md:grid-cols-8 lg:grid-cols-12">
            <div className="col-span-4 md:col-span-8 lg:col-span-8 lg:col-start-3">
              <h2 className="text-default-900 text-center text-4xl tracking-tight md:text-5xl lg:text-6xl">Use gold your way</h2>
            </div>
          </div>

          <div className="[&:has(.gold-way-card:checked)_.gold-tab-card]:bg-default-900 [&:has(.gold-way-card:checked)_.gold-tab-card]:text-white [&:has(.gold-way-card:checked)_.gold-panel-card]:grid [&:has(.gold-way-bank:checked)_.gold-tab-bank]:bg-default-900 [&:has(.gold-way-bank:checked)_.gold-tab-bank]:text-white [&:has(.gold-way-bank:checked)_.gold-panel-bank]:grid [&:has(.gold-way-hold:checked)_.gold-tab-hold]:bg-default-900 [&:has(.gold-way-hold:checked)_.gold-tab-hold]:text-white [&:has(.gold-way-hold:checked)_.gold-panel-hold]:grid">
            {ways.map((item, index) => (
              <input key={item.id} id={`gold-way-${item.id}`} name="gold-way" type="radio" defaultChecked={index === 0} className={`gold-way-${item.id} sr-only`} />
            ))}

            <div className="flex w-full justify-center px-4 pb-8 md:px-8 md:pb-10 lg:px-9">
              <div className="-mx-10 min-h-14 overflow-x-auto px-7">
                <div className="text-default-500 relative flex min-w-max items-center justify-center gap-x-1 px-2">
                  {ways.map((item) => (
                    <label key={item.id} htmlFor={`gold-way-${item.id}`} className={`gold-tab-${item.id} cursor-pointer rounded-full px-4 py-2 text-sm font-medium`}>
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="min-h-[420px]">
              {ways.map((item) => (
                <div key={item.id} className={`gold-panel-${item.id} hidden`}>
                  <div className="grid gap-4 lg:grid-cols-12">
                    <div className="flex flex-col justify-center rounded-3xl bg-zinc-100 p-8 md:p-10 lg:col-span-5 lg:p-14">
                      <h3 className="text-default-900 mb-4 text-3xl tracking-tight md:text-4xl">{item.title}</h3>
                      <p className="text-default-600 text-sm leading-relaxed md:text-base">{item.body}</p>
                      <div className="flex justify-start pt-6">
                        <PrimaryLink href={item.href}>{item.link}</PrimaryLink>
                      </div>
                    </div>
                    <div className="relative aspect-5/3 overflow-hidden rounded-3xl md:aspect-auto md:min-h-[420px] lg:col-span-7">
                      <Image src={item.image} alt={item.alt} fill className={`object-cover ${item.image === goldStack ? 'object-bottom' : ''}`} sizes="(min-width: 1024px) 58vw, 100vw" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Split
        id="which-gold"
        title="A token someone else issued"
        paragraphs={['The screen names the chain, the contract, and the issuer before a purchase can start. That is the gold you are looking at.', 'Correnthian registers the token. It does not mint gold, and it does not take the payment.']}
        primary={{ href: '/products/gold', label: 'What counts as gold' }}
        secondary={{ href: '/pricing', label: 'How fees are shown' }}
        image={goldStack}
        alt="Stacked gold bars"
        imageFirst
      />

      <section id="what-is-gold" className="bg-white">
        <div className="container px-6 py-10 md:py-20">
          <div className="grid grid-cols-4 gap-y-8 md:grid-cols-8 lg:grid-cols-12">
            <div className="col-span-4 md:col-span-8 lg:col-span-5">
              <div className="lg:sticky lg:top-40 lg:px-6">
                <h2 className="text-default-900 mb-4 text-4xl tracking-tight md:mb-6 md:text-5xl">What is this gold?</h2>
                <p className="text-default-600 mb-8 text-base leading-relaxed md:mb-10 md:text-lg">A third-party token on the registry. The account that holds it is one only you can move. Correnthian does not issue the token and does not hold the metal.</p>
                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                  <PrimaryLink href="/products/gold">Learn more</PrimaryLink>
                  <SecondaryLink href="/products/swap">See the swap</SecondaryLink>
                </div>
              </div>
            </div>
            <ul className="col-span-4 md:col-span-6 lg:col-span-5 lg:col-start-7 xl:col-start-7">
              {facts.map((fact) => (
                <li key={fact.title} className="relative mb-4 flex last:mb-0 before:absolute before:bottom-0 before:left-6 before:h-[calc(100%-64px)] before:w-px before:bg-zinc-300 last:before:content-none md:pb-16 md:last:pb-0">
                  <div className="mr-8 size-12 shrink-0">
                    <span className="flex size-12 items-center justify-center rounded-full bg-zinc-100">
                      <Icon icon={fact.icon} className="text-default-900 size-6" />
                    </span>
                  </div>
                  <div className="pb-8 md:pb-4">
                    <h3 className="text-default-900 mb-3 text-xl">{fact.title}</h3>
                    <p className="text-default-600 text-sm leading-relaxed md:text-base">{fact.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-10 md:py-14">
        <div className="container px-6">
          <div className="mb-8 grid grid-cols-4 md:mb-10 md:grid-cols-8 lg:mb-16 lg:grid-cols-12">
            <div className="col-span-4 text-center md:col-span-8 lg:col-start-3">
              <h2 className="text-default-900 text-4xl tracking-tight md:text-5xl">The token and the account</h2>
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            {worlds.map((world) => (
              <article key={world.title} className="relative overflow-hidden rounded-3xl">
                <Image src={world.image} alt={world.alt} fill className={`object-cover ${world.image === goldStack ? 'object-bottom' : ''}`} sizes="(min-width: 1280px) 50vw, 100vw" />
                <div className="relative z-10 p-4 md:w-[72%] md:p-8 xl:p-10">
                  <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
                    <h3 className="text-default-900 mb-6 text-center text-3xl">{world.title}</h3>
                    <ul>
                      {world.items.map(([title, detail]) => (
                        <li key={title} className="mb-4 flex items-start last:mb-0">
                          <span className="bg-default-900 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-white">
                            <Icon icon="lucide:check" className="size-4" />
                          </span>
                          <div className="ml-4">
                            <p className="text-default-900 text-base font-medium">{title}</p>
                            <p className="text-default-500 text-sm">{detail}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Split
        id="the-record"
        title="The record you can read"
        paragraphs={['The page can show the issuer, the contract, and whether specific gold is allocated. That sentence is the disclosure.', 'Correnthian does not publish a vault audit. It does not run the vault.']}
        primary={{ href: '/products/gold', label: 'Read the disclosure' }}
        secondary={{ href: '/products/activity', label: 'See activity' }}
        image={goldBar}
        alt="A single fine gold bar on dark cloth"
      />

      <Split
        id="taking-it-out"
        title="Taking gold out"
        paragraphs={['Redemption is a request. The issuer delivers the metal. The jurisdiction comes from your account.', 'Correnthian does not take bars in, does not cover storage, and does not run a mint.']}
        primary={{ href: '/products/redemption', label: 'How redemption works' }}
        secondary={{ href: '/products/gold', label: 'The gold asset' }}
        image={goldStack}
        alt="Stacked gold bars"
        imageFirst
      />

      <section id="beside-the-alternatives" className="py-16 md:py-20">
        <div className="container px-6">
          <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12">
            <div className="col-span-4 text-center md:col-span-8 lg:col-start-3">
              <h2 className="text-default-900 text-4xl tracking-tight md:text-5xl">Set beside the alternatives</h2>
            </div>
            <div className="col-span-4 mt-4 text-center md:col-span-8 md:mt-6 lg:col-start-3">
              <p className="text-default-600 text-base leading-relaxed md:text-lg">What buying through this page can do, next to bullion you hold yourself and next to cash.</p>
            </div>
          </div>
          <div className="mt-8 overflow-x-auto md:mt-10">
            <table className="w-full min-w-[720px] border-separate border-spacing-2 text-center text-sm md:text-base">
              <thead>
                <tr>
                  <th className="px-3 py-4 text-left" />
                  <th className="text-default-900 px-3 py-4 font-medium">Through Correnthian</th>
                  <th className="text-default-900 px-3 py-4 font-medium">Bullion you hold</th>
                  <th className="text-default-900 px-3 py-4 font-medium">Cash</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row) => (
                  <tr key={row.label}>
                    <th className="text-default-900 sticky left-0 bg-white px-3 py-4 text-left font-medium">{row.label}</th>
                    <td className="rounded-xl bg-zinc-100 px-3 py-4">
                      <span className="text-default-900">{row.here}</span>
                    </td>
                    <td className="rounded-xl bg-zinc-50 px-3 py-4">
                      <span className="text-default-700">{row.bullion}</span>
                    </td>
                    <td className="rounded-xl bg-zinc-50 px-3 py-4">
                      <span className="text-default-700">{row.cash}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 flex justify-center sm:mt-10">
            <PrimaryLink href="/waitlist">Join the waitlist</PrimaryLink>
          </div>
        </div>
      </section>

      <section className="bg-zinc-100 py-12 md:py-16">
        <div className="container px-6">
          <div className="mb-12 grid grid-cols-4 md:grid-cols-8 lg:mb-14 lg:grid-cols-12">
            <div className="col-span-4 text-center md:col-span-8 lg:col-start-3">
              <h2 className="text-default-900 text-4xl tracking-tight md:text-5xl">Before anything moves</h2>
            </div>
          </div>
          <ul className="flex flex-wrap justify-center gap-4 md:gap-6">
            {startSteps.map((step) => (
              <li key={step.title} className="relative w-full text-center md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]">
                <Image src={step.image} alt={step.alt} className={`relative z-10 aspect-[6/5] w-full rounded-2xl object-cover ${step.image === goldStack ? 'object-bottom' : ''}`} />
                <div className="relative z-10 flex flex-col items-center gap-3 px-6 pt-6 pb-10">
                  <h3 className="text-default-900 text-xl">{step.title}</h3>
                  <p className="text-default-600 text-base leading-relaxed">{step.body}</p>
                </div>
                <div className="absolute bottom-0 left-0 z-0 h-[calc(100%-3rem)] w-full rounded-3xl bg-white" />
              </li>
            ))}
          </ul>
          <div className="mt-8 flex justify-center md:mt-12">
            <PrimaryLink href="/waitlist">Join the waitlist</PrimaryLink>
          </div>
        </div>
      </section>

      <section className="py-6 md:pb-10 lg:py-25">
        <div className="container">
          <div className="grid grid-cols-1 items-start gap-7.5 md:grid-cols-3 lg:grid-cols-12 lg:gap-25">
            <div className="col-span-1 space-y-10 lg:col-span-5 lg:space-y-20">
              <div className="space-y-4">
                <span className="border-default-200 text-default-800 mb-2.5 inline-block rounded-full border bg-white px-5 py-1.5 text-sm font-medium">Common Questions</span>
                <h2 className="text-default-950 text-2xl leading-normal font-medium tracking-normal md:text-4xl lg:text-5xl">Frequently asked questions</h2>
              </div>
              <div className="space-y-6 rounded-2xl bg-white p-5 shadow-xl shadow-zinc-200/50 md:p-7.5">
                <div className="bg-primary-1 flex size-12.5 items-center justify-center rounded-full text-white shadow-lg">
                  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 11a9 9 0 0 1 18 0" />
                    <path d="M21 16v-2a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2z" />
                    <path d="M3 16v-2a2 2 0 0 1 2-2h1v6H5a2 2 0 0 1-2-2z" />
                    <path d="M21 16v1a4 4 0 0 1-4 4h-5" />
                  </svg>
                </div>
                <div className="space-y-6">
                  <h3 className="text-default-950 mb-3.5 text-xl font-medium md:text-2xl">Can&apos;t find your answer?</h3>
                  <Link href="/contact" className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-black px-8.5 text-nowrap text-white shadow-xl transition-all duration-300 hover:scale-95">
                    <span className="relative inline-flex flex-col items-center transition-transform duration-300 group-hover:-translate-y-full">
                      <span className="flex h-14 items-center gap-3">
                        <span className="font-medium">Contact us</span>
                      </span>
                      <span className="absolute top-full flex h-14 items-center gap-3">
                        <span className="font-medium">Contact us</span>
                      </span>
                    </span>
                  </Link>
                </div>
              </div>
            </div>
            <div className="col-span-2 space-y-2.5 lg:col-span-7 lg:space-y-4">
              <style>{'.gold-faq[open] .gold-faq-plus{transform:rotate(45deg)}.gold-faq[open]{box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.1),0 2px 4px -2px rgb(0 0 0 / 0.1)}'}</style>
              {faqs.map((faq, index) => (
                <details key={faq.question} open={index === 0 ? true : undefined} className="gold-faq rounded-2xl border border-zinc-100 bg-white shadow-sm">
                  <summary className="text-default-900 inline-flex w-full cursor-pointer list-none items-center justify-between p-3.5 text-start font-medium transition hover:text-zinc-500 lg:p-5 [&::-webkit-details-marker]:hidden">
                    <h3 className="pr-3 text-base font-medium md:text-xl">{faq.question}</h3>
                    <span className="gold-faq-plus bg-default-200 text-default-800 relative flex size-6.5 shrink-0 items-center justify-center rounded-full transition-transform duration-300 md:size-8.5">
                      <svg viewBox="0 0 24 24" className="size-3 md:size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </summary>
                  <div className="px-3.5 pb-3.5 text-base leading-normal text-zinc-500 md:text-lg md:leading-relaxed lg:px-5 lg:pb-5">{faq.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="container px-6">
          <div className="mb-10 grid grid-cols-4 text-center md:mb-12 md:grid-cols-8 lg:mb-14 lg:grid-cols-12">
            <div className="col-span-4 md:col-span-8 lg:col-start-3">
              <h2 className="text-default-900 text-4xl tracking-tight md:text-5xl">Continue from here</h2>
            </div>
          </div>
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-12 lg:items-start">
            {related.map((item, index) => (
              <li key={item.href} className={`lg:col-span-4 ${index % 2 === 0 ? 'lg:pt-28' : ''}`}>
                <article className="overflow-hidden rounded-3xl">
                  <Link href={item.href}>
                    <div className="relative h-48">
                      <Image src={item.image} alt={item.alt} fill className={`object-cover ${item.image === goldStack ? 'object-bottom' : ''}`} sizes="(min-width: 1024px) 33vw, 100vw" />
                    </div>
                  </Link>
                  <div className="h-full bg-zinc-100 p-6 xl:px-10 xl:py-8">
                    <h3 className="text-default-900 mb-2 text-xl">{item.title}</h3>
                    <p className="text-default-600 text-base leading-relaxed">{item.body}</p>
                    <Link href={item.href} className="text-default-900 mt-8 inline-flex items-center gap-2 text-sm font-medium">
                      {item.link}
                      <Icon icon="lucide:arrow-right" className="size-4" />
                    </Link>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
