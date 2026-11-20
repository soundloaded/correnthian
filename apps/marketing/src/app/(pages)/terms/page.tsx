import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms',
  description: 'What these public pages are and are not. Not counsel-approved terms, and no legal entity is named.',
}

const linkClass = 'text-default-900 underline underline-offset-4 hover:text-default-600'

const Page = () => {
  return (
    <section className="pt-32 pb-20">
      <div className="container">
        <article className="mx-auto max-w-3xl">
          <h1 className="text-default-900 text-4xl font-medium md:text-5xl">Terms</h1>

          <p className="text-default-600 mt-6 text-base leading-relaxed md:text-lg">
            These notes are not counsel-approved terms, and they do not name a legal entity.
          </p>

          <h2 className="text-default-900 mt-10 mb-3 text-xl font-medium md:text-2xl">What this site is</h2>
          <p className="text-default-600 text-base leading-relaxed md:text-lg">
            These are public pages about a self-custodial way to hold and buy tokenized metal someone else issued. The pages describe that idea. They are not the account where metal would sit.
          </p>

          <h2 className="text-default-900 mt-10 mb-3 text-xl font-medium md:text-2xl">What it is not</h2>
          <ul className="text-default-600 list-disc space-y-2 ps-6 text-base leading-relaxed md:text-lg">
            <li>Not an offer to sell metal.</li>
            <li>Not custody. This site does not hold metal, a private key, or a seed.</li>
            <li>Not a yield.</li>
            <li>Not a live card or bank purchase.</li>
            <li>Not a store app.</li>
          </ul>

          <h2 className="text-default-900 mt-10 mb-3 text-xl font-medium md:text-2xl">Fees</h2>
          <p className="text-default-600 text-base leading-relaxed md:text-lg">
            Fees on a future quote would be three named lines: the provider, the network, and Correnthian. No rate is published here. The{' '}
            <Link href="/pricing" className={linkClass}>
              fees
            </Link>{' '}
            page says the same thing.
          </p>

          <h2 className="text-default-900 mt-10 mb-3 text-xl font-medium md:text-2xl">Redemption</h2>
          <p className="text-default-600 text-base leading-relaxed md:text-lg">
            <Link href="/products/redemption" className={linkClass}>
              Redemption
            </Link>{' '}
            described on the site is a request the issuer fulfils, not a delivery promise. Correnthian does not ship metal.
          </p>

          <h2 className="text-default-900 mt-10 mb-3 text-xl font-medium md:text-2xl">Privacy</h2>
          <p className="text-default-600 text-base leading-relaxed md:text-lg">
            How this marketing site talks about information is on the{' '}
            <Link href="/privacy-policy" className={linkClass}>
              privacy
            </Link>{' '}
            page. That page is a description, not a lawyer-reviewed policy.
          </p>
        </article>
      </div>
    </section>
  )
}

export default Page
