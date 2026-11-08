'use client'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { motion, useScroll, useSpring } from 'motion/react'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

export default function MotionEnhancer() {
  const pathname = usePathname()
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 28,
    restDelta: 0.001,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const timer = setTimeout(() => {
      const ctx = gsap.context(() => {
        // 1. Headings & section intro reveals across every section
        const headings = gsap.utils.toArray<HTMLElement>(
          'section h1, section h2, section h3'
        )
        headings.forEach((heading) => {
          if (heading.dataset.gsapBound) return
          heading.dataset.gsapBound = 'true'
          gsap.fromTo(
            heading,
            {
              opacity: 0,
              y: 36,
              filter: 'blur(6px)',
            },
            {
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              duration: 0.85,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: heading,
                start: 'top 88%',
                toggleActions: 'play none none none',
              },
            }
          )
        })

        // 2. Section paragraphs and badge pills
        const copyBlocks = gsap.utils.toArray<HTMLElement>(
          'section p, section .inline-flex.rounded-full, section span.rounded-full.border'
        )
        copyBlocks.forEach((el) => {
          if (el.dataset.gsapBound || el.closest('.animate-marquee, .animate-marquee-left, .animate-marquee-right')) {
            return
          }
          el.dataset.gsapBound = 'true'
          gsap.fromTo(
            el,
            { opacity: 0, y: 22 },
            {
              opacity: 1,
              y: 0,
              duration: 0.7,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: el,
                start: 'top 90%',
                toggleActions: 'play none none none',
              },
            }
          )
        })

        // 3. Staggered Bento / Feature / Feedback / Pricing / FAQ cards
        const sections = gsap.utils.toArray<HTMLElement>('section')
        sections.forEach((sec) => {
          const cards = sec.querySelectorAll<HTMLElement>(
            '.rounded-3xl, .rounded-2xl, .hs-accordion'
          )
          const filtered = Array.from(cards).filter(
            (c) =>
              !c.dataset.gsapCardBound &&
              !c.closest('.animate-marquee, .animate-marquee-left, .animate-marquee-right')
          )
          if (filtered.length > 0) {
            filtered.forEach((c) => {
              c.dataset.gsapCardBound = 'true'
            })
            gsap.fromTo(
              filtered,
              {
                opacity: 0,
                y: 44,
                scale: 0.97,
              },
              {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 0.8,
                stagger: 0.1,
                ease: 'power3.out',
                scrollTrigger: {
                  trigger: filtered[0],
                  start: 'top 86%',
                  toggleActions: 'play none none none',
                },
              }
            )
          }
        })

        // 4. GSAP Scrubbed Parallax on floating clouds, mockups, and decorative layers
        const parallaxImages = gsap.utils.toArray<HTMLElement>(
          '[data-gsap-parallax]'
        )
        parallaxImages.forEach((img) => {
          const speed = Number(img.dataset.gsapParallax || '45')
          gsap.fromTo(
            img,
            { y: speed },
            {
              y: -speed,
              ease: 'none',
              scrollTrigger: {
                trigger: img.closest('section') || img,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 1.1,
              },
            }
          )
        })

        // 5. Animated number counters on [data-gsap-counter]
        const counters = gsap.utils.toArray<HTMLElement>('[data-gsap-counter]')
        counters.forEach((el) => {
          if (el.dataset.counterPlayed) return
          const target = Number(el.dataset.gsapCounter || '0')
          const formatComma = el.dataset.gsapComma === 'true'
          const suffix = el.dataset.gsapSuffix || ''
          const obj = { val: 0 }

          ScrollTrigger.create({
            trigger: el,
            start: 'top 88%',
            once: true,
            onEnter: () => {
              el.dataset.counterPlayed = 'true'
              gsap.to(obj, {
                val: target,
                duration: 1.8,
                ease: 'power3.out',
                onUpdate: () => {
                  const rounded = Math.round(obj.val)
                  el.textContent =
                    (formatComma ? rounded.toLocaleString() : String(rounded)) +
                    suffix
                },
              })
            },
          })
        })

        ScrollTrigger.refresh()
      })

      return () => ctx.revert()
    }, 120)

    return () => clearTimeout(timer)
  }, [pathname])

  return (
    <motion.div
      style={{ scaleX }}
      className="from-primary-1 via-primary-6 to-primary fixed top-0 right-0 left-0 z-[100] h-1 origin-left bg-gradient-to-r"
    />
  )
}
