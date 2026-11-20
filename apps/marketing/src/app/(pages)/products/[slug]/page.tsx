import ProductView from '../ProductView'
import { findProduct, productPages } from '../content'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

type PageProps = {
  params: Promise<{ slug: string }>
}

export const dynamicParams = false

const dedicatedPages = new Set(['buy', 'swap', 'portfolio', 'activity', 'app', 'gold', 'silver', 'redemption'])

export function generateStaticParams() {
  return productPages.filter((page) => !dedicatedPages.has(page.slug)).map((page) => ({ slug: page.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const page = findProduct(slug)
  if (!page) return { title: 'Products' }
  return { title: page.title, description: page.description }
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params
  const page = findProduct(slug)
  if (!page) notFound()
  return <ProductView page={page} />
}
