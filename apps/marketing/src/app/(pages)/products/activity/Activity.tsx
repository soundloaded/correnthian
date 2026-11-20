import Link from 'next/link'

const parts = [
  {
    label: 'Whose',
    meaning: 'The signed-in account',
    body: 'The history is read for the signed-in account. One holder does not see another’s transactions.',
  },
  {
    label: 'Amount',
    meaning: 'From the asset’s decimals',
    body: 'A token amount uses that asset’s decimals. If the registry has no decimals, the raw value is shown, not guessed.',
  },
  {
    label: 'Chain',
    meaning: 'A public explorer link, when sent',
    body: 'When a transaction has been sent, the row can link to the public explorer for that chain. Correnthian does not sign the transaction.',
  },
] as const

const specimen = [
  { label: 'Whose', value: 'This account' },
  { label: 'Amount', value: "From the asset's decimals" },
  { label: 'Chain', value: 'Explorer link after it is sent' },
] as const

const onThisScreen = ['Your own history', 'Amounts formatted from the registry', 'A link when a transaction was sent'] as const

const notOnThisScreen = ['Another holder’s activity', 'A guessed decimal place', 'A trade Correnthian signed for you'] as const

const faqs = [
  {
    question: 'Whose activity is this?',
    answer: 'The signed-in account’s own buys, swaps, and sends. It is not another holder’s history, and it is not a public feed of every customer.',
  },
  {
    question: 'How is the amount formatted?',
    answer: 'The amount uses that asset’s decimals from the registry. If those decimals are missing, the row shows the raw value. It does not guess a decimal place.',
  },
  {
    question: 'Is this a market feed?',
    answer: 'No. The list is this account’s buys, swaps, and sends. It is not a market feed. When a transaction was sent, the row can link to that chain’s public explorer. Correnthian does not sign the transaction.',
  },
] as const

const related = [
  {
    href: '/products/portfolio',
    title: 'Portfolio',
    body: 'What you hold, and who backs it. The account opens on the holdings, not on this history.',
    link: 'See the portfolio',
    itemClass: 'lg:col-span-4 lg:pt-28',
  },
  {
    href: '/products/swap',
    title: 'Swap',
    body: 'A move of assets you already hold. The server can prepare an unsigned quote. Your device signs it.',
    link: 'See the swap',
    itemClass: 'lg:col-span-4',
  },
  {
    href: '/products/buy',
    title: 'Buy',
    body: 'A separate screen from this history. A purchase stays closed until a provider is contracted.',
    link: 'See buy',
    itemClass: 'lg:col-span-4 lg:pt-28',
  },
] as const

export default function Activity() {
  return (
    <>
      <section className="pt-34 pb-16 md:pt-42 md:pb-20 lg:pt-50">
        <div className="container px-6">
          <p className="text-default-600 mb-3 text-sm font-medium">Products</p>
          <h1 className="text-default-900 max-w-3xl text-4xl font-medium tracking-tight md:text-5xl lg:text-6xl">Your account&apos;s history</h1>
          <p className="text-default-600 mt-5 max-w-2xl text-base leading-relaxed md:mt-6 md:text-lg">
            Activity is the signed-in account&apos;s own buys, swaps, and sends. It is not a market feed, and it is not another holder&apos;s history. Amounts use the asset&apos;s decimals from the registry. If those decimals are missing, the raw value is shown, not guessed. When a transaction was sent, the row can link to that chain&apos;s public explorer. Correnthian does not sign the transaction.
          </p>
          <div className="mt-8">
            <Link href="/products/portfolio" className="inline-flex items-center justify-center rounded-full bg-default-900 px-6 py-3 text-sm font-medium text-white transition-all hover:scale-95">
              See the portfolio
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-20">
        <div className="container px-6">
          <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <h2 className="text-default-900 text-4xl tracking-tight md:text-5xl">What a row is</h2>
              <p className="text-default-600 mt-4 text-base leading-relaxed md:mt-6 md:text-lg">Each row is one movement of this account. The screen does not fill the list with sample trades, dates, or amounts.</p>
            </div>
            <div className="lg:col-span-7">
              <ol className="space-y-4">
                {parts.map((part) => (
                  <li key={part.label} className="rounded-3xl border border-zinc-100 p-6 md:p-8">
                    <p className="text-default-500 text-sm font-medium">{part.label}</p>
                    <h3 className="text-default-900 mt-2 text-xl">{part.meaning}</h3>
                    <p className="text-default-600 mt-3 text-sm leading-relaxed md:text-base">{part.body}</p>
                  </li>
                ))}
              </ol>
              <article aria-label="Specimen row" className="mt-6 rounded-3xl bg-zinc-100 p-6 md:p-8">
                <p className="text-default-900 text-sm font-medium">Specimen</p>
                <p className="text-default-500 mt-1 text-sm">Placeholders only. Not a recorded transaction.</p>
                <dl className="mt-6 space-y-4">
                  {specimen.map((row) => (
                    <div key={row.label} className="border-b border-zinc-200 pb-4 last:border-0 last:pb-0">
                      <dt className="text-default-500 text-sm font-medium">{row.label}</dt>
                      <dd className="text-default-900 mt-1 text-base">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="container px-6">
          <h2 className="text-default-900 text-4xl tracking-tight md:text-5xl">What the list includes</h2>
          <div className="mt-8 grid gap-6 md:mt-10 md:grid-cols-2">
            <article className="rounded-3xl border border-zinc-100 bg-white p-6 md:p-8">
              <h3 className="text-default-900 text-xl">On this screen</h3>
              <ul className="mt-5 space-y-3">
                {onThisScreen.map((item) => (
                  <li key={item} className="text-default-600 flex gap-3 text-sm leading-relaxed md:text-base">
                    <span aria-hidden className="bg-default-900 mt-2 size-1.5 shrink-0 rounded-full" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-3xl border border-zinc-100 bg-white p-6 md:p-8">
              <h3 className="text-default-900 text-xl">Not on this screen</h3>
              <ul className="mt-5 space-y-3">
                {notOnThisScreen.map((item) => (
                  <li key={item} className="text-default-600 flex gap-3 text-sm leading-relaxed md:text-base">
                    <span aria-hidden className="bg-default-900 mt-2 size-1.5 shrink-0 rounded-full" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="py-6 md:pb-10 lg:py-25">
        <div className="container px-6">
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
              <style>{'.activity-faq[open] .activity-faq-plus{transform:rotate(45deg)}'}</style>
              {faqs.map((faq, index) => (
                <details key={faq.question} open={index === 0 ? true : undefined} className="activity-faq rounded-2xl border border-zinc-100 bg-white shadow-sm">
                  <summary className="text-default-900 inline-flex w-full cursor-pointer list-none items-center justify-between p-3.5 text-start font-medium transition hover:text-zinc-500 lg:p-5 [&::-webkit-details-marker]:hidden">
                    <h3 className="pr-3 text-base font-medium md:text-xl">{faq.question}</h3>
                    <span className="activity-faq-plus bg-default-200 text-default-800 relative flex size-6.5 shrink-0 items-center justify-center rounded-full transition-transform duration-300 md:size-8.5">
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
            {related.map((item) => (
              <li key={item.href} className={item.itemClass}>
                <article className="h-full rounded-3xl bg-zinc-100 p-6 xl:px-10 xl:py-8">
                  <h3 className="text-default-900 mb-2 text-xl">{item.title}</h3>
                  <p className="text-default-600 text-base leading-relaxed">{item.body}</p>
                  <Link href={item.href} className="mt-8 inline-flex items-center justify-center rounded-full bg-default-900 px-6 py-3 text-sm font-medium text-white transition-all hover:scale-95">
                    {item.link}
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
