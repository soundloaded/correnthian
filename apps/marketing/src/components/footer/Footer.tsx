import logo from '@/assets/images/logo.svg'
import Image from 'next/image'
import Link from 'next/link'

const linkClass = 'text-base text-default-600 hover:text-default-900 hover:underline underline-offset-4 decoration-2 transition-colors md:text-lg'

const productLinks = [
  { label: 'Buy gold', href: '/products/buy' },
  { label: 'Buy silver', href: '/products/buy-silver' },
  { label: 'Swap', href: '/products/swap' },
  { label: 'Portfolio', href: '/products/portfolio' },
  { label: 'Activity', href: '/products/activity' },
  { label: 'Mobile app', href: '/products/app' },
  { label: 'Gold', href: '/products/gold' },
  { label: 'Silver', href: '/products/silver' },
  { label: 'Redemption', href: '/products/redemption' },
] as const

const companyLinks = [
  { label: 'Home', href: '/home' },
  { label: 'About', href: '/about' },
  { label: 'Fees', href: '/pricing' },
  { label: 'Contact', href: '/contact' },
  { label: 'Waitlist', href: '/waitlist' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Download', href: '/download' },
] as const

const legalLinks = [
  { label: 'Privacy', href: '/privacy-policy' },
  { label: 'Terms', href: '/terms' },
] as const

const columns = [
  { title: 'Products', links: productLinks },
  { title: 'Company', links: companyLinks },
  { title: 'Legal', links: legalLinks },
] as const

const Footer = () => {
  return (
    <footer className="bg-body-bg overflow-hidden pt-20 pb-0">
      <div className="container">
        <div className="grid grid-cols-1 justify-between gap-7.5 md:gap-12.5 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <Link href="/home" className="mb-10 inline-block">
              <Image src={logo} alt="Correnthian Logo" height={44} className="h-11" />
            </Link>

            <p className="text-default-600 max-w-md text-base leading-relaxed md:text-lg">
              There is no mailing list, and this site does not send vault updates or spot promotions.{' '}
              <Link href="/waitlist" className={linkClass}>
                Ask for access
              </Link>
              .
            </p>
          </div>

          <div className="grid grid-cols-1 gap-7.5 sm:grid-cols-3 lg:col-span-8">
            {columns.map((column) => (
              <div key={column.title}>
                <h2 className="text-default-900 mb-5 text-base font-medium lg:mb-7.5">{column.title}</h2>
                <div className="flex flex-col gap-2">
                  {column.links.map((item) => (
                    <Link key={item.href} href={item.href} className={linkClass}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-default-200 mt-6 border-t pt-5 md:mt-8 md:pt-7.5 lg:mt-16">
          <p className="text-default-600 text-base md:text-lg">&copy; {new Date().getFullYear()} Correnthian. All rights reserved.</p>
        </div>
      </div>

      <div aria-hidden="true" className="pointer-events-none container mt-10 w-full select-none [container-type:inline-size] md:mt-14 lg:mt-20">
        <p className="font-heading from-default-900/15 via-default-900/8 w-full bg-linear-to-b to-transparent bg-clip-text text-center text-[11.2cqi] leading-[0.82] font-bold tracking-[-0.03em] whitespace-nowrap text-transparent uppercase">
          CORRENTHIAN
        </p>
      </div>
    </footer>
  )
}

export default Footer
