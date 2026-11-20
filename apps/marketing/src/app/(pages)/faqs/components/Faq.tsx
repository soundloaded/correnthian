import Link from 'next/link'
import type { ReactNode } from 'react'

type FaqItem = {
  question: string
  answer: ReactNode
}

const faqs: FaqItem[] = [
  {
    question: 'How do I buy gold or silver?',
    answer: (
      <>
        A card or bank <Link href="/products/buy" className="text-default-900 font-medium underline underline-offset-2">buy</Link> would go through a licensed provider. None is contracted, so the buy screen refuses.
      </>
    ),
  },
  {
    question: 'Is the metal minted by Correnthian?',
    answer: <>No. Tokens are issued by someone else. Correnthian registers them.</>,
  },
  {
    question: 'How do I know what I hold?',
    answer: <>The record names the chain, the contract, the issuer, and whether specific metal is allocated. A price tracker is labeled price exposure.</>,
  },
  {
    question: 'Where are fees shown?',
    answer: (
      <>
        <Link href="/pricing" className="text-default-900 font-medium underline underline-offset-2">Fees</Link> are three lines: provider, network, and Correnthian. No percentage is published.
      </>
    ),
  },
  {
    question: 'What is a swap?',
    answer: (
      <>
        A <Link href="/products/swap" className="text-default-900 font-medium underline underline-offset-2">swap</Link> is an unsigned quote for assets you already hold. Your device signs. A live fill waits on a liquidity provider. A quote does not move funds.
      </>
    ),
  },
  {
    question: 'Can I take metal out?',
    answer: (
      <>
        <Link href="/products/redemption" className="text-default-900 font-medium underline underline-offset-2">Redemption</Link> records a request. The issuer delivers. Correnthian does not ship bars. This is not an offer. Issuer minimums apply.
      </>
    ),
  },
  {
    question: 'Is the mobile app in the stores?',
    answer: (
      <>
        No. Join the <Link href="/waitlist" className="text-default-900 font-medium underline underline-offset-2">waitlist</Link>.
      </>
    ),
  },
  {
    question: 'Does holding metal pay a yield?',
    answer: <>No.</>,
  },
]

const Faq = () => {
  return (
    <section className="pt-32 pb-16 md:pt-40 md:pb-25 lg:pt-50">
      <div className="container">
        <div className="grid grid-cols-1 items-start gap-7.5 md:grid-cols-3 lg:grid-cols-12 lg:gap-25">
          <div className="col-span-1 space-y-10 lg:col-span-5 lg:space-y-20">
            <div className="space-y-4">
              <span className="border-default-200 text-default-800 mb-2.5 inline-block rounded-full border bg-white px-5 py-1.5 text-sm font-medium">Common Questions</span>
              <h1 className="text-default-950 text-2xl leading-normal font-medium tracking-normal md:text-4xl lg:text-5xl">Frequently asked questions</h1>
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
                <h2 className="text-default-950 mb-3.5 text-xl font-medium md:text-2xl">Can&apos;t find your answer?</h2>
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
            <style>{'.faqs-faq[open] .faqs-faq-plus{transform:rotate(45deg)}'}</style>
            {faqs.map((faq, index) => (
              <details key={faq.question} open={index === 0 ? true : undefined} className="faqs-faq rounded-2xl border border-zinc-100 bg-white shadow-sm">
                <summary className="text-default-900 inline-flex w-full cursor-pointer list-none items-center justify-between p-3.5 text-start font-medium transition hover:text-zinc-500 lg:p-5 [&::-webkit-details-marker]:hidden">
                  <span className="pr-3 text-base font-medium md:text-xl">{faq.question}</span>
                  <span className="faqs-faq-plus bg-default-200 text-default-800 relative flex size-6.5 shrink-0 items-center justify-center rounded-full transition-transform duration-300 md:size-8.5">
                    <svg viewBox="0 0 24 24" className="size-3 md:size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </summary>
                <p className="px-3.5 pb-3.5 text-base leading-normal text-zinc-500 md:text-lg md:leading-relaxed lg:px-5 lg:pb-5">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Faq
