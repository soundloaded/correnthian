import { Icon } from '@iconify/react'
import Image, { StaticImageData } from 'next/image'
import Link from 'next/link'

import avatar01 from '@/assets/images/team/avatar-01.webp'
import avatar02 from '@/assets/images/team/avatar-02.webp'
import avatar03 from '@/assets/images/team/avatar-03.webp'
import avatar04 from '@/assets/images/team/avatar-04.webp'
import avatar05 from '@/assets/images/team/avatar-05.webp'
import avatar06 from '@/assets/images/team/avatar-06.webp'
import avatar07 from '@/assets/images/team/avatar-07.webp'
import avatar08 from '@/assets/images/team/avatar-08.webp'
import avatar09 from '@/assets/images/team/avatar-09.webp'

export type FeedbackItemType = {
  quote: string
  avatar: StaticImageData
  name: string
  role: string
}

const feedbacksColumnsData: FeedbackItemType[][] = [
  [
    {
      quote: 'What is the metal, and in what unit?',
      avatar: avatar04,
      name: 'The metal',
      role: 'A question, not a customer',
    },
    {
      quote: 'Who issues the token, and who backs the bar?',
      avatar: avatar05,
      name: 'The issuer',
      role: 'A question, not a customer',
    },
    {
      quote: 'Can I move it, or take delivery? Not from this product today.',
      avatar: avatar06,
      name: 'The exit',
      role: 'A question, not a customer',
    },
  ],
  [
    {
      quote: 'Where does the private key stay? On the holder’s device.',
      avatar: avatar07,
      name: 'The keys',
      role: 'A question, not a customer',
    },
    {
      quote: 'What are the three fee lines, and why is there no rate yet?',
      avatar: avatar08,
      name: 'The fees',
      role: 'A question, not a customer',
    },
    {
      quote: 'Does Correnthian hold the gold? It does not.',
      avatar: avatar02,
      name: 'Custody',
      role: 'A question, not a customer',
    },
  ],
  [
    {
      quote: 'Can I buy with a card today? Not until a provider is contracted.',
      avatar: avatar09,
      name: 'Buying',
      role: 'A question, not a customer',
    },
    {
      quote: 'Is a passkey vault live? No. That is still planned.',
      avatar: avatar01,
      name: 'Access',
      role: 'A question, not a customer',
    },
    {
      quote: 'Is every chain readable today? No. A chain is listed only when it can actually be read.',
      avatar: avatar03,
      name: 'Chains',
      role: 'A question, not a customer',
    },
  ],
]

const Feedback = () => {
  return (
    <section className="relative overflow-hidden py-20 lg:py-40">
      <div className="container">
        <div className="relative overflow-hidden lg:max-h-180">
          <div className="grid grid-cols-2 gap-3.5 md:gap-5 lg:grid-cols-3 lg:gap-7.5">
            {feedbacksColumnsData.map((column, colIdx) => (
              <div key={colIdx} className="space-y-3.5 md:space-y-5 lg:space-y-7.5">
                {column.map((item, itemIdx) => (
                  <div key={itemIdx} className="bg-default-200 flex flex-col justify-between rounded-2xl p-2.5 md:p-7.5">
                    <p className="text-default-800 mb-3.5 text-sm leading-snug font-medium md:mb-7.5 md:text-lg">{item.quote}</p>
                    <div className="flex items-center justify-between">
                      <div className="items-center gap-2.5 md:flex">
                        <Image src={item.avatar} className="size-7.5 rounded-full object-cover md:size-12" alt={item.name} />
                        <div className="mt-1.25 md:mt-0">
                          <h3 className="text-default-900 text-sm leading-none font-medium md:text-lg">{item.name}</h3>
                          <p className="text-default-500 mt-1 text-xs md:text-sm">{item.role}</p>
                        </div>
                      </div>
                      <Link href="" target="_blank" className="group inline-flex size-5.5 items-center justify-center overflow-hidden rounded-full bg-white md:size-10">
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
