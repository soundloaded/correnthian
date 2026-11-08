'use client'

import { preline } from '@/utils/preline'
import React, { useEffect } from 'react'
import Footer from '../footer/Footer'
import Navbar from '../navbar/Navbar'
import MotionEnhancer from './MotionEnhancer'

const AppProvidersWrapper = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    preline.init()
  }, [])

  return (
    <>
      <MotionEnhancer />
      <Navbar />
      {children}
      <Footer />
    </>
  )
}

export default AppProvidersWrapper
