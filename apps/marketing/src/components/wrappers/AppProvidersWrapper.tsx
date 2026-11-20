'use client'

import { preline } from '@/utils/preline'
import React, { useEffect } from 'react'
import Footer from '../footer/Footer'
import Navbar from '../navbar/Navbar'
import SmoothScroll from './SmoothScroll'

const AppProvidersWrapper = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    preline.init()
  }, [])

  return (
    <SmoothScroll>
      <Navbar />
      {children}
      <Footer />
    </SmoothScroll>
  )
}

export default AppProvidersWrapper
