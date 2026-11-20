import downloadHand from '@/assets/images/workspace/correnthian-download-hand.png'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Download App | Correnthian Digital Vault',
  description: 'Access institutional allocated Swiss gold, live spot swaps, and biometric custody directly on your iPhone or Android.',
}

const points = [
  {
    title: 'Private biometric keys',
    body: 'Cryptographic authorization keys stay protected inside your device Secure Enclave. Correnthian has zero ability to move your holdings without your biometric signature.',
  },
  {
    title: 'Instant 24/7 spot execution',
    body: 'Buy, sell, and swap between Physical Gold, Silver, BTC, ETH, and USDC in seconds with live LBMA pricing and transparent itemized quotes.',
  },
  {
    title: 'Correnthian Metal Card integration',
    body: 'Seamlessly spend your physical gold and silver balances at over 80 million Visa merchants worldwide with instant millisecond conversion.',
  },
] as const

export default function Page() {
  return (
    <section className="pt-32 pb-16 md:pt-42 md:pb-24 lg:pt-50">
      <div className="container">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-2xl">
            <span className="mb-4 inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-amber-500">
              Mobile Vault iOS & Android
            </span>
            <h1 className="text-default-900 text-4xl font-medium tracking-tight md:text-5xl lg:text-6xl">
              Your Swiss gold vault, in the palm of your hand
            </h1>
            <p className="text-default-600 mt-5 text-base leading-relaxed md:text-xl">
              Track allocated bullion holdings, execute 24/7 swaps, earn monthly silver yield, and request armored physical home delivery anytime.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link
                href="/waitlist"
                className="rounded-full bg-default-900 inline-flex px-8 py-3.5 text-sm font-medium text-white shadow-xl transition-all hover:scale-95"
              >
                Request App Early Access
              </Link>
              <Link
                href="/products/app"
                className="text-default-900 text-sm font-medium underline-offset-4 hover:underline"
              >
                Explore App Architecture
              </Link>
            </div>
          </div>
          <div className="flex justify-center">
            <Image
              src={downloadHand}
              alt="Correnthian Mobile Vault App in hand"
              className="h-auto max-h-[30rem] w-full max-w-md object-contain"
            />
          </div>
        </div>

        <ul className="mt-16 grid gap-5 md:grid-cols-3">
          {points.map((point) => (
            <li key={point.title} className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm">
              <h2 className="text-default-900 text-lg font-medium">{point.title}</h2>
              <p className="text-default-600 mt-2 text-sm leading-relaxed md:text-base">{point.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
