import goldBars from '@/assets/images/workspace/correnthian-allocated-bars.png'
import silverCoins from '@/assets/images/about/metal-silver-02.webp'
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
    title: 'A card, through a provider',
    body: 'The provider runs the check and takes the card. Correnthian does not see the card number, and it does not hold the payment. The screen stays closed until a provider is contracted.',
    image: silverBars,
    alt: 'Stacked fine silver bars',
    href: '/waitlist',
    link: 'Join the waitlist',
  },
  {
    id: 'bank',
    label: 'Bank transfer',
    title: 'A bank transfer, through a provider',
    body: 'A transfer is the same path as a card. The provider takes the money and delivers the silver token to an account only you can move. Correnthian does not hold the bank account.',
    image: silverCoins,
    alt: 'Silver coins beside small fine silver bars',
    href: '/waitlist',
    link: 'Join the waitlist',
  },
  {
    id: 'hold',
    label: 'Assets you hold',
    title: 'A swap, not a purchase',
    body: 'If you already hold assets, silver is a swap. The server can prepare a quote. Your device signs it. Asking for a quote does not move funds.',
    image: silverCoins,
    alt: 'Silver coins beside small fine silver bars',
    href: '/products/swap',
    link: 'See the swap',
  },
]

const facts = [
  {
    icon: 'lucide:fingerprint',
    title: 'Named on the record',
    body: 'Chain, contract, and issuer say which silver token this is. Correnthian registers that token. Someone else issued it.',
  },
  {
    icon: 'lucide:layers',
    title: 'Allocated, or labeled otherwise',
    body: 'The holding is shown as silver you can take out when specific metal is reserved for that token. A price tracker is labeled as price exposure.',
  },
  {
    icon: 'lucide:wallet',
    title: 'An account only you can move',
    body: 'Delivery lands in your account. The key stays on your device. Correnthian has no key that can move the holding.',
  },
  {
    icon: 'lucide:receipt',
    title: 'Three fee lines',
    body: 'Provider, network, and Correnthian are itemised on the quote. No percentage is published yet.',
  },
  {
    icon: 'lucide:package',
    title: 'A request to take it out',
    body: 'Redemption is a request the issuer fulfils. The jurisdiction comes from the account. Correnthian does not ship the bars.',
  },
]

const worlds = [
  {
    title: 'The token',
    image: silverBars,
    alt: 'Stacked fine silver bars',
    items: [
      ['Issued by someone else', 'Correnthian registers the token'],
      ['Named in three parts', 'Chain, contract, and issuer'],
      ['Metal when it is allocated', 'Specific silver reserved for that token'],
      ['A tracker stays a tracker', 'Price exposure is labeled as such'],
    ],
  },
  {
    title: 'Your account',
    image: silverCoins,
    alt: 'Silver coins beside small fine silver bars',
    items: [
      ['Only you can move it', 'The key stays on your device'],
      ['A swap is a quote', 'Your device signs before funds move'],
      ['Card and bank are closed', 'Until a provider is contracted'],
      ['Fees stay visible', 'Three named lines, no published rate'],
    ],
  },
] as const

const startSteps = [
  {
    image: silverBars,
    alt: 'Stacked fine silver bars',
    title: 'Name the silver',
    body: 'You choose the token on the quote. Choosing an amount does not move money.',
  },
  {
    image: silverCoins,
    alt: 'Silver coins beside small fine silver bars',
    title: 'Read the three lines',
    body: 'Provider, network, and Correnthian sit on the quote before you pay.',
  },
  {
    image: silverBars,
    alt: 'Stacked fine silver bars',
    title: 'It arrives in your account',
    body: 'The provider delivers the token to an account only you can move.',
  },
]

const faqs = [
  {
    question: 'How do I buy silver?',
    answer: 'A card or a bank transfer would go through a licensed provider. No provider is contracted, so the buy screen refuses a purchase and says so.',
  },
  {
    question: 'Is this Correnthian silver?',
    answer: 'Correnthian registers a token someone else issued. It does not mint silver and it does not run a vault.',
  },
  {
    question: 'How do I know what I am holding?',
    answer: 'The screen names the chain, the contract, and the issuer, and it says whether specific metal is allocated. A token that only tracks a silver price is labeled as price exposure.',
  },
  {
    question: 'Where do the fees show?',
    answer: 'As three named lines: provider, network, and Correnthian. No percentage is printed until that schedule is set.',
  },
]

const related = [
  {
    href: '/products/silver',
    title: 'Silver',
    body: 'The registry entry: who issued it, and whether specific metal is allocated.',
    image: silverBars,
    alt: 'Stacked fine silver bars',
    link: 'See the asset',
  },
  {
    href: '/products/swap',
    title: 'Swap',
    body: 'Move assets you already hold. The server prepares a quote. Your device signs.',
    image: silverCoins,
    alt: 'Silver coins beside small fine silver bars',
    link: 'See the swap',
  },
  {
    href: '/products/buy',
    title: 'Buy gold',
    body: 'The card or bank path for gold, on its own page.',
    image: goldBars,
    alt: 'Allocated gold bars',
    link: 'See buy gold',
  },
]

function PrimaryLink({ href, children, light = false }: { href: string; children: string; light?: boolean }) {
  return (
    <Link href={href} className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition-all hover:scale-95 ${light ? 'bg-white text-black' : 'bg-default-900 text-white'}`}>
      {children}
    </Link>
  )
}

function SecondaryLink({ href, children, light = false }: { href: string; children: string; light?: boolean }) {
  return (
    <Link href={href} className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition-all hover:scale-95 ${light ? 'border border-white/40 text-white hover:bg-white/10' : 'bg-zinc-100 text-default-900'}`}>
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
            <Image src={image} alt={alt} className="aspect-video w-full rounded-3xl object-cover" />
          </div>
        </div>
      </div>
    </section>
  )
}

export default function BuySilver() {
  return (
    <>
      <section className="relative isolate flex min-h-[78vh] items-center overflow-hidden text-center">
        <Image src={silverBars} alt="" fill priority className="object-cover object-center" />
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 container px-6 py-16 sm:py-20">
          <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12">
            <div className="col-span-4 md:col-span-6 md:col-start-2 lg:col-span-8 lg:col-start-3">
              <h1 className="text-4xl tracking-tight text-white md:text-6xl lg:text-7xl">Own silver you can name</h1>
            </div>
            <div className="col-span-4 md:col-span-6 md:col-start-2 lg:col-span-6 lg:col-start-4">
              <p className="mt-6 text-base leading-relaxed text-white/90 md:text-lg">A third-party silver token, bought with a card or a bank transfer once a provider is contracted. The token lands in an account only you can move.</p>
              <div className="mt-8 flex justify-center sm:mt-10">
                <PrimaryLink href="/waitlist" light>
                  Join the waitlist
                </PrimaryLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sticky top-20 z-30 border-y border-zinc-100 bg-white md:top-24">
        <div className="container px-6 py-4">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm">
            <span className="text-default-900 inline-flex items-center gap-2 font-medium">
              <Icon icon="lucide:receipt" className="size-5" />
              Fees on the quote
            </span>
            <span className="text-default-900 font-medium">Provider</span>
            <span className="text-default-900 font-medium">Network</span>
            <span className="text-default-900 font-medium">Correnthian</span>
            <span className="text-default-500">Live LBMA wholesale spot execution. Free storage.</span>
            <Link href="/pricing" className="text-default-900 font-medium underline-offset-4 hover:underline">
              How fees are shown
            </Link>
          </div>
        </div>
      </section>

      <Split
        id="which-silver"
        title="A token someone else issued"
        paragraphs={['The buy screen names the chain, the contract, and the issuer. That is how you tell this silver from any other listing.', 'Correnthian registers the token. It does not mint it, and it does not take the payment.']}
        primary={{ href: '/products/silver', label: 'What counts as silver' }}
        secondary={{ href: '/pricing', label: 'How fees are shown' }}
        image={silverCoins}
        alt="Silver coins beside small fine silver bars"
        imageFirst
      />

      <Split
        id="when-it-is-metal"
        title="Shown as metal only when it is"
        paragraphs={['A holding is described as silver you can take out when specific metal is allocated to that token.', 'A token that only tracks a silver price is labeled as price exposure. Correnthian does not insure bars and does not run a vault.']}
        primary={{ href: '/products/silver', label: 'Read the disclosure' }}
        secondary={{ href: '/products/redemption', label: 'Taking it out' }}
        image={silverBars}
        alt="Stacked fine silver bars"
      />

      <section className="overflow-hidden py-16 md:py-20">
        <div className="container px-6">
          <div className="mb-8 grid grid-cols-4 md:mb-10 md:grid-cols-8 lg:grid-cols-12">
            <div className="col-span-4 md:col-span-8 lg:col-span-8 lg:col-start-3">
              <h2 className="text-default-900 text-center text-4xl tracking-tight md:text-5xl lg:text-6xl">Use silver your way</h2>
            </div>
          </div>

          <div className="[&:has(.way-card:checked)_.tab-card]:bg-default-900 [&:has(.way-card:checked)_.tab-card]:text-white [&:has(.way-card:checked)_.panel-card]:grid [&:has(.way-bank:checked)_.tab-bank]:bg-default-900 [&:has(.way-bank:checked)_.tab-bank]:text-white [&:has(.way-bank:checked)_.panel-bank]:grid [&:has(.way-hold:checked)_.tab-hold]:bg-default-900 [&:has(.way-hold:checked)_.tab-hold]:text-white [&:has(.way-hold:checked)_.panel-hold]:grid">
            {ways.map((item, index) => (
              <input key={item.id} id={`silver-way-${item.id}`} name="silver-way" type="radio" defaultChecked={index === 0} className={`way-${item.id} sr-only`} />
            ))}

            <div className="flex w-full justify-center px-4 pb-8 md:px-8 md:pb-10 lg:px-9">
              <div className="-mx-10 min-h-14 overflow-x-auto px-7">
                <div className="text-default-500 relative flex min-w-max items-center justify-center gap-x-1 px-2">
                  {ways.map((item) => (
                    <label key={item.id} htmlFor={`silver-way-${item.id}`} className={`tab-${item.id} cursor-pointer rounded-full px-4 py-2 text-sm font-medium`}>
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="min-h-[420px]">
              {ways.map((item) => (
                <div key={item.id} className={`panel-${item.id} hidden`}>
                  <div className="grid gap-4 lg:grid-cols-12">
                    <div className="flex flex-col justify-center rounded-3xl bg-zinc-100 p-8 md:p-10 lg:col-span-5 lg:p-14">
                      <h3 className="text-default-900 mb-4 text-3xl tracking-tight md:text-4xl">{item.title}</h3>
                      <p className="text-default-600 text-sm leading-relaxed md:text-base">{item.body}</p>
                      <div className="flex justify-start pt-6">
                        <PrimaryLink href={item.href}>{item.link}</PrimaryLink>
                      </div>
                    </div>
                    <div className="relative aspect-5/3 overflow-hidden rounded-3xl md:aspect-auto md:min-h-[420px] lg:col-span-7">
                      <Image src={item.image} alt={item.alt} fill className="object-cover" sizes="(min-width: 1024px) 58vw, 100vw" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="what-is-silver" className="bg-white">
        <div className="container px-6 py-10 md:py-20">
          <div className="grid grid-cols-4 gap-y-8 md:grid-cols-8 lg:grid-cols-12">
            <div className="col-span-4 md:col-span-8 lg:col-span-5">
              <div className="lg:sticky lg:top-32 lg:px-6">
                <h2 className="text-default-900 mb-4 text-4xl tracking-tight md:mb-6 md:text-5xl">What is this silver?</h2>
                <p className="text-default-600 mb-8 text-base leading-relaxed md:mb-10 md:text-lg">A third-party token on the registry. The account that holds it is yours to move. Correnthian does not issue the token and does not hold the metal.</p>
                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                  <PrimaryLink href="/products/silver">Learn more</PrimaryLink>
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
                <Image src={world.image} alt={world.alt} fill className="object-cover object-right" sizes="(min-width: 1280px) 50vw, 100vw" />
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
        paragraphs={['What this page can show is the issuer, the contract, and whether specific metal is allocated. That sentence is the disclosure.', 'Correnthian does not publish an audit of a vault it does not run.']}
        primary={{ href: '/products/silver', label: 'Read the disclosure' }}
        secondary={{ href: '/products/activity', label: 'See activity' }}
        image={silverCoins}
        alt="Silver coins beside small fine silver bars"
      />

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
                <Image src={step.image} alt={step.alt} className="relative z-10 aspect-[6/5] w-full rounded-2xl object-cover" />
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

      <Split
        id="taking-it-out"
        title="Taking silver out"
        paragraphs={['A redemption is a request. The issuer delivers the metal, and the jurisdiction comes from your account.', 'Correnthian does not mint bars, rounds, or coins, and it does not run a bullion shop.']}
        primary={{ href: '/products/redemption', label: 'How redemption works' }}
        secondary={{ href: '/products/silver', label: 'The silver asset' }}
        image={silverBars}
        alt="Stacked fine silver bars"
      />

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
              <style>{'.silver-faq[open] .silver-faq-plus{transform:rotate(45deg)}.silver-faq[open]{box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.1),0 2px 4px -2px rgb(0 0 0 / 0.1)}'}</style>
              {faqs.map((faq, index) => (
                <details key={faq.question} open={index === 0 ? true : undefined} className="silver-faq rounded-2xl border border-zinc-100 bg-white shadow-sm">
                  <summary className="text-default-900 group-open:text-default-950 inline-flex w-full cursor-pointer list-none items-center justify-between p-3.5 text-start font-medium transition hover:text-zinc-500 lg:p-5 [&::-webkit-details-marker]:hidden">
                    <h3 className="pr-3 text-base font-medium md:text-xl">{faq.question}</h3>
                    <span className="silver-faq-plus bg-default-200 text-default-800 relative flex size-6.5 shrink-0 items-center justify-center rounded-full transition-transform duration-300 md:size-8.5">
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
                      <Image src={item.image} alt={item.alt} fill className="object-cover" sizes="(min-width: 1024px) 33vw, 100vw" />
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
