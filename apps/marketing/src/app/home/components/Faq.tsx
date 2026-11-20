'use client'

import { Icon } from '@iconify/react'
import Link from 'next/link'
import { useState } from 'react'

type AccordionItemType = {
  id: string
  question: string
  answer: string
}

type FaqCategoryType = {
  id: string
  label: string
  icon: string
  items: AccordionItemType[]
}

const faqCategoriesData: FaqCategoryType[] = [
  {
    id: 'trust-security',
    label: 'Trust & Security',
    icon: 'lucide:shield-check',
    items: [
      {
        id: 'ts-1',
        question: 'Do I legally own my gold and silver with Correnthian?',
        answer:
          'Yes — when you buy gold or silver with Correnthian, you are the direct legal owner of your allocated bullion at all times. Your metal is held outright in your name, completely separate from our balance sheet, and can be redeemed for physical delivery to your front door whenever you choose.',
      },
      {
        id: 'ts-2',
        question: 'How can I be sure my bullion is in the vaults?',
        answer:
          "Every gram of gold and silver in Correnthian's vaults is matched to serialized physical bars stored with world-class custodians in Zurich and Singapore, including Brink's and Loomis. All vaulted holdings undergo regular independent third-party audits and are insured through Lloyd's of London.",
      },
      {
        id: 'ts-3',
        question: 'Can I get my physical gold and silver delivered?',
        answer:
          'Yes, you can redeem your vaulted holding for investment-grade .9999 fine gold and .999 fine silver bars or coins delivered straight to your door at any time. Our armored logistics partners securely deliver your bullion with full transit insurance.',
      },
      {
        id: 'ts-4',
        question: 'Where do Correnthian Silver Yields come from?',
        answer:
          'Correnthian shares a portion of platform transaction fee revenue with our metal holders to pay a passive monthly yield. From day one, holding allocated silver in your Correnthian vault earns you a monthly yield paid directly in physical silver — with zero lock-ups or third-party lending.',
      },
      {
        id: 'ts-5',
        question: 'How does Correnthian keep vaulting costs so low?',
        answer:
          'Unlike traditional bullion dealers that rely on steep retail markups and heavy annual storage fees, Correnthian generates revenue from transparent platform transaction volume across our institutional vaulting network — passing wholesale pricing and zero sales tax on vaulted metal directly to you.',
      },
    ],
  },
  {
    id: 'buying-metals',
    label: 'Buying Metals',
    icon: 'lucide:coins',
    items: [
      {
        id: 'bm-1',
        question: 'How can I buy gold and silver with Correnthian?',
        answer:
          'Once your Correnthian account is verified and funded, you can buy allocated physical gold and silver 24/7 with a single tap. Execute instant market orders at live spot pricing, schedule recurring buys with AutoInvest, or set automated Limit Orders that trigger when the market hits your target price.',
      },
      {
        id: 'bm-2',
        question: 'How much does it cost to buy and sell bullion?',
        answer:
          'Correnthian offers industry-low premiums over live global spot prices, with zero sales tax on vaulted bullion and regular "at spot" promotions. All pricing and fees are stated transparently upfront before you confirm any order.',
      },
      {
        id: 'bm-3',
        question: "How does Correnthian's pricing compare to traditional dealers?",
        answer:
          'Traditional coin shops and retail bullion sites charge wide markups over spot and steep buy-back spreads. Because Correnthian aggregates institutional liquidity across Zurich, Singapore, and London markets, you get institutional-grade spot execution whether you invest $10 or $1,000,000.',
      },
    ],
  },
  {
    id: 'fees-taxes',
    label: 'Fees & Taxes',
    icon: 'lucide:receipt',
    items: [
      {
        id: 'ft-1',
        question: 'Is it free to open a Correnthian account?',
        answer:
          'Yes. Creating a Correnthian Digital Vault account and downloading our mobile app is completely free. There are no sign-up costs, monthly maintenance charges, or hidden account fees.',
      },
      {
        id: 'ft-2',
        question: 'Do I pay sales tax when buying vaulted gold and silver?',
        answer:
          "No. There is no sales tax on vaulted precious metals purchased and stored inside Correnthian's professional vaults, ensuring every dollar of your purchase goes directly into more grams of pure metal.",
      },
      {
        id: 'ft-3',
        question: 'Are there transaction fees when spending with the Correnthian Card?',
        answer:
          'No — you can spend your vaulted gold and silver as currency with $0 transaction fees anywhere Mastercard is accepted, without involving traditional banks.',
      },
    ],
  },
  {
    id: 'rewards-benefits',
    label: 'Rewards & Benefits',
    icon: 'lucide:trending-up',
    items: [
      {
        id: 'rb-1',
        question: 'How do I earn a passive monthly yield on my silver?',
        answer:
          'As soon as you hold allocated silver in your Correnthian vault, you automatically begin accruing yield from day one. At the end of each month, your yield is paid directly in physical .999 fine silver grams into your vault balance.',
      },
      {
        id: 'rb-2',
        question: 'Can I sell, spend, or redeem my metals while earning yield?',
        answer:
          'Yes. Your bullion is never locked up or loaned out. You retain 100% legal ownership and instant 24/7 liquidity to sell for cash, spend via the Correnthian Card, or redeem for physical delivery at any time.',
      },
      {
        id: 'rb-3',
        question: 'How do I earn 4% back with The Bullion Card?',
        answer:
          'When you use The Bullion Card by Correnthian for everyday purchases, you automatically earn up to 4% back in allocated physical gold and silver — turning daily spending into long-term vaulted wealth.',
      },
    ],
  },
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: 'lucide:rocket',
    items: [
      {
        id: 'gs-1',
        question: 'How can I sign up for a Correnthian account?',
        answer:
          'You can register online or download the Correnthian mobile app to open your account in minutes. Enter your email, enable Face ID and two-factor authentication, and complete quick identity verification to claim your vault.',
      },
      {
        id: 'gs-2',
        question: 'How can I verify my account?',
        answer:
          'After creating your account, follow the guided KYC verification step inside the app. Identity verification protects your legal title to vaulted bullion and unlocks 24/7 trading, AutoInvest, physical redemption, and the Correnthian Card.',
      },
      {
        id: 'gs-3',
        question: 'Can I access my Correnthian vault on mobile?',
        answer:
          'Yes. Our best-in-class mobile app for iOS and Android lets you trade 24/7, inspect your serialized bars in Zurich and Singapore vaults, manage AutoInvest schedules, and download audited monthly PDF statements from anywhere.',
      },
      {
        id: 'gs-4',
        question: 'How can I deposit funds — can I deposit crypto?',
        answer:
          'You can fund your Correnthian account via bank wire transfer, debit or credit card, or by depositing digital assets including Bitcoin (BTC) and Ethereum (ETH) to hold or swap seamlessly into physical gold and silver.',
      },
    ],
  },
]

const Faq = () => {
  const [activeCategoryId, setActiveCategoryId] = useState<string>(faqCategoriesData[0].id)
  const [activeId, setActiveId] = useState<string | null>(faqCategoriesData[0].items[0].id)

  const currentCategory = faqCategoriesData.find((cat) => cat.id === activeCategoryId) ?? faqCategoriesData[0]

  const handleCategoryChange = (category: FaqCategoryType) => {
    setActiveCategoryId(category.id)
    setActiveId(category.items[0]?.id ?? null)
  }

  const toggleAccordion = (id: string) => {
    setActiveId(activeId === id ? null : id)
  }

  return (
    <section className="py-6 md:pb-10 lg:py-25">
      <div className="container">
        <div className="grid grid-cols-1 items-start gap-7.5 md:grid-cols-3 lg:grid-cols-12 lg:gap-25">
          <div className="col-span-1 space-y-10 lg:col-span-5 lg:space-y-20">
            <div className="space-y-4">
              <span className="border-default-200 text-default-800 mb-2.5 inline-block rounded-full border bg-white px-5 py-1.5 text-sm font-medium">Common Questions</span>
              <h2 className="text-default-950 text-2xl leading-normal font-medium tracking-normal md:text-4xl lg:text-5xl">Frequently asked questions</h2>
            </div>

            <div className="space-y-6 rounded-2xl bg-white p-5 shadow-xl shadow-zinc-200/50 md:p-7.5">
              <div className="bg-primary-1 flex size-12.5 items-center justify-center rounded-full shadow-lg">
                <Icon icon="lucide:headset" className="size-6 text-white" />
              </div>
              <div className="space-y-6">
                <h3 className="text-default-950 mb-3.5 text-xl font-medium md:text-2xl">Can&apos;t find your answer?</h3>
                <Link href="/contact" className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-black px-8.5 text-nowrap text-white shadow-xl transition-all duration-300 hover:scale-95">
                  <span className="relative inline-flex flex-col items-center transition-transform duration-300 group-hover:-translate-y-full">
                    <span className="flex h-14 items-center gap-3">
                      <span className="font-medium">Contact us</span>
                    </span>
                    <span className="absolute top-full flex h-14 items-center gap-3">
                      <span className="font-medium">Contact us</span>
                    </span>
                  </span>
                </Link>
              </div>
            </div>
          </div>

          <div className="col-span-2 space-y-5 lg:col-span-7">
            <nav className="flex flex-wrap items-center gap-2 md:gap-2.5" aria-label="FAQ categories" role="tablist">
              {faqCategoriesData.map((category) => {
                const isActive = category.id === activeCategoryId
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => handleCategoryChange(category)}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`faq-panel-${category.id}`}
                    id={`faq-tab-${category.id}`}
                    className={`hs-tab-active:border-default-800 hs-tab-active:bg-default-100 hs-tab-active:text-default-900 bg-default-100 hover:bg-default-100 inline-flex cursor-pointer items-center gap-x-2 rounded-xl border px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-all md:px-4 md:py-2.5 md:text-base ${
                      isActive ? 'active border-default-800 text-default-900' : 'border-default-200 text-default-500'
                    }`}
                  >
                    <Icon icon={category.icon} className="size-4 shrink-0" />
                    {category.label}
                  </button>
                )
              })}
            </nav>

            <div
              id={`faq-panel-${currentCategory.id}`}
              role="tabpanel"
              aria-labelledby={`faq-tab-${currentCategory.id}`}
              className="space-y-2.5 lg:col-span-7 lg:space-y-4"
            >
              {currentCategory.items.map((item) => {
                const isOpen = activeId === item.id
                return (
                  <div key={item.id} className={`rounded-2xl border border-zinc-100 bg-white shadow-sm ${isOpen ? 'shadow-md' : ''} transition-all duration-300`}>
                    <button
                      type="button"
                      onClick={() => toggleAccordion(item.id)}
                      className={`inline-flex w-full cursor-pointer items-center justify-between p-3.5 text-start font-bold transition hover:text-zinc-500 lg:p-5 ${
                        isOpen ? 'text-default-950' : 'text-default-900'
                      }`}
                      aria-expanded={isOpen}
                      aria-controls={item.id}
                    >
                      <h3 className="pr-3 text-base font-medium md:text-xl">{item.question}</h3>
                      <div
                        className={`bg-default-200 relative flex size-6.5 shrink-0 items-center justify-center rounded-full transition-transform duration-300 md:size-8.5 ${
                          isOpen ? 'rotate-45' : 'rotate-0'
                        }`}
                      >
                        <Icon icon="lucide:plus" className="text-default-800 size-3 md:size-5" />
                      </div>
                    </button>
                    <div id={item.id} className={`w-full overflow-hidden transition-[max-height] duration-300 ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
                      <div className="px-3.5 pb-3.5 text-base leading-normal text-zinc-500 md:text-lg md:leading-relaxed lg:px-5 lg:pb-5">{item.answer}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Faq
