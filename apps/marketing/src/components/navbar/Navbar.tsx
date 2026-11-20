'use client'

import appStoreIcon from '@/assets/images/icons/app-store.svg'
import playStoreIcon from '@/assets/images/icons/play-store.svg'
import logo from '@/assets/images/logo.svg'
import { productGroups } from '@/app/(pages)/products/content'
import { Icon } from '@iconify/react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

type NavLink = {
  label: string
  href: string
  detail: string
}

type NavGroup = {
  label: string
  items: readonly NavLink[]
}

type NavEntry = {
  label: string
  href?: string
  items?: readonly NavLink[]
  groups?: readonly NavGroup[]
}

const products: NavGroup[] = productGroups.map((group) => {
  const items = group.items.map((item) => ({
    label: item.label,
    href: `/products/${item.slug}`,
    detail: item.detail,
  }))
  if (group.label !== 'Buy, hold & move') return { label: group.label, items }
  const buyGold = items.findIndex((item) => item.label === 'Buy gold')
  const withSilver = [...items]
  withSilver.splice(buyGold + 1, 0, {
    label: 'Buy silver',
    href: '/products/buy-silver',
    detail: 'Card or bank, when a provider is contracted',
  })
  return { label: group.label, items: withSilver }
})

/**
 * Home, then the holder’s features, then the company.
 * A card, a yield, minting, and an exchange are not in this menu.
 */
const nav: readonly NavEntry[] = [
  { label: 'Home', href: '/home' },
  { label: 'Products', groups: products },
  { label: 'Fees', href: '/pricing' },
  {
    label: 'Company',
    items: [
      { label: 'About', href: '/about', detail: 'What Correnthian holds, and what it does not' },
      { label: 'Contact', href: '/contact', detail: 'Support and partnership' },
      { label: 'Waitlist', href: '/waitlist', detail: 'Ask for access before the app is live' },
    ],
  },
  {
    label: 'Help',
    items: [
      { label: 'FAQs', href: '/faqs', detail: 'Backing, fees, and taking metal out' },
      { label: 'Privacy', href: '/privacy-policy', detail: 'How this site handles information' },
    ],
  },
]

const linkClass = (active: boolean) =>
  `flex items-center justify-center rounded-2xl px-4 py-4 text-sm font-medium transition-all lg:px-5 ${active ? 'bg-default-200 text-default-800' : 'text-default-700 hover:bg-default-200 hover:text-default-800'}`

const menuItemClass = (active: boolean) =>
  `flex flex-col rounded-lg px-3 py-2 transition-all ${active ? 'bg-default-200 text-default-800' : 'text-default-700 hover:bg-default-200 hover:text-default-800'}`

function MenuLinks({ items, path }: { items: readonly NavLink[]; path: string }) {
  return (
    <>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={menuItemClass(path === item.href)} role="menuitem">
          <span className="text-sm font-medium">{item.label}</span>
          <span className="text-default-500 text-xs">{item.detail}</span>
        </Link>
      ))}
    </>
  )
}

const Navbar = () => {
  const pathname = usePathname()
  const path = pathname === '/' ? '/home' : pathname

  useEffect(() => {
    window.scrollTo(0, 0)
    const toggle = document.getElementById('mobile-nav') as HTMLInputElement | null
    if (toggle) toggle.checked = false
  }, [pathname])

  useEffect(() => {
    const handleScroll = () => {
      const stickyNav = document.querySelector('.nav-sticky')
      if (stickyNav) {
        const scTop = window.pageYOffset || document.documentElement.scrollTop
        if (scTop >= 100) {
          stickyNav.classList.add('nav-sticky-on')
        } else {
          stickyNav.classList.remove('nav-sticky-on')
        }
      }
    }
    window.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const isCurrent = (href: string) => path === href
  const entryLinks = (entry: NavEntry) => entry.groups?.flatMap((group) => group.items) ?? entry.items ?? []
  const groupActive = (entry: NavEntry) => entryLinks(entry).some((item) => isCurrent(item.href))

  return (
    <header>
      <input id="mobile-nav" type="checkbox" className="peer sr-only" />
      <div className="nav-sticky navbar fixed inset-x-0 top-0 z-120 w-full">
        <div className="container py-3.5 md:py-5 lg:py-7.5">
          <div className="flex w-full items-center justify-between rounded-lg bg-white md:rounded-2xl lg:justify-center lg:bg-transparent">
            <div className="flex min-w-[175px] rounded-[20px] bg-white px-3 py-1.5 md:py-4 lg:p-4 lg:shadow-lg">
              <Link href="/home">
                <Image src={logo} alt="Correnthian" className="h-7.5 md:h-8" />
              </Link>
            </div>

            <div className="hidden h-2.5 w-full transition-all duration-500 ease-in-out in-[.nav-sticky-on]:w-2.5 lg:flex"></div>

            <div className="flex items-center justify-between">
              <div className="hidden rounded-[20px] bg-white p-1.5 whitespace-nowrap lg:block lg:shadow-lg">
                <ul id="navbar" className="flex items-center">
                  {nav.map((entry) =>
                    entry.href ? (
                      <li key={entry.label}>
                        <Link href={entry.href} className={linkClass(isCurrent(entry.href))}>
                          {entry.label}
                        </Link>
                      </li>
                    ) : (
                      <li key={entry.label} className="group relative inline-flex">
                        <button
                          id={`nav-${entry.label.toLowerCase()}`}
                          type="button"
                          className={`flex items-center justify-center gap-1 rounded-2xl px-4 py-4 text-sm font-medium transition-all focus:outline-hidden group-hover:bg-default-200 group-hover:text-default-800 group-focus-within:bg-default-200 group-focus-within:text-default-800 lg:px-5 ${groupActive(entry) ? 'bg-default-200 text-default-800' : 'text-default-700'}`}
                          aria-haspopup="menu"
                          aria-expanded="false"
                          aria-label={entry.label}
                        >
                          {entry.label}
                          <Icon icon="lucide:chevron-down" className="size-4" />
                        </button>

                        <div
                          className={`invisible absolute top-full z-30 mt-2 rounded-xl bg-white whitespace-normal opacity-0 shadow-lg group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 before:absolute before:inset-s-0 before:-top-4 before:h-4 before:w-full ${entry.groups ? 'left-1/2 w-[min(42rem,calc(100vw-3rem))] -translate-x-1/2' : 'left-0 min-w-72'}`}
                          role="menu"
                          aria-orientation="vertical"
                          aria-labelledby={`nav-${entry.label.toLowerCase()}`}
                        >
                          {entry.groups ? (
                            <div className="grid gap-4 p-4 sm:grid-cols-2">
                              <div>
                                <p className="text-default-500 px-3 pb-2 text-xs font-medium tracking-wide uppercase">{entry.groups[0].label}</p>
                                <div className="space-y-0.5">
                                  <MenuLinks items={entry.groups[0].items} path={path} />
                                </div>
                              </div>
                              <div className="space-y-4">
                                {entry.groups.slice(1).map((group) => (
                                  <div key={group.label}>
                                    <p className="text-default-500 px-3 pb-2 text-xs font-medium tracking-wide uppercase">{group.label}</p>
                                    <div className="space-y-0.5">
                                      <MenuLinks items={group.items} path={path} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-0.5 p-2.5">
                              <MenuLinks items={entry.items ?? []} path={path} />
                            </div>
                          )}
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>

            <div className="hidden h-2.5 w-full transition-all duration-500 ease-in-out in-[.nav-sticky-on]:w-2.5 lg:flex"></div>

            <div className="flex items-center gap-1.25 rounded-[20px] bg-white p-1.5 shadow-lg lg:shadow-lg">
              <a href="https://www.apple.com/in/app-store/" target="_blank" aria-label="App Store" className="bg-default-200 group relative flex size-8.75 items-center justify-center overflow-hidden rounded-lg transition-all duration-300 md:h-12.5 md:w-12.5 md:rounded-2xl">
                <div className="relative flex items-center justify-center overflow-hidden">
                  <Image src={appStoreIcon} alt="Icon" className="size-4.5 transition-transform duration-300 group-hover:-translate-y-6 md:size-6" />
                  <Image src={appStoreIcon} alt="Icon" className="absolute size-4.5 translate-y-6 transition-transform duration-300 group-hover:translate-y-0 md:size-6" />
                </div>
              </a>

              <a
                href="https://play.google.com/store/games?device=windows"
                target="_blank"
                aria-label="App Store"
                className="bg-default-200 group relative flex size-8.75 items-center justify-center overflow-hidden rounded-lg transition-all duration-300 md:h-12.5 md:w-12.5 md:rounded-2xl"
              >
                <div className="relative flex items-center justify-center overflow-hidden">
                  <Image src={playStoreIcon} alt="Icon" className="size-4.5 transition-transform duration-300 group-hover:-translate-y-6 md:size-6" />
                  <Image src={playStoreIcon} alt="Icon" className="absolute size-4.5 translate-y-6 transition-transform duration-300 group-hover:translate-y-0 md:size-6" />
                </div>
              </a>

              <div className="flex items-center lg:hidden">
                <label htmlFor="mobile-nav" aria-controls="mobile-menu" className="bg-default-200 flex size-8.75 cursor-pointer items-center justify-center overflow-hidden rounded-lg transition-all duration-300 md:h-12.5 md:w-12.5 md:rounded-2xl">
                  <Icon icon="tabler:align-right" className="size-6" />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        id="mobile-menu"
        className="peer-checked:translate-y-0 peer-checked:opacity-100 pointer-events-none fixed inset-x-0 top-24 z-110 mx-4 max-h-[70vh] -translate-y-full transform overflow-hidden rounded-lg bg-white opacity-0 shadow-xl transition-all duration-300 peer-checked:pointer-events-auto md:top-32 md:mx-5 lg:hidden"
        role="dialog"
        tabIndex={-1}
        aria-labelledby="mobile-menu-label"
      >
        <div className="flex max-h-[70vh] flex-col overflow-y-auto p-3">
          {nav.map((entry) =>
            entry.href ? (
              <Link key={entry.label} href={entry.href} className={`rounded-lg px-2 py-2 text-base font-medium transition-all ${isCurrent(entry.href) ? 'text-default-900 bg-default-200' : 'text-default-600 hover:text-primary'}`}>
                {entry.label}
              </Link>
            ) : (
              <details key={entry.label} className="group/section">
                <summary className="text-default-600 hover:text-primary flex cursor-pointer list-none items-center px-2 py-2 text-base font-medium transition-all [&::-webkit-details-marker]:hidden">
                  {entry.label}
                  <Icon icon="tabler:chevron-down" className="ms-auto size-4 transition-transform group-open/section:rotate-180" />
                </summary>
                <div className="ps-3 pb-2">
                  {entry.groups
                    ? entry.groups.map((group) => (
                        <div key={group.label} className="pt-2">
                          <p className="text-default-500 px-2.5 pb-1 text-xs font-medium tracking-wide uppercase">{group.label}</p>
                          {group.items.map((item) => (
                            <Link key={item.href} href={item.href} className={`flex flex-col rounded-lg px-2.5 py-1.5 ${isCurrent(item.href) ? 'bg-default-200 text-default-800' : 'text-default-600 hover:bg-default-200 hover:text-default-800'}`}>
                              <span className="text-base">{item.label}</span>
                              <span className="text-default-500 text-xs">{item.detail}</span>
                            </Link>
                          ))}
                        </div>
                      ))
                    : entry.items?.map((item) => (
                        <Link key={item.href} href={item.href} className={`flex flex-col rounded-lg px-2.5 py-1.5 ${isCurrent(item.href) ? 'bg-default-200 text-default-800' : 'text-default-600 hover:bg-default-200 hover:text-default-800'}`}>
                          <span className="text-base">{item.label}</span>
                          <span className="text-default-500 text-xs">{item.detail}</span>
                        </Link>
                      ))}
                </div>
              </details>
            ),
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar
