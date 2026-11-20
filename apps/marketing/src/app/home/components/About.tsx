'use client'

import { Icon } from '@iconify/react'
import Image, { StaticImageData } from 'next/image'
import Link from 'next/link'
import { Fragment } from 'react'

import cryptoBitcoin from '@/assets/images/about/crypto-bitcoin.webp'
import metalGold from '@/assets/images/about/metal-gold.webp'
import metalSilver from '@/assets/images/about/metal-silver.webp'
import vaultSecure from '@/assets/images/about/vault-secure.webp'
import tileGoldBars from '@/assets/images/about/vault-gold-01.webp'
import tileGoldBar from '@/assets/images/about/vault-gold-02.webp'
import tileSilverStack from '@/assets/images/about/metal-silver-01.webp'
import tileSilverCoins from '@/assets/images/about/metal-silver-02.webp'
import tileVaultDoor from '@/assets/images/about/vault-secure-01.webp'
import tileVaultAudit from '@/assets/images/about/vault-secure-02.webp'
import tileBtcCoin from '@/assets/images/about/crypto-bitcoin-01.webp'
import tileBtcApp from '@/assets/images/about/crypto-bitcoin-02.webp'
import vaultPhone from '@/assets/images/about/correnthian-main-dashboard.png'
import appStoreLightIcon from '@/assets/images/icons/app-store-light.svg'
import playStoreIcon from '@/assets/images/icons/play-store.svg'
import cloud01 from '@/assets/images/locations/cloud-01.webp'
import cloud02 from '@/assets/images/locations/cloud-02.webp'
import cloud04 from '@/assets/images/locations/cloud-04.webp'

export type AboutImage = {
  image: StaticImageData
  animationClass: string
  alt: string
}

export type MarqueeItem = {
  bgColorClass: string
  icon: string
  iconClass: string
  label: string
  image: StaticImageData
}

const aboutImages: AboutImage[] = [
  { image: metalGold, animationClass: 'animate-imageSwap', alt: 'Stacked gold bars in a private vault' },
  { image: metalSilver, animationClass: 'animate-imageSwap2', alt: 'Silver bars and coins' },
  { image: cryptoBitcoin, animationClass: 'animate-imageSwap3', alt: 'Bitcoin alongside a live price chart' },
  { image: vaultSecure, animationClass: 'animate-imageSwap4', alt: 'Secured gold vault' },
]

const hashtags: string[] = ['#AllocatedBullion', '#SelfCustody', '#GoldBacked', '#BrinksVaulted']

const marqueeItems: MarqueeItem[] = [
  { bgColorClass: 'bg-amber-400', icon: 'lucide:coins', iconClass: 'text-amber-950', label: 'Allocated gold bars', image: tileGoldBars },
  { bgColorClass: 'bg-yellow-500', icon: 'tabler:coin-filled', iconClass: 'text-yellow-950', label: '1kg investment bars', image: tileGoldBar },
  { bgColorClass: 'bg-slate-300', icon: 'lucide:coins', iconClass: 'text-slate-800', label: 'Silver stacks', image: tileSilverStack },
  { bgColorClass: 'bg-slate-200', icon: 'lucide:circle-dollar-sign', iconClass: 'text-slate-700', label: 'Silver coins', image: tileSilverCoins },
  { bgColorClass: 'bg-zinc-900', icon: 'lucide:vault', iconClass: 'text-amber-300', label: "Brink's vaulted", image: tileVaultDoor },
  { bgColorClass: 'bg-emerald-600', icon: 'lucide:shield-check', iconClass: 'text-white', label: 'Audited custody', image: tileVaultAudit },
  { bgColorClass: 'bg-orange-500', icon: 'lucide:bitcoin', iconClass: 'text-white', label: 'Bitcoin ready', image: tileBtcCoin },
  { bgColorClass: 'bg-indigo-600', icon: 'lucide:wallet', iconClass: 'text-white', label: 'Metals + crypto', image: tileBtcApp },
]

const About = () => {
  return (
    <section className="relative pb-20 text-center lg:pt-6 lg:pb-50">
      <div className="container">
        <div className="md:mb-15">
          <h2 className="mx-auto mb-10 max-w-5xl text-center text-3xl leading-tight font-medium tracking-tight text-black md:text-5xl">
            Real{' '}
            <span className="relative inline-flex h-6.5 w-12.5 overflow-hidden rounded-full align-middle md:h-11 md:w-22.5">
              {aboutImages.map((img, idx) => (
                <Image key={idx} src={img.image} alt={img.alt} className={`absolute inset-0 h-full w-full object-cover ${img.animationClass}`} />
              ))}
            </span>{' '}
            wealth you actually own
            <br className="hidden lg:block" />
            allocated bullion & digital assets,&nbsp;
            <span className="mx-1 inline-flex size-7.5 items-center justify-center rounded-full bg-amber-400/15 align-middle md:size-15">
              <Icon icon="lucide:coins" className="size-4 text-amber-500 md:size-8" />
            </span>{' '}
            secured for life.
          </h2>

          <p className="text-default-500 mb-3.5 text-base font-medium md:text-xl lg:text-2xl">Physical gold, silver and crypto in one self-custodial vault — fully allocated, fully yours.</p>

          <div className="flex flex-wrap justify-center gap-3.5">
            {hashtags.map((tag, idx) => (
              <span key={idx} className="bg-default-200 text-default-800 rounded-full px-3.5 py-2 text-sm font-semibold">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="relative flex w-full flex-col items-center overflow-hidden py-12 md:py-24">
          <div className="bg-body-bg pointer-events-none absolute inset-y-0 -left-20 z-20 hidden w-37.5 blur-[20px] md:block"></div>
          <div className="bg-body-bg pointer-events-none absolute inset-y-0 -right-20 z-20 hidden w-37.5 blur-[30px] md:block"></div>

          <div className="mt-10 overflow-hidden py-6 md:mt-20">
            <div className="animate-marquee-left flex w-max gap-5">
              <div className="flex items-center gap-5">
                {marqueeItems.map((item, idx) => (
                  <Fragment key={idx}>
                    <div className="inline-flex size-32.5 flex-col items-center justify-center gap-5 rounded-3xl bg-white p-5 shadow-xl md:size-37.5">
                      <div className={`flex size-7.5 shrink-0 items-center justify-center rounded-full md:size-12.5 ${item.bgColorClass}`}>
                        <Icon icon={item.icon} className={`size-3.5 md:size-6 ${item.iconClass}`} />
                      </div>
                      <span className="text-default-800 text-center text-sm font-medium md:text-base">{item.label}</span>
                    </div>
                    <Image src={item.image} alt={item.label} className="size-32.5 rounded-3xl object-cover shadow-lg md:size-37.5" />
                  </Fragment>
                ))}
              </div>

              <div className="flex items-center gap-5">
                {marqueeItems.map((item, idx) => (
                  <Fragment key={idx}>
                    <div className="inline-flex size-32.5 flex-col items-center justify-center gap-5 rounded-3xl bg-white p-5 shadow-xl md:size-37.5">
                      <div className={`flex size-7.5 shrink-0 items-center justify-center rounded-full md:size-12.5 ${item.bgColorClass}`}>
                        <Icon icon={item.icon} className={`size-3.5 md:size-6 ${item.iconClass}`} />
                      </div>
                      <span className="text-default-800 text-center text-sm font-medium md:text-base">{item.label}</span>
                    </div>
                    <Image src={item.image} alt={item.label} className="size-32.5 rounded-3xl object-cover shadow-lg md:size-37.5" />
                  </Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-hidden pb-6 md:mb-20">
            <div className="animate-marquee-right flex w-max gap-5">
              <div className="flex items-center gap-5">
                {marqueeItems.map((item, idx) => (
                  <Fragment key={idx}>
                    <div className="inline-flex size-32.5 flex-col items-center justify-center gap-5 rounded-3xl bg-white p-5 shadow-xl md:size-37.5">
                      <div className={`flex size-7.5 shrink-0 items-center justify-center rounded-full md:size-12.5 ${item.bgColorClass}`}>
                        <Icon icon={item.icon} className={`size-3.5 md:size-6 ${item.iconClass}`} />
                      </div>
                      <span className="text-default-800 text-center text-sm font-medium md:text-base">{item.label}</span>
                    </div>
                    <Image src={item.image} alt={item.label} className="size-32.5 rounded-3xl object-cover shadow-lg md:size-37.5" />
                  </Fragment>
                ))}
              </div>

              <div className="flex items-center gap-5">
                {marqueeItems.map((item, idx) => (
                  <Fragment key={idx}>
                    <div className="inline-flex size-32.5 flex-col items-center justify-center gap-5 rounded-3xl bg-white p-5 shadow-xl md:size-37.5">
                      <div className={`flex size-7.5 shrink-0 items-center justify-center rounded-full md:size-12.5 ${item.bgColorClass}`}>
                        <Icon icon={item.icon} className={`size-3.5 md:size-6 ${item.iconClass}`} />
                      </div>
                      <span className="text-default-800 text-center text-sm font-medium md:text-base">{item.label}</span>
                    </div>
                    <Image src={item.image} alt={item.label} className="size-32.5 rounded-3xl object-cover shadow-lg md:size-37.5" />
                  </Fragment>
                ))}
              </div>
            </div>
          </div>

          <div data-gsap-parallax="-32" className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            {/* Ambient gold glow */}
            <div className="pointer-events-none absolute h-[65%] w-72 rounded-full bg-amber-500/15 blur-[70px] md:w-84" />
            <Image
              src={vaultPhone}
              className="relative z-10 h-auto w-48 filter drop-shadow-[0_25px_60px_rgba(0,0,0,0.85)] sm:w-56 md:w-76 lg:w-84"
              alt="Correnthian Digital Vault main dashboard"
              priority
            />
          </div>
        </div>

        <div className="mx-auto mt-4 flex flex-col items-center gap-y-5 px-6 md:mt-12">
          <div className="border-default-200 flex items-center gap-2 rounded-full border bg-white px-2.5 py-2 md:px-5">
            <Icon icon="tabler:star-filled" className="text-primary-1 size-3.5" />
            <p className="text-default-500 text-sm font-medium">
              <span className="font-medium text-black">Fully allocated</span> (audited vault custody)
            </p>
          </div>

          <p className="text-default-700 mb-2.5 w-xs text-base leading-normal md:w-xl md:text-lg">Physical bullion and digital assets in one vault. Buy, hold and sell — securely stored and always in your name.</p>

          <div className="flex w-full flex-col justify-center gap-5 md:flex-row">
            <Link href="/waitlist" className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-black px-8.5 text-white shadow-xl! transition-all duration-300 hover:scale-95">
              <div className="relative inline-flex flex-col items-center transition-transform duration-300 group-hover:-translate-y-full">
                <div className="flex h-14 items-center gap-3">
                  <Image src={appStoreLightIcon} className="h-5 w-5" alt="" />
                  <span className="font-normal">Claim your vault</span>
                </div>
                <div className="absolute top-full flex h-14 items-center gap-3">
                  <Image src={appStoreLightIcon} className="h-5 w-5" alt="" />
                  <span className="font-normal">Claim your vault</span>
                </div>
              </div>
            </Link>

            <Link href="/products/buy" className="group bg-default-200 relative inline-flex items-center justify-center overflow-hidden rounded-full px-8.5 text-black transition-all duration-300 hover:scale-95">
              <div className="relative flex flex-col items-center transition-transform duration-300 group-hover:-translate-y-full">
                <div className="flex h-14 items-center gap-2.5">
                  <Image src={playStoreIcon} className="h-5 w-5" alt="" />
                  <span className="font-normal">Explore gold products</span>
                </div>
                <div className="absolute top-full flex h-14 items-center gap-2.5">
                  <Image src={playStoreIcon} className="h-5 w-5" alt="" />
                  <span className="font-normal">Explore gold products</span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      <div className="relative hidden lg:block">
        <Image data-gsap-parallax="-20" src={cloud04} loading="lazy" alt="Decoration Image" className="absolute inset-s-0 inset-e-0 -bottom-100 -z-5 h-148 w-full object-cover" />
        <Image data-gsap-parallax="-35" src={cloud02} loading="lazy" alt="Decoration Image" className="absolute inset-e-0 -bottom-38 -z-5 h-75" />
        <Image data-gsap-parallax="-25" src={cloud01} loading="lazy" alt="Decoration Image" className="absolute inset-s-0 -bottom-48 -z-5 h-75" />
      </div>
    </section>
  )
}

export default About
