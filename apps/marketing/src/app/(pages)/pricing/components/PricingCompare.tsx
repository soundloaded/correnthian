import Link from 'next/link'

const paths = [
  {
    title: 'Card or bank deposit',
    body: 'Deposit USD, EUR, or GBP seamlessly via instant bank transfer or card with transparent provider clearing rates and instant execution.',
    href: '/products/buy',
    link: 'Buy gold',
  },
  {
    title: 'Instant multi-asset swap',
    body: 'Swap directly between Physical Gold, Silver, BTC, ETH, and USDC. The server prepares the quote and your private device signs with cryptographic finality.',
    href: '/products/swap',
    link: 'Swap',
  },
] as const

const PricingCompare = () => {
  return (
    <section className="pb-16 md:pb-24">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-default-900 text-3xl font-medium tracking-tight md:text-4xl">Radical fee transparency</h2>
          <p className="text-default-600 mt-4 text-base leading-relaxed md:text-lg">Every fee is itemized explicitly on your quote before your device signs. Zero hidden markups, zero monthly storage fees.</p>
        </div>
        <ul className="mt-10 grid gap-5 md:grid-cols-2">
          {paths.map((path) => (
            <li key={path.title} className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
              <h3 className="text-default-900 text-xl font-medium">{path.title}</h3>
              <p className="text-default-600 mt-3 text-base leading-relaxed">{path.body}</p>
              <Link href={path.href} className="text-default-900 mt-6 inline-flex text-sm font-medium underline-offset-4 hover:underline">
                {path.link}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default PricingCompare
