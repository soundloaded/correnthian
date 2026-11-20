const lines = [
  {
    name: 'Provider',
    line: 'Their fee, on the quote',
    body: 'The provider who takes a payment, or who is named on a swap, charges this line. It is shown on its own.',
  },
  {
    name: 'Network',
    line: 'The chain fee, on the quote',
    body: 'The chain charges this to move the transaction. It is named separately from the other two lines.',
  },
  {
    name: 'Correnthian',
    line: 'Our fee, on the quote',
    body: 'Correnthian’s fee is its own line. It is not folded into a worse rate.',
  },
] as const

const PricingPlans = () => {
  return (
    <section className="pt-34 pb-16 md:pt-42 md:pb-20 lg:pt-50">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-default-600 mb-3 text-sm font-medium">On the quote</p>
          <h1 className="text-default-900 text-4xl font-medium tracking-tight md:text-5xl lg:text-6xl">Fees</h1>
          <p className="text-default-600 mt-5 text-base leading-relaxed md:text-xl">
            A quote names three lines: Provider, Network, and Correnthian. None of them has a published rate. Nothing is folded into a worse rate.
          </p>
        </div>
        <ul className="mt-12 grid gap-5 md:grid-cols-3">
          {lines.map((item) => (
            <li key={item.name} className="rounded-3xl border border-zinc-100 bg-white p-6 md:p-8">
              <h2 className="text-default-900 text-xl font-medium">{item.name}</h2>
              <p className="text-default-900 mt-3 text-base font-medium">{item.line}</p>
              <p className="text-default-600 mt-3 text-base leading-relaxed">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default PricingPlans
