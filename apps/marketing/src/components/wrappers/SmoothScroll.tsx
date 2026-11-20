'use client'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { motion, useScroll, useSpring } from 'motion/react'
import { useEffect, useRef } from 'react'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null)
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.9,
    })
    lenisRef.current = lenis

    lenis.on('scroll', ScrollTrigger.update)

    const tickerCb = (time: number) => {
      lenis.raf(time * 1000)
    }

    gsap.ticker.add(tickerCb)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tickerCb)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  return (
    <>
      {/* Luxury gold scroll progress line */}
      <motion.div
        style={{ scaleX }}
        className="pointer-events-none fixed top-0 right-0 left-0 z-[100] h-[2.5px] origin-left bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-600 shadow-[0_0_12px_rgba(245,158,11,0.6)]"
      />
      {children}
    </>
  )
}
