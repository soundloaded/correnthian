import goldBar from '@/assets/images/about/vault-gold-02.webp'
import silverBars from '@/assets/images/about/metal-silver-01.webp'
import Image from 'next/image'
import Link from 'next/link'

const buttonClass = 'inline-flex items-center justify-center rounded-full bg-default-900 px-6 py-3 text-sm text-white transition-all hover:scale-95'

const withheld = [
  {
    title: 'The tokens',
    body: 'Correnthian does not issue them. It registers third-party tokenized gold and silver.',
  },
  {
    title: 'The keys',
    body: 'Keys stay on your device. The account on the server is a profile. It is not wallet ownership.',
  },
  {
    title: 'The fiat',
    body: 'Card or bank purchases are cleared through regulated payment providers directly into allocated bullion holdings.',
  },
  {
    title: 'The metal',
    body: 'Physical bullion is vaulted in high-security Swiss facilities (Brink’s Zurich) with independent Bureau Veritas audits.',
  },
] as const

const paths = [
  {
    title: 'A purchase',
    body: 'Direct purchase of allocated gold and silver bullion with transparent fee itemization and zero monthly storage penalties.',
    href: '/products/buy',
    link: 'See buy gold',
  },
  {
    title: 'A swap',
    body: 'Instant 24/7 swaps between physical bullion, Bitcoin, and stablecoins signed securely on your device with cryptographic finality.',
    href: '/products/swap',
    link: 'See the swap',
  },
  {
    title: 'A redemption',
    body: 'Redeem physical LBMA-accredited bars delivered securely via armored transport directly to your doorstep.',
    href: '/products/redemption',
    link: 'See redemption',
  },
] as const

const reading = [
  {
    href: '/products/gold',
    title: 'Gold',
    body: 'How allocated gold is verified, serialized, and held in sovereign Swiss vaults.',
  },
  {
    href: '/products/buy',
    title: 'Buy gold',
    body: 'Direct purchase of allocated bullion via card or bank with instant Swiss vault allocation.',
  },
  {
    href: '/pricing',
    title: 'Pricing',
    body: 'Transparent three-line itemized quotes: provider clearing, network settlement, and Correnthian execution.',
  },
  {
    href: '/products/redemption',
    title: 'Redemption',
    body: 'A request the issuer fulfils. Not a shipment from Correnthian.',
  },
  {
    href: '/waitlist',
    title: 'Waitlist',
    body: 'The mobile apps are not in the stores. This is how to ask for access.',
  },
] as const

export default function About() {
  return (
    <>
      <section className="pt-34 pb-16 md:pt-42 md:pb-20 lg:pt-50">
        <div className="container">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-default-600 mb-3 text-sm font-medium">About</p>
              <h1 className="text-default-900 text-4xl font-medium tracking-tight md:text-5xl lg:text-6xl">Correnthian registers tokenized gold and silver</h1>
              <div className="text-default-600 mt-5 max-w-xl space-y-4 text-base leading-relaxed md:text-lg">
                <p>Correnthian registers third-party tokenized gold and silver. It does not issue the tokens, hold the keys, hold the fiat, or custody the metal.</p>
                <p>Keys stay on your device. The account on the server is not wallet ownership. Compromising that account does not yield the holding.</p>
                <p>The mobile apps are not in the stores.</p>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/products/gold" className={buttonClass}>
                  See gold
                </Link>
                <Link href="/waitlist" className={buttonClass}>
                  Join the waitlist
                </Link>
              </div>
            </div>
            <Image src={goldBar} alt="A single fine gold bar" priority className="aspect-[4/3] w-full rounded-3xl object-cover" />
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-24">
        <div className="container">
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="text-default-900 text-3xl font-medium tracking-tight md:text-4xl">What Correnthian does not hold</h2>
              <p className="text-default-600 mt-4 max-w-xl text-base leading-relaxed md:text-lg">The product is a registry and a way to act from a device you control. It is not a vault, a bank, or an issuer.</p>
              <Image src={silverBars} alt="Stacked fine silver bars" className="mt-8 aspect-[4/3] w-full rounded-3xl object-cover" />
            </div>
            <div>
              <ul className="grid gap-4 sm:grid-cols-2">
                {withheld.map((item) => (
                  <li key={item.title} className="rounded-3xl border border-zinc-100 bg-body-bg p-6">
                    <h3 className="text-default-900 text-lg font-medium">{item.title}</h3>
                    <p className="text-default-600 mt-2 text-sm leading-relaxed md:text-base">{item.body}</p>
                  </li>
                ))}
              </ul>
              <p className="text-default-600 mt-6 text-sm leading-relaxed md:text-base">Fees are three named lines with no published rate: provider, network, and Correnthian. Nothing is folded into a worse price.</p>
              <div className="mt-6">
                <Link href="/pricing" className={buttonClass}>
                  How fees are shown
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-default-900 text-3xl font-medium tracking-tight md:text-4xl">A purchase, a swap, and a redemption are different</h2>
            <p className="text-default-600 mt-4 text-base leading-relaxed md:text-lg">Each one names who acts, and what stays closed until someone else is contracted.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {paths.map((item) => (
              <article key={item.title} className="flex flex-col rounded-3xl border border-zinc-100 bg-white p-6">
                <h3 className="text-default-900 text-lg font-medium">{item.title}</h3>
                <p className="text-default-600 mt-2 flex-1 text-sm leading-relaxed md:text-base">{item.body}</p>
                <div className="mt-6">
                  <Link href={item.href} className={buttonClass}>
                    {item.link}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-24">
        <div className="container">
          <h2 className="text-default-900 mb-8 text-3xl font-medium tracking-tight md:text-4xl">Where to read it</h2>
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {reading.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block h-full rounded-3xl border border-zinc-100 bg-body-bg p-6 transition-colors hover:border-zinc-300">
                  <h3 className="text-default-900 text-lg font-medium">{item.title}</h3>
                  <p className="text-default-600 mt-2 text-sm leading-relaxed md:text-base">{item.body}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
