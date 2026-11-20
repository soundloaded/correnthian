import Link from 'next/link'

const paths = [
  {
    title: 'Card or bank',
    body: 'A card or bank purchase is refused until a provider is contracted, so there is no quote to show a number on today.',
    href: '/products/buy',
    link: 'Buy gold',
  },
  {
    title: 'Swap',
    body: 'A swap quote names the same three lines before the device signs. The server prepares the quote. Your device signs it. Until a liquidity provider is contracted, that quote is not a fill.',
    href: '/products/swap',
    link: 'Swap',
  },
] as const

const PricingCompare = () => {
  return (
    <section className="pb-16 md:pb-24">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-default-900 text-3xl font-medium tracking-tight md:text-4xl">No number on this page</h2>
          <p className="text-default-600 mt-4 text-base leading-relaxed md:text-lg">The three lines are the rule. This page does not print a percentage, and it does not compare other companies.</p>
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
