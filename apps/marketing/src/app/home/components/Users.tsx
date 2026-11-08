import { Icon } from '@iconify/react'
import Image from 'next/image'

import social01 from '@/assets/images/about/social-image-01.webp'
import social02 from '@/assets/images/about/social-image-02.webp'
import social03 from '@/assets/images/about/social-image-03.webp'
import social04 from '@/assets/images/about/social-image-04.webp'
import social05 from '@/assets/images/about/social-image-05.webp'
import social06 from '@/assets/images/about/social-image-06.webp'
import avatar01 from '@/assets/images/team/avatar-01.webp'
import avatar02 from '@/assets/images/team/avatar-02.webp'
import avatar03 from '@/assets/images/team/avatar-03.webp'

const Users = () => {
  return (
    <section className="py-25 lg:py-50" id="metrics">
      <div className="container">
        <div className="mb-8 flex flex-col items-end justify-between gap-4 md:mb-12.5 md:flex-row md:gap-8">
          <h2 className="text-default-900 text-3xl leading-tight font-medium tracking-tight md:w-lg md:text-4xl lg:text-5xl">Questions a holder should be able to ask</h2>

          <div className="flex flex-col items-start justify-start space-y-2.5 text-start md:items-end md:justify-end">
            <div className="flex items-center justify-start md:justify-end">
              <div className="flex -space-x-4">
                <Image className="border-default-800 h-10 w-10 rounded-full border-2 object-cover" src={avatar01} alt="User" />
                <Image className="border-default-800 h-10 w-10 rounded-full border-2 object-cover" src={avatar02} alt="User" />
                <Image className="border-default-800 h-10 w-10 rounded-full border-2 object-cover" src={avatar03} alt="User" />
                <div className="border-default-800 bg-default-900 flex h-10 w-10 items-center justify-center rounded-full border-2 text-[8px] font-medium text-white">You?</div>
              </div>
            </div>
            <div className="text-primary-1 flex gap-1.75">
              <Icon icon="tabler:star-filled" className="size-4" />
              <Icon icon="tabler:star-filled" className="size-4" />
              <Icon icon="tabler:star-filled" className="size-4" />
              <Icon icon="tabler:star-filled" className="size-4" />
              <Icon icon="tabler:star-filled" className="size-4" />
            </div>
            <div className="text-default-600 text-lg font-medium">No customer count yet</div>
          </div>
        </div>
      </div>

      <div className="relative flex gap-7.5 overflow-hidden">
        <div className="animate-marquee flex gap-7.5 py-4 whitespace-nowrap">
          <div className="group relative flex h-75 w-95 flex-col justify-between overflow-hidden rounded-2xl p-7.5 md:h-128">
            <Image src={social01} className="absolute inset-0 h-full w-full object-cover" alt="Student" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
            <div className="relative z-10">
              <p className="text-lg font-medium text-white">
                <span>What</span> <span className="text-sm font-medium opacity-50">— the metal</span>
              </p>
            </div>
            <div className="relative z-10">
              <p className="text-lg leading-tight font-medium whitespace-normal text-white">Name the metal and the unit before anyone calls it gold</p>
            </div>
          </div>

          <div className="group relative flex h-75 w-95 flex-col justify-between overflow-hidden rounded-2xl p-7.5 md:h-128">
            <Image src={social02} className="absolute inset-0 h-full w-full object-cover" alt="User" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
            <div className="relative z-10">
              <p className="text-lg font-medium text-white">
                Daniel Gray <span className="font-normal opacity-50">— Founder</span>
              </p>
            </div>
            <div className="relative z-10 text-white">
              <h3 className="mb-1 text-5xl font-black text-white">87%</h3>
              <p className="font-medium">Improved weekly consistency</p>
            </div>
          </div>

          <div className="group relative flex h-75 w-95 flex-col justify-between overflow-hidden rounded-2xl p-7.5 md:h-128">
            <Image src={social03} className="absolute inset-0 h-full w-full object-cover" alt="User" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
            <div className="relative z-10">
              <p className="text-lg font-medium text-white">
                Who backs it - <span className="font-normal opacity-50">the issuer</span>
              </p>
            </div>
            <div className="relative z-10 text-white">
              <p className="text-lg font-medium text-white">The issuer is named. Correnthian does not stand in for them.</p>
            </div>
          </div>

          <div className="group relative flex h-75 w-95 flex-col justify-between overflow-hidden rounded-2xl p-7.5 md:h-128">
            <Image src={social04} className="absolute inset-0 h-full w-full object-cover" alt="Parent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
            <div className="relative z-10">
              <p className="text-lg font-medium text-white">
                <span>Exit</span> <span className="text-sm font-medium opacity-50">— not open yet</span>
              </p>
            </div>
            <div className="relative z-10">
              <p className="text-lg leading-tight font-medium whitespace-normal text-white">The keys stay on the device. This site never receives them.</p>
            </div>
          </div>

          <div className="group relative flex h-75 w-95 flex-col justify-between overflow-hidden rounded-2xl p-7.5 md:h-128">
            <Image src={social05} className="absolute inset-0 h-full w-full object-cover" alt="Leo" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
            <div className="relative z-10">
              <p className="text-lg font-medium text-white">
                <span>Keys</span> <span className="text-sm font-medium opacity-50">— on your device</span>
              </p>
            </div>
            <div className="relative z-10">
              <h3 className="mb-1 text-4xl font-black text-white">0 keys</h3>
              <p className="font-medium text-white">Held by Correnthian</p>
            </div>
          </div>

          <div className="group relative flex h-75 w-95 flex-col justify-between overflow-hidden rounded-2xl p-7.5 md:h-128">
            <Image src={social06} className="absolute inset-0 h-full w-full object-cover" alt="Software Developer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
            <div className="relative z-10">
              <p className="text-lg font-medium text-white">
                <span>Fees</span> <span className="text-sm font-medium opacity-50">— three lines</span>
              </p>
            </div>
            <div className="relative z-10">
              <p className="text-lg leading-tight font-medium whitespace-normal text-white">Ask if it can leave. The answer today is not yet.</p>
            </div>
          </div>
        </div>

        <div className="animate-marquee flex gap-7.5 py-4 whitespace-nowrap">
          <div className="group relative flex h-75 w-95 flex-col justify-between overflow-hidden rounded-2xl p-7.5 md:h-128">
            <Image src={social01} className="absolute inset-0 h-full w-full object-cover" alt="Student" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
            <div className="relative z-10">
              <p className="text-lg font-medium text-white">
                <span>What</span> <span className="text-sm font-medium opacity-50">— the metal</span>
              </p>
            </div>
            <div className="relative z-10">
              <p className="text-lg leading-tight font-medium whitespace-normal text-white">Name the metal and the unit before anyone calls it gold</p>
            </div>
          </div>

          <div className="group relative flex h-75 w-95 flex-col justify-between overflow-hidden rounded-2xl p-7.5 md:h-128">
            <Image src={social02} className="absolute inset-0 h-full w-full object-cover" alt="User" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
            <div className="relative z-10">
              <p className="text-lg font-medium text-white">
                Daniel Gray <span className="font-normal opacity-50">— Founder</span>
              </p>
            </div>
            <div className="relative z-10 text-white">
              <h3 className="mb-1 text-5xl font-black text-white">87%</h3>
              <p className="font-medium">Improved weekly consistency</p>
            </div>
          </div>

          <div className="group relative flex h-75 w-95 flex-col justify-between overflow-hidden rounded-2xl p-7.5 md:h-128">
            <Image src={social03} className="absolute inset-0 h-full w-full object-cover" alt="User" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
            <div className="relative z-10">
              <p className="text-lg font-medium text-white">
                Who backs it - <span className="font-normal opacity-50">the issuer</span>
              </p>
            </div>
            <div className="relative z-10 text-white">
              <p className="text-lg font-medium text-white">The issuer is named. Correnthian does not stand in for them.</p>
            </div>
          </div>

          <div className="group relative flex h-75 w-95 flex-col justify-between overflow-hidden rounded-2xl p-7.5 md:h-128">
            <Image src={social04} className="absolute inset-0 h-full w-full object-cover" alt="Parent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
            <div className="relative z-10">
              <p className="text-lg font-medium text-white">
                <span>Exit</span> <span className="text-sm font-medium opacity-50">— not open yet</span>
              </p>
            </div>
            <div className="relative z-10">
              <p className="text-lg leading-tight font-medium whitespace-normal text-white">The keys stay on the device. This site never receives them.</p>
            </div>
          </div>

          <div className="group relative flex h-75 w-95 flex-col justify-between overflow-hidden rounded-2xl p-7.5 md:h-128">
            <Image src={social05} className="absolute inset-0 h-full w-full object-cover" alt="Leo" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
            <div className="relative z-10">
              <p className="text-lg font-medium text-white">
                <span>Keys</span> <span className="text-sm font-medium opacity-50">— on your device</span>
              </p>
            </div>
            <div className="relative z-10">
              <h3 className="mb-1 text-4xl font-black text-white">0 keys</h3>
              <p className="font-medium text-white">Held by Correnthian</p>
            </div>
          </div>

          <div className="group relative flex h-75 w-95 flex-col justify-between overflow-hidden rounded-2xl p-7.5 md:h-128">
            <Image src={social06} className="absolute inset-0 h-full w-full object-cover" alt="Software Developer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
            <div className="relative z-10">
              <p className="text-lg font-medium text-white">
                <span>Fees</span> <span className="text-sm font-medium opacity-50">— three lines</span>
              </p>
            </div>
            <div className="relative z-10">
              <p className="text-lg leading-tight font-medium whitespace-normal text-white">Ask if it can leave. The answer today is not yet.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Users
