import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Waitlist',
  description: 'The apps are not in the stores, and card buying is not open. This page cannot save an address yet.',
}

const routes = [
  { href: '/contact', label: 'Contact' },
  { href: '/products/app', label: 'Mobile app' },
] as const

const Page = () => {
  return (
    <section className="pt-32 pb-20 md:pb-28">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-default-900 mb-5 text-4xl font-medium tracking-tight md:text-5xl lg:text-6xl">Ask for access</h1>
          <p className="text-default-600 mx-auto mb-4 max-w-2xl text-base leading-relaxed md:text-lg">The apps are not in the stores, and card buying is not open.</p>
          <p className="text-default-600 mx-auto mb-8 max-w-2xl text-base leading-relaxed md:text-lg">The email form is not connected. This page cannot save an address yet, so nothing typed here joins a list.</p>
          <ul className="flex flex-wrap items-center justify-center gap-3">
            {routes.map((route) => (
              <li key={route.href}>
                <Link href={route.href} className="border-default-200 text-default-900 inline-flex rounded-full border bg-white px-6 py-3 text-sm font-medium transition-all hover:scale-95">
                  {route.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export default Page
