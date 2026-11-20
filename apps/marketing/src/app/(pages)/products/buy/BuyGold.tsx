'use client'

import { Icon } from '@iconify/react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

// Visual assets from workspace & about
import auditBarImage from '@/assets/images/locations/correnthian-audit-bg.webp'
import allocatedBarsImage from '@/assets/images/workspace/correnthian-allocated-bars.png'
import allocatedDashboardImage from '@/assets/images/workspace/correnthian-allocated-dashboard.png'
import downloadHandImage from '@/assets/images/workspace/correnthian-download-hand.png'
import heroPhoneImage from '@/assets/images/workspace/correnthian-hero-phone.png'
import portfolioPhoneImage from '@/assets/images/workspace/correnthian-portfolio-phone.png'
import silverPhoneImage from '@/assets/images/workspace/correnthian-silver-phone.png'
import vaultGoldStacked from '@/assets/images/about/vault-gold-01.webp'
import vaultGoldBar from '@/assets/images/about/vault-gold-02.webp'
import metalSilverBars from '@/assets/images/about/metal-silver-01.webp'
import showcaseBuySell from '@/assets/images/workspace/showcase-buy-sell.webp'
import showcaseAllocatedVaults from '@/assets/images/workspace/showcase-allocated-vaults.webp'
import showcasePhysicalRedemption from '@/assets/images/workspace/showcase-physical-redemption.webp'

// Base spot price (USD per gram of LBMA 999.9 fine gold)
const SPOT_PRICE_PER_GRAM = 88.42
const GRAMS_PER_TROY_OZ = 31.1034768

type Currency = 'USD' | 'EUR' | 'GBP' | 'USDC'
type PaymentMethod = 'fiat' | 'crypto'

export default function BuyGold() {
  // Calculator state
  const [currency, setCurrency] = useState<Currency>('USD')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('fiat')
  const [amount, setAmount] = useState<number>(2500)
  const [activePersona, setActivePersona] = useState<number>(0)
  const [activeFaq, setActiveFaq] = useState<number | null>(0)

  // Calculations
  const currencyRate = currency === 'EUR' ? 0.92 : currency === 'GBP' ? 0.79 : 1.0
  const effectiveUsd = amount / currencyRate
  const gramsReceived = (effectiveUsd / SPOT_PRICE_PER_GRAM).toFixed(2)
  const ozReceived = (effectiveUsd / SPOT_PRICE_PER_GRAM / GRAMS_PER_TROY_OZ).toFixed(3)
  const executionFee = (amount * 0.0022).toFixed(2)

  const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$'

  const personas = [
    {
      title: 'Wealth Preservation (Savers)',
      badge: 'Deflationary Anchor',
      subtitle: 'Shield capital from inflation and systemic banking contagion.',
      description:
        'Traditional bank accounts expose your capital to fractional-reserve balance sheets and steady purchasing power decay. Correnthian Gold allocates 100% physically segregated 999.9 bullion directly in your legal name with zero monthly storage fees.',
      image: vaultGoldStacked,
      stats: [
        { label: 'Custody Fee', value: '$0.00 / mo' },
        { label: 'Asset Title', value: 'Direct Legal Bailment' },
        { label: 'Vault Jurisdiction', value: 'Zurich, Switzerland' },
      ],
      linkText: 'Explore Swiss Vault Storage',
      linkHref: '/products/gold',
    },
    {
      title: 'Active Traders & Hedgers',
      badge: '24/7 Deep Liquidity',
      subtitle: 'Instant swaps between physical gold, silver, Bitcoin, and cash.',
      description:
        'Never miss market swings or wait for Monday morning bullion desk opening hours. Rebalance between Physical Gold, Silver, BTC, ETH, and USDC in sub-seconds with tight institutional spreads and immediate cryptographic finality.',
      image: allocatedDashboardImage,
      stats: [
        { label: 'Market Uptime', value: '24/7/365 Non-stop' },
        { label: 'Execution Spread', value: '0.22% Spot' },
        { label: 'Settlement Speed', value: 'Instant On-Chain' },
      ],
      linkText: 'Discover 24/7 Swaps',
      linkHref: '/products/swap',
    },
    {
      title: 'Everyday Spenders (Metal Card)',
      badge: 'Global Point-of-Sale',
      subtitle: 'Spend physical bullion at 80M+ merchants worldwide with Visa.',
      description:
        'Unbind your gold from static vault deposit boxes. Link your vaulted bullion to the Correnthian Metal Debit Card. When you pay for coffee, travel, or bills, your gold is converted at the exact millisecond of tap at live spot rates.',
      image: silverPhoneImage,
      stats: [
        { label: 'Global Acceptance', value: '80M+ Visa Merchants' },
        { label: 'Foreign Exchange', value: 'Zero Surcharge' },
        { label: 'Physical Card', value: 'Solid Matte Metal' },
      ],
      linkText: 'Get the Correnthian Card',
      linkHref: '/products/app',
    },
    {
      title: 'Treasuries & Family Offices',
      badge: 'Institutional Governance',
      subtitle: 'Multi-signature controls, dedicated vaults, and bespoke audit attestations.',
      description:
        'Institutional treasuries require multi-party compute authorization, dual-custody withdrawal approvals, and rigorous regulatory compliance. Correnthian provides customized segregated vault allocations with automated monthly balance sheet audit reporting.',
      image: showcaseAllocatedVaults,
      stats: [
        { label: 'Auditor Verification', value: 'Bureau Veritas' },
        { label: 'Multi-Sig Keys', value: 'Quorum Governance' },
        { label: 'Capacity', value: 'Uncapped Allocation' },
      ],
      linkText: 'Institutional Solutions',
      linkHref: '/contact',
    },
  ]

  const custodySteps = [
    {
      number: '01',
      title: 'LBMA Vault Ingress',
      body: 'Good Delivery 400oz bullion bars from accredited Swiss refiners (Argor-Heraeus, Valcambi, PAMP) arrive under armored transport at Brink’s Zurich and Loomis Singapore.',
      badge: 'Physical Verification',
    },
    {
      number: '02',
      title: 'Assay & Serial Registration',
      body: 'Every individual bar is assayed to verify 999.9 minimum fineness. Unique refiner hallmark serials, gross weight, and fine gold weight are inscribed onto the cryptographic audit ledger.',
      badge: '999.9 Certified Purity',
    },
    {
      number: '03',
      title: '1:1 Digital Title Minting',
      body: 'Digital ownership certificates (CGX) are minted strictly 1:1 against physical grams resting inside the vault. Tokens cannot be generated without an unencumbered physical bar on deposit.',
      badge: 'Zero Fractional Reserve',
    },
    {
      number: '04',
      title: 'Monthly Silver Yield Generation',
      body: 'Opt your vaulted bullion into our institutional physical lease programs. Receive passive monthly returns distributed directly in physical silver credited to your vault on day one.',
      badge: 'Paid in Real Silver',
    },
    {
      number: '05',
      title: 'Physical Unboxing & Home Delivery',
      body: 'Exercise your legal right to take delivery anytime. Redeem your digital balance for stamped, serialized 10g, 100g, or 1kg fine bullion bars shipped securely via armored courier to your home.',
      badge: 'Global Armored Transport',
    },
  ]

  const comparisonRows = [
    {
      feature: 'Legal Ownership Structure',
      correnthian: 'Direct Legal Title (Allocated Bailment)',
      bullionDealer: 'Direct Physical (Stored at Home)',
      goldEtf: 'Beneficial Trust Unit (No Bar Claim)',
      fiatBank: 'Unsecured Creditor Liability',
    },
    {
      feature: 'Monthly Custody & Vault Storage Fees',
      correnthian: '$0.00 / month (Guaranteed Free)',
      bullionDealer: '0.60% – 1.80% / yr vaulting or home safe risk',
      goldEtf: '0.40% annual expense drag on shares',
      fiatBank: 'Account maintenance & hidden inflation decay',
    },
    {
      feature: 'Minimum Purchase Amount',
      correnthian: '$1.00 (Fractional grams)',
      bullionDealer: '$500 – $3,000 per bar + hefty premiums',
      goldEtf: 'Full share price (~$250+)',
      fiatBank: '$1.00',
    },
    {
      feature: '24/7 Market Liquidity',
      correnthian: 'Instant 24/7/365 execution',
      bullionDealer: 'Days or weeks to ship, assay & sell',
      goldEtf: 'Restricted to regular stock market hours',
      fiatBank: 'Banking hours & wire transfer holds',
    },
    {
      feature: 'Everyday Card Spendability',
      correnthian: 'Yes (Correnthian Metal Visa Card)',
      bullionDealer: 'Impossible at point-of-sale',
      goldEtf: 'No spend capability',
      fiatBank: 'Yes (Standard fiat debit card)',
    },
    {
      feature: 'Physical Delivery to Doorstep',
      correnthian: 'Yes (10g, 100g, 1kg LBMA bars)',
      bullionDealer: 'Yes (Already in possession or dealer ship)',
      goldEtf: 'No (Institutional only >100,000 oz)',
      fiatBank: 'Paper bank notes only',
    },
    {
      feature: 'Monthly Metal Yield Return',
      correnthian: 'Earn passive physical silver monthly',
      bullionDealer: '0% yield (Dead weight cost)',
      goldEtf: '0% yield (Negative net cost)',
      fiatBank: 'Near-zero or below inflation rates',
    },
    {
      feature: 'Independent Physical Vault Audits',
      correnthian: 'Bi-annual physical count by Bureau Veritas',
      bullionDealer: 'Self-inspected',
      goldEtf: 'Internal accounting ledger audits',
      fiatBank: 'Fractional reserve central bank oversight',
    },
  ]

  const vaultLocations = [
    {
      city: 'Zurich',
      country: 'Switzerland',
      facility: "Brink's High-Security Freezone",
      jurisdiction: 'Sovereign Swiss neutrality & private property protections.',
    },
    {
      city: 'Singapore',
      country: 'Republic of Singapore',
      facility: 'Loomis International Le Freeport',
      jurisdiction: 'Tier-1 Asian financial safe harbor with direct customs clearance.',
    },
    {
      city: 'London',
      country: 'United Kingdom',
      facility: 'Malca-Amit LBMA Registered Vault',
      jurisdiction: 'Heart of the global OTC gold spot settlement market.',
    },
    {
      city: 'New York',
      country: 'United States',
      facility: "Brink's COMEX Depository",
      jurisdiction: 'Regulated North American exchange bullion gateway.',
    },
    {
      city: 'Dubai',
      country: 'United Arab Emirates',
      facility: 'DMCC Almas Tower Vault',
      jurisdiction: 'Major cross-border bullion trading corridor between East & West.',
    },
  ]

  const faqs = [
    {
      question: 'Do I legally own the physical gold when I buy on Correnthian?',
      answer:
        'Yes. When you buy gold on Correnthian, you acquire direct, unencumbered legal title under an allocated bailment structure. The gold bars are not assets of Correnthian and do not appear on our balance sheet. If Correnthian were ever to cease operations, your gold remains 100% your property and cannot be claimed by any creditor.',
    },
    {
      question: 'How are my holdings insured against loss or theft?',
      answer:
        "Every single gram of physical gold and silver stored across our global vault network is covered by comprehensive all-risk physical insurance underwritten by syndicates at Lloyd's of London. This policy protects your bullion against theft, physical damage, and natural disasters at 100% of current market replacement value.",
    },
    {
      question: 'How can Correnthian offer zero monthly storage fees?',
      answer:
        'Traditional bullion dealers charge recurring vaulting fees of 0.5% to 1.5% annually. Correnthian earns revenue through a modest 0.22% transaction fee when you buy, sell, or trade metals, and through institutional treasury partnerships. We pass these efficiencies back to you, guaranteeing zero storage fees regardless of how long you hold.',
    },
    {
      question: 'Can I withdraw and take physical delivery of my gold bars?',
      answer:
        'Absolutely. You can initiate physical redemption directly from your dashboard at any time. We deliver LBMA-accredited 10g, 100g, or 1kg fine gold bars (999.9 purity) in sealed, tamper-evident presentation packaging via fully insured armored courier (such as Brink’s or Malca-Amit) to your verified residential address.',
    },
    {
      question: 'What payment methods can I use to purchase gold?',
      answer:
        'You can fund your vault via instant bank transfer (SEPA Instant in Europe, Fedwire / ACH in the US, Faster Payments in the UK), major Visa and Mastercard debit/credit cards, or through direct deposits of Bitcoin (BTC), Ethereum (ETH), and USDC. All settlements occur at live market spot rates.',
    },
    {
      question: 'How does Correnthian Gold (CGX) differ from a gold ETF (like GLD)?',
      answer:
        'Gold ETFs provide price exposure by granting you shares in a financial trust, but you do not hold legal title to any specific bar of gold, and you cannot redeem physical bars unless you are an institutional participant with tens of millions of dollars. Correnthian provides true title ownership, 24/7 liquidity, debit card spendability, and physical delivery on demand starting at just 10 grams.',
    },
  ]

  return (
    <div className="min-h-screen bg-[#07080b] text-zinc-100 selection:bg-amber-500/30 selection:text-amber-200">
      {/* SECTION 1: CINEMATIC HERO & LIVE ESTIMATOR */}
      <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
        {/* Ambient background glows */}
        <div className="pointer-events-none absolute top-10 left-1/2 h-96 w-[700px] -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-500/10 via-amber-600/5 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute top-60 right-10 h-72 w-72 rounded-full bg-amber-400/5 blur-2xl" />

        <div className="container relative z-10 mx-auto px-6">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
            {/* Left Hero Column */}
            <div className="lg:col-span-7">
              {/* Trust Tag */}
              <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-1.5 backdrop-blur-md">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-amber-400" />
                </span>
                <span className="text-xs font-semibold tracking-wider text-amber-300 uppercase">
                  Correnthian Allocated Bullion ★ Swiss Vault Custody
                </span>
              </div>

              <h1 className="text-4xl font-light tracking-tight text-white md:text-6xl lg:text-7xl">
                Unlock the Power of <br />
                <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500 bg-clip-text font-normal text-transparent">
                  Physical Gold
                </span>{' '}
                as Modern Money
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-300 md:text-xl">
                Buy, hold, and trade 1:1 allocated investment-grade gold bullion (999.9 fine) stored in insured Zurich
                and Singapore vaults. Zero monthly storage fees, instant 24/7 liquidity, and true legal title.
              </p>

              {/* Trust Guarantee Badges */}
              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm">
                  <Icon icon="lucide:shield-check" className="size-5 shrink-0 text-amber-400" />
                  <span className="text-xs font-medium text-zinc-200">100% Allocated</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm">
                  <Icon icon="lucide:lock" className="size-5 shrink-0 text-amber-400" />
                  <span className="text-xs font-medium text-zinc-200">Lloyd&apos;s Insured</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm">
                  <Icon icon="lucide:file-check-2" className="size-5 shrink-0 text-amber-400" />
                  <span className="text-xs font-medium text-zinc-200">Audited bi-annually</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm">
                  <Icon icon="lucide:truck" className="size-5 shrink-0 text-amber-400" />
                  <span className="text-xs font-medium text-zinc-200">Doorstep Delivery</span>
                </div>
              </div>

              {/* CTAs */}
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/waitlist"
                  className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-600 px-8 py-4 text-sm font-semibold text-black shadow-lg shadow-amber-500/20 transition-all duration-300 hover:scale-105 hover:shadow-amber-500/30"
                >
                  <span>Open Your Vault Account</span>
                  <Icon
                    icon="lucide:arrow-right"
                    className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                  />
                </Link>
                <Link
                  href="/products/gold"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-4 text-sm font-medium text-white backdrop-blur-sm transition-all duration-300 hover:border-amber-400/40 hover:bg-white/10"
                >
                  <Icon icon="lucide:vault" className="size-4 text-amber-400" />
                  <span>Inspect Zurich Vaults</span>
                </Link>
              </div>
            </div>

            {/* Right Hero Column: Interactive Buy Estimator Calculator */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#14151c]/95 to-[#0d0e14]/95 p-6 shadow-2xl shadow-black/80 backdrop-blur-xl sm:p-8">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-5">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Live Buy Gold Estimator</h2>
                    <p className="text-xs text-zinc-400">Institutional wholesale spot conversion</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    <span>Live Spot Feed</span>
                  </div>
                </div>

                {/* Payment Method Switcher */}
                <div className="mt-5 grid grid-cols-2 rounded-xl border border-white/10 bg-black/40 p-1">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('fiat')}
                    className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-all ${
                      paymentMethod === 'fiat'
                        ? 'border border-amber-500/30 bg-white/10 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Icon icon="lucide:credit-card" className="size-3.5 text-amber-400" />
                    <span>Bank / Card (Fiat)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('crypto')}
                    className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-all ${
                      paymentMethod === 'crypto'
                        ? 'border border-amber-500/30 bg-white/10 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Icon icon="lucide:bitcoin" className="size-3.5 text-amber-400" />
                    <span>Crypto (USDC / BTC)</span>
                  </button>
                </div>

                {/* Currency Selector */}
                <div className="mt-4 flex items-center justify-between">
                  <label htmlFor="currency-select" className="text-xs font-medium text-zinc-400">
                    Currency
                  </label>
                  <div id="currency-select" className="flex items-center gap-1.5">
                    {(['USD', 'EUR', 'GBP', 'USDC'] as Currency[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCurrency(c)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                          currency === c
                            ? 'border border-amber-500/40 bg-amber-500/20 text-amber-300'
                            : 'border border-transparent bg-white/5 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount Input */}
                <div className="mt-4">
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-xl font-medium text-zinc-400">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      min="50"
                      max="1000000"
                      step="50"
                      value={amount}
                      onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                      className="w-full rounded-2xl border border-white/10 bg-black/60 py-4 pr-4 pl-10 text-2xl font-light text-white transition focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  {/* Preset Quick Buttons */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {[500, 1000, 2500, 5000, 10000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(preset)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                          amount === preset
                            ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                            : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        {currencySymbol}
                        {preset.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Calculated Result Card */}
                <div className="mt-6 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-amber-950/20 to-black/60 p-5">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs font-medium tracking-wider text-amber-400 uppercase">You Receive</p>
                      <p className="mt-1 text-3xl font-light text-white md:text-4xl">
                        {gramsReceived} <span className="text-lg font-normal text-amber-300">grams</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-400">Troy Ounces</p>
                      <p className="text-lg font-medium text-zinc-200">{ozReceived} oz</p>
                    </div>
                  </div>

                  {/* Itemized Transparency Specs */}
                  <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-xs">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>Metal Standard</span>
                      <span className="font-medium text-zinc-200">LBMA Good Delivery (999.9 Fine)</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>Monthly Storage Fee</span>
                      <span className="font-semibold text-emerald-400">$0.00 / month (Guaranteed Free)</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>Direct Legal Title</span>
                      <span className="font-medium text-zinc-200">Allocated Bailment Deed</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>Execution Fee (0.22%)</span>
                      <span className="font-mono text-zinc-300">
                        {currencySymbol}
                        {executionFee}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Submit CTA */}
                <Link
                  href="/waitlist"
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 py-4 text-center text-sm font-semibold text-black shadow-lg shadow-amber-500/25 transition-all duration-300 hover:opacity-95"
                >
                  <span>Buy {gramsReceived}g Allocated Gold</span>
                  <Icon icon="lucide:arrow-right" className="size-4" />
                </Link>

                <p className="mt-3 text-center text-[11px] text-zinc-500">
                  Instant allocation upon confirmation. Stored at Brink&apos;s Zurich Freezone.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1B: STICKY LIVE SPOT TICKER BAR */}
        <div className="mt-16 border-y border-white/10 bg-[#0c0d13]/90 py-3.5 backdrop-blur-md">
          <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-6 text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-400" />
                <span className="font-semibold text-white">CGX SPOT</span>
              </div>
              <span className="font-mono text-amber-300">${SPOT_PRICE_PER_GRAM} / gram</span>
              <span className="hidden font-mono text-zinc-400 sm:inline">($2,750.15 / oz)</span>
              <span className="font-semibold text-emerald-400">+1.85% (24h)</span>
            </div>
            <div className="hidden items-center gap-6 text-zinc-400 md:flex">
              <span>Primary Vault: Zurich Freezone (Brink&apos;s)</span>
              <span>•</span>
              <span>Status: 100% Segregated & Audited</span>
              <span>•</span>
              <span className="text-zinc-200">LBMA 999.9 Good Delivery Standard</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: "USE GOLD YOUR WAY" PERSONA TABS */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold tracking-widest text-amber-400 uppercase">Tailored Bullion Utility</p>
            <h2 className="mt-3 text-3xl font-light text-white md:text-5xl">Use Physical Gold Your Way</h2>
            <p className="mt-4 text-base text-zinc-400 md:text-lg">
              Gold is no longer a static relic trapped in a distant safety deposit box. Seamlessly adapt your vaulted
              bullion to your life, business, or trading desk.
            </p>
          </div>

          {/* Persona Segmented Switcher */}
          <div className="mt-12 flex justify-center">
            <div className="inline-flex max-w-full flex-wrap justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] p-1.5 backdrop-blur-md">
              {personas.map((persona, index) => (
                <button
                  key={persona.title}
                  type="button"
                  onClick={() => setActivePersona(index)}
                  className={`rounded-full px-5 py-2.5 text-xs font-medium transition-all duration-300 md:text-sm ${
                    activePersona === index
                      ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  {persona.title.split(' ')[0]} {persona.title.split(' ')[1]}
                </button>
              ))}
            </div>
          </div>

          {/* Active Persona Showcase Card */}
          <div className="mt-10 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-8 md:p-12">
            <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
              <div className="lg:col-span-6">
                <span className="inline-block rounded-full border border-amber-400/30 bg-amber-400/10 px-3.5 py-1 text-xs font-semibold text-amber-300">
                  {personas[activePersona].badge}
                </span>
                <h3 className="mt-4 text-2xl font-light text-white md:text-4xl">{personas[activePersona].title}</h3>
                <p className="mt-2 text-base font-medium text-amber-200/80">{personas[activePersona].subtitle}</p>
                <p className="mt-5 text-sm leading-relaxed text-zinc-300 md:text-base">
                  {personas[activePersona].description}
                </p>

                {/* Stats Row */}
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {personas[activePersona].stats.map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/40 p-4">
                      <p className="text-xs text-zinc-400">{stat.label}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8">
                  <Link
                    href={personas[activePersona].linkHref}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-amber-400 transition hover:text-amber-300"
                  >
                    <span>{personas[activePersona].linkText}</span>
                    <Icon icon="lucide:arrow-right" className="size-4" />
                  </Link>
                </div>
              </div>

              <div className="flex justify-center lg:col-span-6">
                <div className="relative aspect-video w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
                  <Image
                    src={personas[activePersona].image}
                    alt={personas[activePersona].title}
                    fill
                    className="object-cover object-center"
                    sizes="(min-width: 1024px) 500px, 100vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: "WHAT IS CORRENTHIAN GOLD (CGX)?" CUSTODY LIFECYCLE */}
      <section className="border-t border-white/10 bg-[#0a0b10] py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:col-span-5">
              <span className="text-xs font-semibold tracking-widest text-amber-400 uppercase">
                Provenance & Security
              </span>
              <h2 className="mt-3 text-3xl font-light text-white md:text-5xl">
                Money Built to Last: The Correnthian Custody Standard
              </h2>
              <p className="mt-6 text-base leading-relaxed text-zinc-300">
                Every gram of Correnthian Gold (CGX) represents direct, unencumbered title to serialized physical
                bullion resting in high-security Swiss vaults. It is not an IOU, synthetic derivative, or fractional
                bank claim.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-6 items-center justify-center rounded-full bg-amber-400/20 text-amber-400">
                    <Icon icon="lucide:check" className="size-3.5" />
                  </div>
                  <span className="text-sm font-medium text-zinc-200">1:1 Backed by 999.9 Fine LBMA Bars</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex size-6 items-center justify-center rounded-full bg-amber-400/20 text-amber-400">
                    <Icon icon="lucide:check" className="size-3.5" />
                  </div>
                  <span className="text-sm font-medium text-zinc-200">Bankruptcy-Remote Independent Trust</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex size-6 items-center justify-center rounded-full bg-amber-400/20 text-amber-400">
                    <Icon icon="lucide:check" className="size-3.5" />
                  </div>
                  <span className="text-sm font-medium text-zinc-200">Bi-Annual Physical Audits by Bureau Veritas</span>
                </div>
              </div>

              <div className="mt-10">
                <Link
                  href="/waitlist"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-black transition-all hover:scale-95"
                >
                  <span>Open Your Vault</span>
                  <Icon icon="lucide:arrow-right" className="size-4" />
                </Link>
              </div>
            </div>

            {/* Right: 5-Stage Interconnected Vertical Node Timeline */}
            <div className="space-y-6 lg:col-span-7">
              {custodySteps.map((step, index) => (
                <div
                  key={step.number}
                  className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-amber-400/30 hover:bg-white/[0.05] sm:p-8"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xl font-bold text-amber-400">{step.number}</span>
                      <h3 className="text-xl font-medium text-white">{step.title}</h3>
                    </div>
                    <span className="shrink-0 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                      {step.badge}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-300 sm:text-base">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: "THE BEST OF BOTH WORLDS" DUAL COMPARISON CARDS */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold tracking-widest text-amber-400 uppercase">Engineered Convergence</p>
            <h2 className="mt-3 text-3xl font-light text-white md:text-5xl">The Best of Both Worlds</h2>
            <p className="mt-4 text-base text-zinc-400 md:text-lg">
              Physical bullion has guarded wealth across five millennia. Digital rails provide the velocity of modern
              commerce. Correnthian unites both without compromise.
            </p>
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-2">
            {/* Card 1: Physical Bullion Security */}
            <div className="flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-8 md:p-10">
              <div>
                <span className="text-xs font-bold tracking-wider text-amber-400 uppercase">
                  Physical Bullion Security
                </span>
                <h3 className="mt-3 text-2xl font-light text-white md:text-3xl">
                  The Unshakable Permanence of Swiss Vault Custody
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                  Protected outside the fractional banking system in high-security Swiss freezones with legal bailment
                  title and zero counterparty risk.
                </p>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-zinc-200">
                    <Icon icon="lucide:check-circle-2" className="size-4 shrink-0 text-amber-400" />
                    <span>Direct non-fungible legal title to serialized 999.9 gold bars</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-zinc-200">
                    <Icon icon="lucide:check-circle-2" className="size-4 shrink-0 text-amber-400" />
                    <span>Fully insured by syndicates at Lloyd&apos;s of London at replacement value</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-zinc-200">
                    <Icon icon="lucide:check-circle-2" className="size-4 shrink-0 text-amber-400" />
                    <span>Redeemable for physical bullion delivered by armored courier</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
                <Image
                  src={allocatedBarsImage}
                  alt="Serialized fine gold bullion bars"
                  className="h-56 w-full object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
            </div>

            {/* Card 2: Digital Financial Velocity */}
            <div className="flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-8 md:p-10">
              <div>
                <span className="text-xs font-bold tracking-wider text-amber-400 uppercase">
                  Digital Financial Velocity
                </span>
                <h3 className="mt-3 text-2xl font-light text-white md:text-3xl">
                  The Frictionless Freedom of Modern Digital Money
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                  Send, trade, and spend bullion instantly worldwide with zero weekend halts, zero storage penalties,
                  and fractional allocations from $1.
                </p>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-zinc-200">
                    <Icon icon="lucide:check-circle-2" className="size-4 shrink-0 text-amber-400" />
                    <span>Fractional ownership down to single cents with instant settlement</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-zinc-200">
                    <Icon icon="lucide:check-circle-2" className="size-4 shrink-0 text-amber-400" />
                    <span>Spendable anywhere Visa is accepted via Correnthian Metal Card</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-zinc-200">
                    <Icon icon="lucide:check-circle-2" className="size-4 shrink-0 text-amber-400" />
                    <span>Swap between Gold, Silver, BTC, and USDC 24/7/365</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
                <Image
                  src={heroPhoneImage}
                  alt="Correnthian Digital Vault mobile application"
                  className="h-56 w-full object-cover object-top transition-transform duration-500 hover:scale-105"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: TRANSPARENCY AT EVERY LAYER (FEATURING CORRENTHIAN AUDIT BG) */}
      <section className="border-t border-white/10 bg-[#0b0c12] py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-amber-500/20 shadow-2xl lg:col-span-6">
              <Image
                src={auditBarImage}
                alt="Correnthian Vault 100g 999.9 Fine Gold Bar with official seal EST 2026"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 600px, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute right-6 bottom-6 left-6 rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-md">
                <p className="text-xs font-semibold text-amber-300">CORRENTHIAN VAULT ★ EST. 2026</p>
                <p className="text-xs text-zinc-300">100g Fine Gold 999.9 • Serialized LBMA Stamped Ingot</p>
              </div>
            </div>

            <div className="lg:col-span-6">
              <span className="text-xs font-semibold tracking-widest text-amber-400 uppercase">
                Independent Audits & Governance
              </span>
              <h2 className="mt-3 text-3xl font-light text-white md:text-5xl">
                Every Bar Stamped, Insured, and Independently Counted
              </h2>
              <p className="mt-6 text-base leading-relaxed text-zinc-300">
                Trust is built through radical transparency. We believe you should never have to take a financial
                institution’s word for whether your assets actually exist.
              </p>

              <div className="mt-8 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
                    <Icon icon="lucide:scale" className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Bureau Veritas Physical Audits</h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      World-leading inspection agency Bureau Veritas physically inspects and tallies every bar inside
                      Zurich and Singapore vaults twice a year, verifying serialized numbers against the public ledger.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
                    <Icon icon="lucide:shield-alert" className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Lloyd&apos;s of London Comprehensive Policy</h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      100% of all metals in transit and in vault storage are underwritten by syndicates at Lloyd&apos;s
                      of London, covering physical damage, armed theft, and natural hazards.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
                    <Icon icon="lucide:file-badge" className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Bankruptcy-Remote Legal Trust</h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      Your metal is held in an independent legal trust structure outside Correnthian&apos;s corporate
                      entity. In any eventuality, creditors have zero access or claims on your bullion.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: "GOLD REINTRODUCED FOR THE 21ST CENTURY" MATRIX */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold tracking-widest text-amber-400 uppercase">Competitive Matrix</p>
            <h2 className="mt-3 text-3xl font-light text-white md:text-5xl">Gold Reintroduced for the 21st Century</h2>
            <p className="mt-4 text-base text-zinc-400 md:text-lg">
              Compare Correnthian against traditional physical bullion dealers, paper gold ETFs, and fiat bank
              deposits.
            </p>
          </div>

          <div className="mt-12 overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.02]">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th className="p-5 font-semibold text-zinc-400">Core Metric</th>
                  <th className="border-x border-amber-500/30 bg-amber-500/10 p-5 font-bold text-amber-300">
                    Correnthian Gold (CGX)
                  </th>
                  <th className="p-5 font-semibold text-zinc-300">Bullion Dealer</th>
                  <th className="p-5 font-semibold text-zinc-300">Gold ETF (GLD)</th>
                  <th className="p-5 font-semibold text-zinc-300">Bank Deposit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {comparisonRows.map((row) => (
                  <tr key={row.feature} className="transition-colors hover:bg-white/[0.02]">
                    <td className="p-5 font-medium text-white">{row.feature}</td>
                    <td className="border-x border-amber-500/20 bg-amber-500/[0.05] p-5 font-semibold text-amber-300">
                      {row.correnthian}
                    </td>
                    <td className="p-5 text-zinc-400">{row.bullionDealer}</td>
                    <td className="p-5 text-zinc-400">{row.goldEtf}</td>
                    <td className="p-5 text-zinc-400">{row.fiatBank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex justify-center">
            <Link
              href="/waitlist"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-8 py-3.5 text-sm font-semibold text-black transition-all hover:scale-105"
            >
              <span>Experience Correnthian Gold</span>
              <Icon icon="lucide:arrow-right" className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 7: "START IN THREE SIMPLE STEPS" ONBOARDING */}
      <section className="border-t border-white/10 bg-[#0a0b10] py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold tracking-widest text-amber-400 uppercase">Effortless Onboarding</p>
            <h2 className="mt-3 text-3xl font-light text-white md:text-5xl">Start in Three Simple Steps</h2>
            <p className="mt-4 text-base text-zinc-400 md:text-lg">
              Opening your private digital bullion vault takes under two minutes. No paperwork, no physical vault
              trips.
            </p>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {/* Step 1 */}
            <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.03] p-8 transition hover:border-amber-400/30 hover:bg-white/[0.05]">
              <div>
                <span className="font-mono text-3xl font-light text-amber-400">01</span>
                <h3 className="mt-4 text-xl font-medium text-white">Open Your Vault Account</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                  Register in under 2 minutes. Complete seamless biometric identity verification with tier-1 bank grade
                  data encryption.
                </p>
              </div>
              <div className="mt-8 overflow-hidden rounded-xl border border-white/10">
                <Image src={showcaseBuySell} alt="Open Vault Account" className="h-44 w-full object-cover" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.03] p-8 transition hover:border-amber-400/30 hover:bg-white/[0.05]">
              <div>
                <span className="font-mono text-3xl font-light text-amber-400">02</span>
                <h3 className="mt-4 text-xl font-medium text-white">Fund via Bank, Card or Crypto</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                  Deposit USD, EUR, or GBP via instant bank transfer or debit card, or deposit USDC, BTC, and ETH
                  directly without conversion penalties.
                </p>
              </div>
              <div className="mt-8 overflow-hidden rounded-xl border border-white/10">
                <Image
                  src={portfolioPhoneImage}
                  alt="Fund via Bank or Card"
                  className="h-44 w-full object-cover object-top"
                />
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.03] p-8 transition hover:border-amber-400/30 hover:bg-white/[0.05]">
              <div>
                <span className="font-mono text-3xl font-light text-amber-400">03</span>
                <h3 className="mt-4 text-xl font-medium text-white">Own, Earn Yield or Redeem</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                  Buy allocated gold at live spot prices. Hold with zero storage fees, earn monthly physical silver
                  yield, spend on your card, or request delivery.
                </p>
              </div>
              <div className="mt-8 overflow-hidden rounded-xl border border-white/10">
                <Image
                  src={showcasePhysicalRedemption}
                  alt="Own, Earn Yield or Redeem"
                  className="h-44 w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8: INSTITUTIONAL VAULT NETWORK */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold tracking-widest text-amber-400 uppercase">
              Global Custody Infrastructure
            </p>
            <h2 className="mt-3 text-3xl font-light text-white md:text-5xl">Institutional Vault Network</h2>
            <p className="mt-4 text-base text-zinc-400 md:text-lg">
              Your metals are safeguarded across five world-renowned bullion depositories in neutral, secure
              jurisdictions.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {vaultLocations.map((vault) => (
              <div
                key={vault.city}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-amber-400/30 hover:bg-white/[0.05]"
              >
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:building-2" className="size-4 text-amber-400" />
                  <h3 className="text-lg font-medium text-white">{vault.city}</h3>
                </div>
                <p className="text-xs text-amber-300/80">{vault.country}</p>
                <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
                  <p className="text-xs font-medium text-zinc-200">{vault.facility}</p>
                  <p className="text-[11px] leading-relaxed text-zinc-400">{vault.jurisdiction}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 9: ACCORDION FAQ */}
      <section className="border-t border-white/10 bg-[#090a0f] py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <span className="text-xs font-semibold tracking-widest text-amber-400 uppercase">Clarity & Answers</span>
              <h2 className="mt-3 text-3xl font-light text-white md:text-5xl">Frequently Asked Questions</h2>
              <p className="mt-4 text-base text-zinc-400">
                Everything you need to know about buying, owning, and storing allocated gold on Correnthian.
              </p>

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <p className="text-sm font-medium text-white">Have a specific institutional question?</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Our private client advisory team is available 24/7 for allocations above $100k.
                </p>
                <Link
                  href="/contact"
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-xs font-medium text-white transition hover:bg-white/10"
                >
                  <Icon icon="lucide:mail" className="size-3.5 text-amber-400" />
                  <span>Contact Vault Concierge</span>
                </Link>
              </div>
            </div>

            {/* Right: FAQ Accordions */}
            <div className="space-y-4 lg:col-span-7">
              {faqs.map((faq, index) => {
                const isOpen = activeFaq === index
                return (
                  <div
                    key={faq.question}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveFaq(isOpen ? null : index)}
                      className="flex w-full items-center justify-between p-6 text-left transition hover:text-amber-300"
                    >
                      <span className="text-base font-medium text-white md:text-lg">{faq.question}</span>
                      <Icon
                        icon="lucide:chevron-down"
                        className={`size-5 shrink-0 text-zinc-400 transition-transform duration-300 ${
                          isOpen ? 'rotate-180 text-amber-400' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="border-t border-white/5 px-6 pb-6 text-sm leading-relaxed text-zinc-300 md:text-base">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 10: BENTO CROSS-SELLS */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold tracking-widest text-amber-400 uppercase">Explore the Ecosystem</p>
            <h2 className="mt-3 text-3xl font-light text-white md:text-5xl">Expand Your Physical Holdings</h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {/* Cross sell 1 */}
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition hover:border-amber-400/30">
              <div className="relative h-48 w-full">
                <Image src={metalSilverBars} alt="Earn Silver Yield" fill className="object-cover" />
              </div>
              <div className="p-6">
                <span className="text-xs font-bold text-amber-400 uppercase">Earn Passive Income</span>
                <h3 className="mt-2 text-xl font-medium text-white">Earn Physical Silver Yield</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Put your vaulted metals to work with institutional lease programs. Earn monthly distributions paid in
                  physical silver.
                </p>
                <Link
                  href="/products/silver"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-amber-400 transition hover:text-amber-300"
                >
                  <span>Learn About Silver Yield</span>
                  <Icon icon="lucide:arrow-right" className="size-4" />
                </Link>
              </div>
            </div>

            {/* Cross sell 2 */}
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition hover:border-amber-400/30">
              <div className="relative h-48 w-full">
                <Image src={vaultGoldBar} alt="Physical Redemption" fill className="object-cover" />
              </div>
              <div className="p-6">
                <span className="text-xs font-bold text-amber-400 uppercase">Home Delivery</span>
                <h3 className="mt-2 text-xl font-medium text-white">Physical Ingot Redemption</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Withdraw physical bars in 10g, 100g, or 1kg weights shipped with full insurance via armored courier to
                  your door.
                </p>
                <Link
                  href="/products/redemption"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-amber-400 transition hover:text-amber-300"
                >
                  <span>See Redemption Process</span>
                  <Icon icon="lucide:arrow-right" className="size-4" />
                </Link>
              </div>
            </div>

            {/* Cross sell 3 */}
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition hover:border-amber-400/30">
              <div className="relative h-48 w-full">
                <Image src={downloadHandImage} alt="Mobile Vault App" fill className="object-cover" />
              </div>
              <div className="p-6">
                <span className="text-xs font-bold text-amber-400 uppercase">Mobile Experience</span>
                <h3 className="mt-2 text-xl font-medium text-white">The Correnthian Vault App</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Monitor live spot valuations, execute instant swaps, manage biometric keys, and spend with your
                  contactless card.
                </p>
                <Link
                  href="/products/app"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-amber-400 transition hover:text-amber-300"
                >
                  <span>Get the Mobile App</span>
                  <Icon icon="lucide:arrow-right" className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 11: LUXURY CONVERSION CTA BANNER */}
      <section className="relative overflow-hidden border-t border-amber-500/20 bg-gradient-to-b from-amber-950/20 via-[#0d0e14] to-black py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
        <div className="container relative z-10 mx-auto px-6 text-center">
          <span className="inline-block rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-semibold tracking-wider text-amber-300 uppercase">
            The Gold Standard of Modern Wealth
          </span>
          <h2 className="mt-6 text-3xl font-light text-white md:text-5xl lg:text-6xl">
            Step into the Future of Sound Money
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-300 md:text-lg">
            Join over 32,000+ investors who own institutional allocated gold stored in insured Swiss vaults with zero
            storage fees and instant liquidity.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/waitlist"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-600 px-8 py-4 text-sm font-semibold text-black shadow-xl shadow-amber-500/25 transition-all duration-300 hover:scale-105"
            >
              <span>Open Your Vault Account</span>
              <Icon
                icon="lucide:arrow-right"
                className="size-4 transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-4 text-sm font-medium text-white backdrop-blur-sm transition-all duration-300 hover:border-amber-400/40 hover:bg-white/10"
            >
              <span>Talk to Institutional Sales</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
