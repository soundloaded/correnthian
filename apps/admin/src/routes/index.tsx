import { createFileRoute } from "@tanstack/react-router"

import { Hero } from "@/components/landing/hero"
import { Navbar } from "@/components/landing/navbar"
import { Product } from "@/components/landing/product"
import { Features } from "@/components/landing/features"
import { Testimonials } from "@/components/landing/testimonials"
import { Pricing } from "@/components/landing/pricing"
import { Faqs } from "@/components/landing/faqs"
import { Footer } from "@/components/landing/footer"


export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main>
        <Hero />
        <Product />
        <Features />
        <Testimonials />
        <Pricing />
        <Faqs />
      </main>
      <Footer />
    </div>
  )
}