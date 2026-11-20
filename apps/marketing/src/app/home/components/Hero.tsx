'use client'

import heroImage from '@/assets/images/correnthian-hero-gradient-bg.jpg'
import vector01 from '@/assets/images/vector-01.webp'
import dashboardMain from '@/assets/images/workspace/correnthian-hero-phone.png'
import { Icon } from '@iconify/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import lightGallery from 'lightgallery'
import lgVideo from 'lightgallery/plugins/video'
import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useRef } from 'react'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

const Hero = () => {
  const sectionRef = useRef<HTMLElement>(null)
  const pinContainerRef = useRef<HTMLDivElement>(null)
  const textGroupRef = useRef<HTMLDivElement>(null)
  const phoneStageRef = useRef<HTMLDivElement>(null)
  const phoneWrapperRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const chipLeftRef = useRef<HTMLDivElement>(null)
  const chipRightRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLDivElement>(null)

  // Interactive mouse tilt on desktop
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!phoneWrapperRef.current || window.innerWidth < 1024) return
    const rect = sectionRef.current?.getBoundingClientRect()
    if (!rect) return
    const xRatio = (e.clientX - rect.left) / rect.width - 0.5
    const yRatio = (e.clientY - rect.top) / rect.height - 0.5

    gsap.to(phoneWrapperRef.current, {
      rotateY: xRatio * 16,
      rotateX: -yRatio * 12,
      duration: 0.6,
      ease: 'power2.out',
      overwrite: 'auto',
    })
  }

  const handleMouseLeave = () => {
    if (!phoneWrapperRef.current) return
    gsap.to(phoneWrapperRef.current, {
      rotateY: 0,
      duration: 0.9,
      ease: 'power3.out',
      overwrite: 'auto',
    })
  }

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

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const mm = gsap.matchMedia()

    mm.add('(min-width: 768px)', () => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=110%',
          scrub: 1.2,
          pin: pinContainerRef.current,
          anticipatePin: 1,
        },
      })

      // 1. Text elements fade and ascend slightly to give full focus to dashboard
      tl.to(
        textGroupRef.current,
        {
          opacity: 0,
          y: -70,
          scale: 0.94,
          filter: 'blur(10px)',
          ease: 'power2.inOut',
        },
        0
      )

      // 2. Phone smoothly tilts upright from dramatic 3D angle, rises and zooms into view
      tl.fromTo(
        phoneWrapperRef.current,
        {
          rotateX: 22,
          scale: 0.92,
          y: 40,
        },
        {
          rotateX: 0,
          scale: 1.18,
          y: -60,
          ease: 'power2.out',
        },
        0
      )

      // 3. Ambient luxury gold glow expands into a brilliant halo
      tl.fromTo(
        glowRef.current,
        {
          scale: 0.85,
          opacity: 0.35,
        },
        {
          scale: 1.55,
          opacity: 0.75,
          ease: 'power2.out',
        },
        0
      )

      // 4. Left floating bullion chip glides outward with 3D inertia
      tl.fromTo(
        chipLeftRef.current,
        {
          x: 40,
          y: 80,
          opacity: 0,
          scale: 0.8,
          rotate: -2,
        },
        {
          x: -120,
          y: -20,
          opacity: 1,
          scale: 1,
          rotate: -8,
          ease: 'power2.out',
        },
        0.05
      )

      // 5. Right floating custody chip glides outward with 3D inertia
      tl.fromTo(
        chipRightRef.current,
        {
          x: -40,
          y: 90,
          opacity: 0,
          scale: 0.8,
          rotate: 2,
        },
        {
          x: 120,
          y: 10,
          opacity: 1,
          scale: 1,
          rotate: 8,
          ease: 'power2.out',
        },
        0.08
      )
    })

    // Mobile fallback scroll trigger (scrub without pinning to maintain smooth touch scrolling)
    mm.add('(max-width: 767px)', () => {
      gsap.to(phoneWrapperRef.current, {
        scale: 1.08,
        y: -20,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
        },
      })
    })

    return () => mm.revert()
  }, [])

  return (
    <section ref={sectionRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className="relative min-h-screen overflow-hidden bg-black">
      <div ref={pinContainerRef} className="relative flex min-h-screen w-full flex-col items-center justify-between overflow-hidden pt-32 md:pt-40 lg:pt-44">
        {/* Background artwork */}
        <Image src={heroImage} alt="Hero Background" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center" priority />

        {/* Ambient top vignette */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />

        <div className="relative z-10 container mx-auto px-4" ref={videoRef}>
          <div className="flex flex-col items-center text-center">
            {/* Header Text Group (fades on scroll scrub) */}
            <div ref={textGroupRef} className="flex flex-col items-center will-change-transform">
              {/* Badge */}
              <div className="mb-4.5 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-black/60 px-4 py-1.5 backdrop-blur-xl shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                <span className="size-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-200">Correnthian Digital Vault • 1:1 Bullion Backed</span>
              </div>

              <h1 className="mb-5 text-4xl leading-tight font-medium tracking-tight text-white md:text-5xl lg:mb-7.5 lg:text-[88px]">
                Own gold that moves
                <br className="hidden lg:block" />
                at the speed of money
              </h1>

              <p className="mb-6 max-w-xl text-lg leading-normal text-white/85 md:text-xl lg:mb-10">Buy, hold and spend allocated physical gold and precious metals, safely stored in insured vaults and accessible directly from your phone.</p>

              <div className="flex items-center justify-center gap-3 md:gap-5">
                <Link
                  href="/waitlist"
                  className="group relative overflow-hidden rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 px-7 py-3.5 text-sm font-semibold text-black shadow-[0_0_30px_rgba(245,158,11,0.4)] transition-all duration-300 hover:scale-95 hover:shadow-[0_0_40px_rgba(245,158,11,0.6)] md:px-9 md:py-4 md:text-lg"
                >
                  <span className="relative block overflow-hidden">
                    <span className="block transition-transform duration-300 group-hover:-translate-y-full">Claim Your Vault</span>
                    <span className="absolute top-full left-0 block transition-transform duration-300 group-hover:-translate-y-full">Claim Your Vault</span>
                  </span>
                </Link>

                <a
                  href="https://www.youtube.com/embed/elgqxmdVms8?si=yYfzbunShGP15tde"
                  data-toggle="video"
                  className="group relative overflow-hidden rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-medium text-white backdrop-blur-xl transition-all duration-300 hover:scale-95 hover:border-amber-400/40 hover:bg-white/10 md:px-8.5 md:py-4 md:text-lg"
                >
                  <div className="relative flex items-center gap-3 overflow-hidden">
                    <div className="flex items-center gap-3 transition-transform duration-300 group-hover:-translate-y-full">
                      <Icon icon="tabler:player-play-filled" className="size-4 text-amber-400 md:size-6" />
                      <span>How it works</span>
                    </div>

                    <div className="absolute top-full left-0 flex items-center gap-3 transition-transform duration-300 group-hover:-translate-y-full">
                      <Icon icon="tabler:player-play-filled" className="size-4 text-amber-400 md:size-6" />
                      <span>How it works</span>
                    </div>
                  </div>
                </a>
              </div>
            </div>

            {/* 3D Dashboard Stage */}
            <div ref={phoneStageRef} style={{ perspective: 1400 }} className="relative mt-8 flex w-full justify-center md:mt-14 lg:mt-16">
              {/* Ambient luxury gold glow */}
              <div
                ref={glowRef}
                className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-[60%] w-[320px] -translate-y-1/2 rounded-full bg-gradient-to-tr from-amber-600/30 via-yellow-500/25 to-amber-400/20 blur-[90px] md:w-[460px] lg:w-[560px]"
              />

              {/* Left Floating Bullion Chip */}
              <div
                ref={chipLeftRef}
                className="pointer-events-none absolute top-12 left-1/2 z-30 hidden -translate-x-72 rounded-2xl border border-amber-500/30 bg-black/75 p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl md:block lg:-translate-x-96 xl:-translate-x-110"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-md">
                    <Icon icon="lucide:coins" className="size-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-amber-200">100g FINE GOLD 999.9</div>
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <span>$8,842.50</span>
                      <span className="inline-flex items-center text-xs font-semibold text-emerald-400">
                        <Icon icon="lucide:trending-up" className="mr-0.5 size-3" />
                        +1.85%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Floating Vault Title Chip */}
              <div
                ref={chipRightRef}
                className="pointer-events-none absolute top-24 left-1/2 z-30 hidden translate-x-36 rounded-2xl border border-emerald-500/30 bg-black/75 p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl md:block lg:translate-x-56 xl:translate-x-64"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-black shadow-md">
                    <Icon icon="lucide:shield-check" className="size-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-emerald-300">Allocated Bailment Title</div>
                    <div className="text-sm font-bold text-white">Brink's Zurich • Insured</div>
                  </div>
                </div>
              </div>

              {/* 3D Transformable Phone Mockup */}
              <div
                ref={phoneWrapperRef}
                style={{ transformStyle: 'preserve-3d' }}
                className="relative z-20 flex justify-center will-change-transform"
              >
                <Image
                  src={dashboardMain}
                  alt="Correnthian digital vault dashboard"
                  className="h-auto w-84 max-w-[90vw] filter drop-shadow-[0_30px_70px_rgba(0,0,0,0.9)] sm:w-92 md:w-96 lg:w-[440px] xl:w-[480px]"
                  priority
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom decorative curve transition */}
        <div className="relative z-20 mt-auto w-full">
          <div className="bg-body-bg h-14 w-full md:h-28 lg:h-36"></div>
          <Image src={vector01} alt="" className="pointer-events-none absolute top-auto -bottom-4 z-20 h-48 w-full object-cover md:h-80 lg:h-96" />
        </div>
      </div>
    </section>
  )
}

export default Hero
