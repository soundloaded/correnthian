'use client'

import heroImage from '@/assets/images/correnthian-hero-gradient-bg.jpg'
import vector01 from '@/assets/images/vector-01.webp'
import dashboardMain from '@/assets/images/workspace/correnthian-hero-phone.png'
import { Icon } from '@iconify/react'
import lightGallery from 'lightgallery'
import lgVideo from 'lightgallery/plugins/video'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef } from 'react'

const Hero = () => {
  const videoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let lgInstance: any
    if (videoRef.current) {
      lgInstance = lightGallery(videoRef.current, {
        selector: '[data-toggle="video"]',
        plugins: [lgVideo],
        download: false,
        youTubePlayerParams: {
          modestbranding: 1,
          showinfo: 0,
          rel: 0,
        },
      })
    }
    return () => {
      if (lgInstance) {
        lgInstance.destroy()
      }
    }
  }, [])

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black pt-34 md:pt-40 lg:pt-52">
      <Image src={heroImage} alt="Hero Background" className="absolute inset-0 h-full w-full object-cover object-center" priority />

      <div className="relative z-10 container mx-auto px-4" ref={videoRef}>
        <div className="flex flex-col items-center text-center">
          <h1 className="mb-5 text-4xl leading-tight font-medium tracking-tight text-white md:text-5xl lg:mb-7.5 lg:text-[90px]">
            Own gold that moves
            <br className="hidden lg:block" />
            at the speed of money
          </h1>

          <p className="mb-6 max-w-sm text-lg leading-normal text-white md:text-xl lg:mb-10">Buy, hold and sell physical gold and other precious metals, securely stored and accessible through your online account.</p>

          <div className="flex items-center justify-center gap-2 md:gap-5">
            <Link href="/waitlist" className="group relative overflow-hidden rounded-full bg-white px-3.5 py-3 text-sm font-medium text-black transition-all duration-300 hover:scale-95 md:px-8.5 md:py-4 md:text-lg">
              <span className="relative block overflow-hidden">
                <span className="block transition-transform duration-300 group-hover:-translate-y-full">Register</span>
                <span className="absolute top-full left-0 block transition-transform duration-300 group-hover:-translate-y-full">Register</span>
              </span>
            </Link>

            <a
              href="https://www.youtube.com/embed/elgqxmdVms8?si=yYfzbunShGP15tde"
              data-toggle="video"
              className="group relative overflow-hidden rounded-full border border-white/20 bg-white/5 px-3.5 py-3 text-sm text-white backdrop-blur-md transition-all duration-300 hover:scale-95 hover:bg-white/10 md:px-8.5 md:py-4 md:text-lg"
            >
              <div className="relative flex items-center gap-3 overflow-hidden">
                <div className="flex items-center gap-3 transition-transform duration-300 group-hover:-translate-y-full">
                  <Icon icon="tabler:player-play-filled" className="size-4 text-white md:size-6" />
                  <span className="font-medium">How it works</span>
                </div>

                <div className="absolute top-full left-0 flex items-center gap-3 transition-transform duration-300 group-hover:-translate-y-full">
                  <Icon icon="tabler:player-play-filled" className="size-4 text-white md:size-6" />
                  <span className="font-medium">How it works</span>
                </div>
              </div>
            </a>
          </div>

          <div className="relative mt-6 flex justify-center md:mt-12 lg:mt-16">
            {/* Ambient luxury gold glow behind phone */}
            <div className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-[60%] w-[260px] -translate-y-1/2 rounded-full bg-amber-500/15 blur-[80px] sm:w-[320px] md:w-[400px] lg:w-[460px]" />
            <Image
              src={dashboardMain}
              alt="Correnthian digital vault dashboard"
              className="relative z-20! h-auto w-90 max-w-[90vw] filter drop-shadow-[0_25px_60px_rgba(0,0,0,0.85)] sm:w-96 md:w-93 lg:w-[420px] xl:w-[460px]"
              priority
            />
          </div>
        </div>
      </div>

      <div className="bg-body-bg absolute bottom-0 z-20 h-18 w-full md:h-40"></div>
      <Image src={vector01} alt="" className="absolute top-auto -bottom-7.5 z-20 h-70 w-full md:h-100 lg:h-110" />
    </section>
  )
}

export default Hero