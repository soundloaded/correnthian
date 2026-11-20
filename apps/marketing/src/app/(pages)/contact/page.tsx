import { Metadata } from 'next'
import Link from 'next/link'
import ContactFaq from './components/ContactFaq'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'This public page is not a support desk that receives mail. The form is not connected, so a message typed here is not delivered and is not stored.',
}

const routes = [
  { href: '/faqs', label: 'FAQs' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/waitlist', label: 'Waitlist' },
] as const

const Page = () => {
  return (
    <section className="pt-32 pb-20 md:pb-28">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-default-900 mb-5 text-4xl font-medium tracking-tight md:text-5xl lg:text-6xl">This is the public site, not a support desk that receives mail</h1>
          <p className="text-default-600 mx-auto mb-8 max-w-2xl text-base leading-relaxed md:text-lg">The form on this page is not connected, so a message typed here is not delivered and is not stored.</p>
          <ul className="mb-14 flex flex-wrap items-center justify-center gap-3">
            {routes.map((route) => (
              <li key={route.href}>
                <Link href={route.href} className="border-default-200 text-default-900 inline-flex rounded-full border bg-white px-6 py-3 text-sm font-medium transition-all hover:scale-95">
                  {route.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <ContactFaq />
      </div>
    </section>
  )
}

export default Page
