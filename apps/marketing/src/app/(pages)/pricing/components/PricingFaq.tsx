import Link from 'next/link'

const faqs = [
  {
    question: 'Why is there no percentage?',
    answer:
      'No rate is published. The rule is three named lines on the quote: Provider, Network, and Correnthian. A fee is not folded into a worse rate. A card or bank purchase is refused until a provider is contracted, so there is no quote to show a number on today.',
  },
  {
    question: 'Who charges the provider line?',
    answer:
      'The provider does. On a card or bank purchase, that is the provider who would take the payment. On a swap, it is the provider named on the quote. Correnthian shows the line. It does not set the provider’s fee.',
  },
  {
    question: 'Does Correnthian take the card payment?',
    answer: 'No. A licensed provider takes the card or the bank transfer. Correnthian does not hold the dollars, the bank account, or the card. Today that purchase is refused, because no provider is contracted.',
  },
] as const

const PricingFaq = () => {
  return (
    <section className="py-6 md:pb-10 lg:py-25">
      <div className="container">
        <div className="grid grid-cols-1 items-start gap-7.5 md:grid-cols-3 lg:grid-cols-12 lg:gap-25">
          <div className="col-span-1 space-y-10 lg:col-span-5 lg:space-y-20">
            <div className="space-y-4">
              <span className="border-default-200 text-default-800 mb-2.5 inline-block rounded-full border bg-white px-5 py-1.5 text-sm font-medium">Common Questions</span>
              <h2 className="text-default-900 text-2xl leading-normal font-medium tracking-normal md:text-4xl lg:text-5xl">Frequently asked questions</h2>
            </div>
            <div className="space-y-6 rounded-3xl bg-white p-5 shadow-xl shadow-zinc-200/50 md:p-7.5">
              <div className="bg-primary-1 flex size-12.5 items-center justify-center rounded-full text-white shadow-lg">
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 11a9 9 0 0 1 18 0" />
                  <path d="M21 16v-2a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2z" />
                  <path d="M3 16v-2a2 2 0 0 1 2-2h1v6H5a2 2 0 0 1-2-2z" />
                  <path d="M21 16v1a4 4 0 0 1-4 4h-5" />
                </svg>
              </div>
              <div className="space-y-6">
                <h3 className="text-default-900 mb-3.5 text-xl font-medium md:text-2xl">Can&apos;t find your answer?</h3>
                <Link href="/contact" className="group bg-default-900 relative inline-flex items-center justify-center overflow-hidden rounded-full px-8.5 text-nowrap text-white shadow-xl transition-all duration-300 hover:scale-95">
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
            <style>{'.pricing-faq[open] .pricing-faq-plus{transform:rotate(45deg)}'}</style>
            {faqs.map((faq, index) => (
              <details key={faq.question} open={index === 0 ? true : undefined} className="pricing-faq rounded-3xl border border-zinc-100 bg-white shadow-sm">
                <summary className="text-default-900 inline-flex w-full cursor-pointer list-none items-center justify-between p-3.5 text-start font-medium transition hover:text-zinc-500 lg:p-5 [&::-webkit-details-marker]:hidden">
                  <h3 className="pr-3 text-base font-medium md:text-xl">{faq.question}</h3>
                  <span className="pricing-faq-plus bg-default-200 text-default-800 relative flex size-6.5 shrink-0 items-center justify-center rounded-full transition-transform duration-300 md:size-8.5">
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
  )
}

export default PricingFaq
