'use client'

import heroImage from '@/assets/images/hero-image.jpg'
import vector01 from '@/assets/images/vector-01.webp'
import dashboard01 from '@/assets/images/workspace/dashboard-01.svg'
import dashboard02 from '@/assets/images/workspace/dashboard-02.svg'
import dashboard03 from '@/assets/images/workspace/dashboard-03.svg'
import { Icon } from '@iconify/react'
import lightGallery from 'lightgallery'
import lgVideo from 'lightgallery/plugins/video'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useRef } from 'react'

const Hero = () => {
  const videoRef = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const floatXLeft = useSpring(useTransform(mouseX, [-0.5, 0.5], [-18, 18]), { stiffness: 120, damping: 20 })
  const floatYLeft = useSpring(useTransform(mouseY, [-0.5, 0.5], [-14, 14]), { stiffness: 120, damping: 20 })
  const floatXRight = useSpring(useTransform(mouseX, [-0.5, 0.5], [20, -20]), { stiffness: 120, damping: 20 })
  const floatYRight = useSpring(useTransform(mouseY, [-0.5, 0.5], [16, -16]), { stiffness: 120, damping: 20 })
  const centerRotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [6, -6]), { stiffness: 140, damping: 22 })
  const centerRotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), { stiffness: 140, damping: 22 })

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5)
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  const handleMouseLeave = () => {
    mouseX.set(0)
    mouseY.set(0)
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

  return (
    <section
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black pt-34 md:pt-40 lg:pt-52"
    >
      <Image src={heroImage} alt="Hero Background" className="absolute inset-0 h-full w-full object-cover object-center" />

      <div className="relative z-10 container mx-auto px-4" ref={videoRef}>
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="mb-4.5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 p-1.5 pe-2 backdrop-blur-md lg:w-70"
          >
            <span className="rounded-full bg-black px-2 py-px text-base font-medium text-white">New</span>
            <span className="text-sm text-white">A calmer way to build habits</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mb-5 text-4xl leading-tight font-medium tracking-tight text-white md:text-5xl lg:mb-7.5 lg:text-[90px]"
          >
            Build habits that&nbsp;
            <br className="hidden lg:block" />
            actually stick
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 max-w-sm text-lg leading-normal text-white md:text-xl lg:mb-10"
          >
            You see the right habits at the right time, so your day never feels crowded.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-center gap-2 md:gap-5"
          >
            <Link href="/contact" className="group relative overflow-hidden rounded-full bg-white px-3.5 py-3 text-sm font-medium text-black transition-all duration-300 hover:scale-95 md:px-8.5 md:py-4 md:text-lg">
              <span className="relative block overflow-hidden">
                <span className="block transition-transform duration-300 group-hover:-translate-y-full">Start Tracking Free</span>
                <span className="absolute top-full left-0 block transition-transform duration-300 group-hover:-translate-y-full">Start Tracking Free</span>
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
                  <span className="font-medium">Watch Demo</span>
                </div>

                <div className="absolute top-full left-0 flex items-center gap-3 transition-transform duration-300 group-hover:-translate-y-full">
                  <Icon icon="tabler:player-play-filled" className="size-4 text-white md:size-6" />
                  <span className="font-medium">Watch Demo</span>
                </div>
              </div>
            </a>
          </motion.div>

          <div
            style={{ perspective: 1200 }}
            className="relative mt-6 flex w-full max-w-5xl items-start justify-center gap-8 md:mt-16 md:gap-5 lg:mt-20 lg:gap-10"
          >
            <motion.div
              style={{ x: floatXLeft, y: floatYLeft }}
              initial={{ opacity: 0, x: -40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.85, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
              data-gsap-parallax="-35"
              className="absolute inset-s-0 top-8 z-20 md:inset-s-6 lg:inset-s-32"
            >
              <Image src={dashboard01} alt="Dashboard" className="size-35 lg:size-40" />
            </motion.div>

            <motion.div
              style={{ rotateX: centerRotateX, rotateY: centerRotateY }}
              initial={{ opacity: 0, y: 48, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
              data-gsap-parallax="22"
              className="relative -z-20!"
            >
              <Image src={dashboard03} alt="Dashboard" className="mt-34 h-144 w-75 md:mt-0 lg:w-90" />
            </motion.div>

            <motion.div
              style={{ x: floatXRight, y: floatYRight }}
              initial={{ opacity: 0, x: 40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.85, delay: 0.52, ease: [0.16, 1, 0.3, 1] }}
              data-gsap-parallax="-42"
              className="absolute inset-e-0 top-8 z-20 md:bottom-60 lg:inset-e-14"
            >
              <Image src={dashboard02} alt="Dashboard" className="w-50 lg:w-60" />
            </motion.div>
          </div>
        </div>
      </div>

      <div className="bg-body-bg absolute bottom-0 z-20 h-18 w-full md:h-40"></div>
      <Image src={vector01} alt="" className="absolute top-auto -bottom-7.5 z-20 h-70 w-full md:h-100 lg:h-110" />
    </section>
  )
}

export default Hero
