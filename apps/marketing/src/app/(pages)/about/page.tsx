import type { Metadata } from 'next'
import About from './About'

export const metadata: Metadata = {
  title: 'About',
  description: 'Correnthian registers third-party tokenized gold and silver. It does not issue the tokens, hold the keys, hold the fiat, or custody the metal.',
}

export default function Page() {
  return <About />
}
