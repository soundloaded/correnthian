import goldBar from '@/assets/images/about/vault-gold-02.webp'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Download',
  description: 'The Correnthian mobile apps are not in the App Store or Google Play.',
}

const points = [
  {
    title: 'No store listing',
    body: 'There is no Correnthian app in the App Store or on Google Play. This page does not install one.',
  },
  {
    title: 'The key stays on the device',
    body: 'A key would stay on the phone. It is not sent to Correnthian, and the account would be one only you can move.',
  },
  {
    title: 'Buy and swap are separate screens',
    body: 'The phone would show the same screens as the account: portfolio, buy, swap, and activity. A card or bank purchase is not a swap. Buy stays refused until a provider is contracted.',
  },
] as const

export default function Page() {
  return (
    <section className="pt-32 pb-16 md:pt-42 md:pb-24 lg:pt-50">
      <div className="container">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-2xl">
            <h1 className="text-default-900 text-4xl font-medium tracking-tight md:text-5xl lg:text-6xl">The apps are not in the stores</h1>
            <p className="text-default-600 mt-5 text-base leading-relaxed md:text-xl">The phone would be the same account: portfolio, buy, swap, and activity. There is no store listing to download.</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link href="/waitlist" className="rounded-full bg-default-900 inline-flex px-8 py-3.5 text-sm font-medium text-white transition-all hover:scale-95">
                Join the waitlist
              </Link>
              <Link href="/products/app" className="text-default-900 text-sm font-medium underline-offset-4 hover:underline">
                What the app will show
              </Link>
            </div>
          </div>
          <Image src={goldBar} alt="A single fine gold bar on dark cloth" className="h-auto max-h-[28rem] w-full rounded-3xl object-cover" />
        </div>

        <ul className="mt-16 grid gap-5 md:grid-cols-3">
          {points.map((point) => (
            <li key={point.title} className="rounded-3xl border border-zinc-100 bg-white p-6">
              <h2 className="text-default-900 text-lg font-medium">{point.title}</h2>
              <p className="text-default-600 mt-2 text-sm leading-relaxed md:text-base">{point.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
