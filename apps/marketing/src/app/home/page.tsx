import { Metadata } from 'next'
import About from './components/About'
import Download from './components/Download'
import Faq from './components/Faq'
import Features from './components/Features'
import Feedback from './components/Feedback'
import Hero from './components/Hero'
import HowItWorks from './components/HowItWorks'
import PlatformFeatures from './components/PlatformFeatures'
import SilverYield from './components/SilverYield'
import Stats from './components/Stats'
import VaultStories from './components/VaultStories'

export const metadata: Metadata = {
  title: 'Home',
}

const Page = () => {
  return (
    <>
      <Hero />
      <About />
      <Features />
      <HowItWorks />
      <PlatformFeatures />
      <Stats />
      <SilverYield />
      <VaultStories />
      <Feedback />
      <Faq />
      <Download />
    </>
  )
}

export default Page
