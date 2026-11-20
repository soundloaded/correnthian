'use client'

import { Icon } from '@iconify/react'
import Image, { StaticImageData } from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import avatar01 from '@/assets/images/team/avatar-01.webp'
import avatar02 from '@/assets/images/team/avatar-02.webp'
import avatar03 from '@/assets/images/team/avatar-03.webp'
import avatar04 from '@/assets/images/team/avatar-04.webp'
import avatar05 from '@/assets/images/team/avatar-05.webp'
import avatar06 from '@/assets/images/team/avatar-06.webp'
import avatar07 from '@/assets/images/team/avatar-07.webp'
import avatar08 from '@/assets/images/team/avatar-08.webp'
import avatar09 from '@/assets/images/team/avatar-09.webp'

import femaleAvatar01 from '@/assets/images/team/female-avatar-01.webp'
import femaleAvatar02 from '@/assets/images/team/female-avatar-02.webp'
import femaleAvatar03 from '@/assets/images/team/female-avatar-03.webp'
import femaleAvatar04 from '@/assets/images/team/female-avatar-04.webp'
import femaleAvatar05 from '@/assets/images/team/female-avatar-05.webp'
import femaleAvatar06 from '@/assets/images/team/female-avatar-06.webp'
import femaleAvatar07 from '@/assets/images/team/female-avatar-07.webp'
import femaleAvatar08 from '@/assets/images/team/female-avatar-08.webp'
import femaleAvatar09 from '@/assets/images/team/female-avatar-09.webp'
import femaleAvatar10 from '@/assets/images/team/female-avatar-10.webp'
import femaleAvatar11 from '@/assets/images/team/female-avatar-11.webp'
import femaleAvatar12 from '@/assets/images/team/female-avatar-12.webp'

import maleAvatar01 from '@/assets/images/team/male-avatar-01.webp'
import maleAvatar02 from '@/assets/images/team/male-avatar-02.webp'
import maleAvatar03 from '@/assets/images/team/male-avatar-03.webp'
import maleAvatar04 from '@/assets/images/team/male-avatar-04.webp'
import maleAvatar05 from '@/assets/images/team/male-avatar-05.webp'
import maleAvatar06 from '@/assets/images/team/male-avatar-06.webp'
import maleAvatar07 from '@/assets/images/team/male-avatar-07.webp'
import maleAvatar08 from '@/assets/images/team/male-avatar-08.webp'
import maleAvatar09 from '@/assets/images/team/male-avatar-09.webp'
import maleAvatar10 from '@/assets/images/team/male-avatar-10.webp'
import maleAvatar11 from '@/assets/images/team/male-avatar-11.webp'
import maleAvatar12 from '@/assets/images/team/male-avatar-12.webp'

export type FeedbackItemType = {
  quote: string
  avatar: StaticImageData
  name: string
  role: string
}

const MALE_AVATARS: StaticImageData[] = [
  avatar01,
  avatar05,
  avatar07,
  maleAvatar01,
  maleAvatar02,
  maleAvatar03,
  maleAvatar04,
  maleAvatar05,
  maleAvatar06,
  maleAvatar07,
  maleAvatar08,
  maleAvatar09,
  maleAvatar10,
  maleAvatar11,
  maleAvatar12,
]

const FEMALE_AVATARS: StaticImageData[] = [
  avatar02,
  avatar03,
  avatar04,
  avatar06,
  avatar08,
  avatar09,
  femaleAvatar01,
  femaleAvatar02,
  femaleAvatar03,
  femaleAvatar04,
  femaleAvatar05,
  femaleAvatar06,
  femaleAvatar07,
  femaleAvatar08,
  femaleAvatar09,
  femaleAvatar10,
  femaleAvatar11,
  femaleAvatar12,
]

const MALE_FIRST_NAMES: string[] = [
  'Marcus',
  'Julian',
  'David',
  'Alexander',
  'Lucas',
  'Mateo',
  'Ethan',
  'Liam',
  'Sebastian',
  'Daniel',
  'Adrian',
  'Caleb',
  'Nathan',
  'Victor',
  'Gabriel',
  'Arthur',
  'Ryan',
  'Dominic',
  'Jonathan',
  'Harrison',
  'Oliver',
  'Christian',
  'Noah',
  'Leo',
]

const FEMALE_FIRST_NAMES: string[] = [
  'Elena',
  'Sophia',
  'Maya',
  'Aisha',
  'Claire',
  'Olivia',
  'Hannah',
  'Chloe',
  'Victoria',
  'Camila',
  'Nadia',
  'Riya',
  'Isabella',
  'Natalie',
  'Amara',
  'Zoe',
  'Evelyn',
  'Aria',
  'Leah',
  'Serena',
  'Naomi',
  'Stella',
  'Grace',
  'Audrey',
]

const LAST_NAMES: string[] = [
  'Vance',
  'Sterling',
  'Rostova',
  'Chen',
  'Laurent',
  'Patel',
  'Mehta',
  'Thorne',
  'Mercer',
  'Keller',
  'Sato',
  'Lindqvist',
  'Alvarez',
  'Brooks',
  'Sinclair',
  'Mendoza',
  'Okafor',
  'Bennett',
  'Callahan',
  'Moreau',
  'Richter',
  'Nakamura',
  'Whitman',
  'Fischer',
  'Delgado',
  'Henderson',
  'Kowalski',
  'Rossi',
]

const ROLES: string[] = [
  'Private Wealth Advisor',
  'Macro Portfolio Manager',
  'Fintech Founder',
  'Precious Metals Collector',
  'Family Office Director',
  'Quantitative Analyst',
  'Senior Product Architect',
  'Commodity Strategist',
  'Corporate Treasury Lead',
  'Bullion Stacker',
  'Venture Partner',
  'Real Estate Investor',
  'Principal Engineer',
  'Asset Allocation Specialist',
  'Global Macro Trader',
  'Financial Planner',
  'Digital Asset Researcher',
  'Operations Director',
  'Wealth Preservation Lead',
  'Private Equity Associate',
  'Independent Investor',
  ' Angel Investor',
]

type PostArchetype = {
  openers: string[]
  middles: string[]
  closers: string[]
}

const X_POST_ARCHETYPES: PostArchetype[] = [
  // 1. Minimal — Monthly Silver Yield
  {
    openers: [
      'Earning monthly yield paid directly in physical silver on @Correnthian changed how I stack.',
      'My vaulted silver on @Correnthian actually compounds in gram weight every month.',
      'Getting a monthly payout in .999 fine silver from day one is unreal.',
      'Most silver just sits in a safe. On @Correnthian it earns passive silver yield.',
    ],
    middles: [''],
    closers: [
      'Sound money that finally generates yield.',
      'Hands down the smartest way to own silver.',
      '',
    ],
  },
  // 2. Minimal — Allocated Serialized Bars
  {
    openers: [
      'Every gram on @Correnthian is matched to a serialized .9999 bar in my name.',
      'Verified my Zurich vault bar serial numbers in the @Correnthian app in seconds.',
      'Finally moved off paper gold ETFs into 100% allocated bullion on @Correnthian.',
      'Real serialized bars held off their balance sheet in Zurich and Singapore.',
    ],
    middles: [''],
    closers: [
      'Zero counterparty stress.',
      'This is how bullion custody should work.',
      '',
    ],
  },
  // 3. Minimal — AutoInvest Recurring Buys
  {
    openers: [
      'Weekly AutoInvest on @Correnthian made stacking physical gold effortless.',
      'Small automated gold and silver buys every payday. It adds up fast.',
      'AutoInvest took all the guesswork out of buying physical bullion.',
      'Set up a $100 weekly AutoInvest into Zurich gold and never looked back.',
    ],
    middles: [''],
    closers: [
      'Wealth building on autopilot.',
      '',
    ],
  },
  // 4. Minimal — 24/7 Spot Execution & Limit Orders
  {
    openers: [
      'My silver limit order on @Correnthian filled at 2am on a Sunday.',
      'Caught the overnight gold dip with a @Correnthian limit order while dealers were closed.',
      '24/7 execution at live spot prices makes physical gold feel as liquid as cash.',
      'Instant vault settlement at live spot, even on weekends.',
    ],
    middles: [''],
    closers: [
      'Game changer for active stackers.',
      '',
    ],
  },
  // 5. Minimal — The Correnthian Card & 4% Rewards
  {
    openers: [
      'Zero fees and 4% back in physical gold with the Correnthian Card.',
      'Spending vaulted gold and silver anywhere Mastercard is accepted feels like magic.',
      'Every coffee and flight on my Correnthian Card adds real gold grams to my vault.',
      'Skipped the banks entirely on my trip using the @Correnthian Mastercard.',
    ],
    middles: [''],
    closers: [
      'Real gold that moves at the speed of money.',
      '',
    ],
  },
  // 6. Minimal — Doorstep Physical Redemption
  {
    openers: [
      'Tapped Redeem on Tuesday and unboxed a 100g .9999 gold bar at my door on Friday.',
      'Unboxed my first physical silver redemption from @Correnthian. Sealed and insured.',
      'Knowing I can redeem my vault balance for physical bars at my door anytime is huge.',
      'From digital vault balance to stamped .9999 gold in my hand in three days.',
    ],
    middles: [''],
    closers: [
      '10/10 delivery experience.',
      '',
    ],
  },
  // 7. Minimal — Low Premiums & No Sales Tax
  {
    openers: [
      'No sales tax on vaulted metal and spreads right near live spot.',
      '@Correnthian beat my old bullion dealer on premiums across every weight tier.',
      'Transparent live spot pricing with zero hidden dealer markups.',
      'Every dollar goes into pure metal instead of steep retail coin premiums.',
    ],
    middles: [''],
    closers: [
      'More ounces for your money.',
      '',
    ],
  },
  // 8. Minimal — Audits, Insurance & Support
  {
    openers: [
      "Insured through Lloyd's of London with third-party audits I can verify in one tap.",
      'Downloaded my audited monthly vault statement PDF in seconds.',
      'Reached a real specialist on @Correnthian live support in under two minutes.',
      "Brink's custody plus regular third-party audits lets me sleep soundly.",
    ],
    middles: [''],
    closers: [
      'Built for serious long-term holders.',
      '',
    ],
  },
  // 9. Minimal — Unified Gold, Silver & Crypto Vault
  {
    openers: [
      'Physical gold, allocated silver, and Bitcoin in one self-custodial dashboard.',
      'Rotating crypto gains into vaulted .9999 Zurich gold on @Correnthian takes seconds.',
      'Finally consolidated my physical bullion and digital assets under one roof.',
      'Rebalanced my portfolio into allocated gold and silver during lunch.',
    ],
    middles: [''],
    closers: [
      'The ultimate hard-asset vault.',
      '',
    ],
  },
]

function pickRandom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]
}

function shuffleArray<T>(arr: T[], rand: () => number): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function synthesizeXPost(archetype: PostArchetype, rand: () => number): string {
  const opener = pickRandom(archetype.openers, rand)
  const middle = pickRandom(archetype.middles, rand)
  const closer = pickRandom(archetype.closers, rand)
  return [opener, middle, closer].filter(Boolean).join(' ')
}

function generateIntelligentFeedbackColumns(seedFn: () => number): FeedbackItemType[][] {
  const maleAvatars = shuffleArray(MALE_AVATARS, seedFn)
  const femaleAvatars = shuffleArray(FEMALE_AVATARS, seedFn)
  const maleFirsts = shuffleArray(MALE_FIRST_NAMES, seedFn)
  const femaleFirsts = shuffleArray(FEMALE_FIRST_NAMES, seedFn)
  const lastNames = shuffleArray(LAST_NAMES, seedFn)
  const roles = shuffleArray(ROLES, seedFn)
  const archetypes = shuffleArray(X_POST_ARCHETYPES, seedFn)

  let maleIdx = 0
  let femaleIdx = 0

  const items: FeedbackItemType[] = archetypes.slice(0, 9).map((archetype, idx) => {
    // Alternate and randomize gender while strictly pairing female avatars with female names and male avatars with male names
    const isFemale = idx % 2 === 0 ? seedFn() > 0.35 : seedFn() > 0.65
    const avatar = isFemale ? femaleAvatars[femaleIdx % femaleAvatars.length] : maleAvatars[maleIdx % maleAvatars.length]
    const firstName = isFemale ? femaleFirsts[femaleIdx % femaleFirsts.length] : maleFirsts[maleIdx % maleFirsts.length]

    if (isFemale) {
      femaleIdx++
    } else {
      maleIdx++
    }

    const showLastName = seedFn() > 0.15
    const fullName = showLastName ? `${firstName} ${lastNames[idx % lastNames.length]}` : firstName

    return {
      quote: synthesizeXPost(archetype, seedFn),
      avatar,
      name: fullName,
      role: roles[idx % roles.length].trim(),
    }
  })

  return [items.slice(0, 3), items.slice(3, 6), items.slice(6, 9)]
}

// Deterministic initial SSR state so hydration never mismatches, immediately refreshed with true randomness on mount
function createSeededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const INITIAL_COLUMNS: FeedbackItemType[][] = generateIntelligentFeedbackColumns(createSeededRandom(20261119))

const Feedback = () => {
  const [columns, setColumns] = useState<FeedbackItemType[][]>(INITIAL_COLUMNS)

  useEffect(() => {
    setColumns(generateIntelligentFeedbackColumns(Math.random))
  }, [])

  return (
    <section className="relative overflow-hidden py-20 lg:py-40">
      <div className="container">
        <div className="relative overflow-hidden lg:max-h-180">
          <div className="grid grid-cols-2 gap-3.5 md:gap-5 lg:grid-cols-3 lg:gap-7.5">
            {columns.map((column, colIdx) => (
              <div key={colIdx} className="space-y-3.5 md:space-y-5 lg:space-y-7.5">
                {column.map((item, itemIdx) => (
                  <div key={`${colIdx}-${itemIdx}-${item.name}`} className="bg-default-200 flex flex-col justify-between rounded-2xl p-2.5 md:p-7.5">
                    <p className="text-default-800 mb-3.5 text-sm leading-snug font-medium md:mb-7.5 md:text-lg">{item.quote}</p>
                    <div className="flex items-center justify-between">
                      <div className="items-center gap-2.5 md:flex">
                        <Image src={item.avatar} className="size-7.5 rounded-full object-cover md:size-12" alt={item.name} />
                        <div className="mt-1.25 md:mt-0">
                          <h3 className="text-default-900 text-sm leading-none font-medium md:text-lg">{item.name}</h3>
                          <p className="text-default-500 mt-1 text-xs md:text-sm">{item.role}</p>
                        </div>
                      </div>
                      <Link href="https://x.com" target="_blank" className="group inline-flex size-5.5 items-center justify-center overflow-hidden rounded-full bg-white md:size-10">
                        <span className="relative size-4 overflow-hidden">
                          <Icon icon="tabler:brand-x-filled" className="text-default-800 absolute inset-0 size-4 h-full w-full transition-transform duration-300 group-hover:-translate-y-[200%]" />
                          <Icon icon="tabler:brand-x-filled" className="text-default-800 absolute inset-0 size-4 h-full w-full translate-y-[200%] transition-transform duration-300 group-hover:translate-y-0" />
                        </span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Feedback
