import barsImage from '@/assets/images/workspace/correnthian-allocated-bars.png'
import dashboardImage from '@/assets/images/workspace/correnthian-allocated-dashboard.png'
import handImage from '@/assets/images/workspace/correnthian-download-hand.png'
import heroPhone from '@/assets/images/workspace/correnthian-hero-phone.png'
import portfolioPhone from '@/assets/images/workspace/correnthian-portfolio-phone.png'
import silverPhone from '@/assets/images/workspace/correnthian-silver-phone.png'
import vaultImage from '@/assets/images/about/vault-gold-01.webp'
import { findProduct, type ProductPage } from './content'
import Image, { type StaticImageData } from 'next/image'
import Link from 'next/link'

const images: Record<string, StaticImageData> = {
  buy: heroPhone,
  swap: dashboardImage,
  portfolio: portfolioPhone,
  activity: dashboardImage,
  app: handImage,
  gold: barsImage,
  silver: silverPhone,
  redemption: vaultImage,
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      <p className="text-default-500 mb-2 text-sm font-medium tracking-wide uppercase">{eyebrow}</p>
      <h2 className="text-default-900 text-3xl font-medium tracking-tight md:text-4xl">{title}</h2>
    </div>
  )
}

export default function ProductView({ page }: { page: ProductPage }) {
  const image = images[page.slug] ?? heroPhone
  const related = page.related.map((slug) => findProduct(slug)).filter((item): item is ProductPage => item != null)
  const columnClass = page.steps.length > 3 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'

  return (
    <>
      <section className="pt-34 pb-16 md:pt-42 md:pb-20 lg:pt-50">
        <div className="container">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-default-600 mb-3 text-sm font-medium">{page.eyebrow}</p>
              <h1 className="text-default-900 text-4xl font-medium tracking-tight md:text-5xl lg:text-6xl">{page.title}</h1>
              <p className="text-default-600 mt-5 max-w-xl text-base md:text-xl">{page.lede}</p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href="/waitlist" className="bg-default-900 inline-flex rounded-full px-8 py-3.5 text-sm font-medium text-white transition-all hover:scale-95">
                  Join the waitlist
                </Link>
                <Link href="/pricing" className="text-default-800 text-sm font-medium underline-offset-4 hover:underline">
                  How fees are shown
                </Link>
              </div>
            </div>
            <div className="flex flex-col items-center gap-5">
              <Image src={image} alt={page.title} className="h-auto max-h-[28rem] w-full max-w-md rounded-3xl object-contain" />
              <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-lg">
                <p className="text-default-900 text-sm font-medium">{page.panel.title}</p>
                <dl className="mt-4 space-y-3">
                  {page.panel.rows.map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                      <dt className="text-default-800 text-sm font-medium">{row.label}</dt>
                      <dd className="text-default-500 text-right text-sm">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-24">
        <div className="container">
          <SectionHeading eyebrow="How it works" title="The path on this screen" />
          <ol className={`grid gap-5 ${columnClass}`}>
            {page.steps.map((step, index) => (
              <li key={step.title} className="rounded-3xl border border-zinc-100 bg-body-bg p-6">
                <p className="text-default-400 text-sm font-medium">{String(index + 1).padStart(2, '0')}</p>
                <h3 className="text-default-900 mt-3 text-lg font-medium">{step.title}</h3>
                <p className="text-default-600 mt-2 text-sm leading-relaxed md:text-base">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container">
          <SectionHeading eyebrow="On the page" title="What this screen is for" />
          <div className="grid gap-5 md:grid-cols-3">
            {page.points.map((point) => (
              <article key={point.title} className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm">
                <h3 className="text-default-900 text-lg font-medium">{point.title}</h3>
                <p className="text-default-600 mt-2 text-sm leading-relaxed md:text-base">{point.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-24">
        <div className="container">
          <SectionHeading eyebrow="Side by side" title={page.columnsTitle} />
          <div className="grid gap-5 md:grid-cols-2">
            {page.columns.map((column) => (
              <article key={column.title} className="rounded-3xl border border-zinc-100 p-6 md:p-8">
                <h3 className="text-default-900 text-xl font-medium">{column.title}</h3>
                <ul className="mt-5 space-y-3">
                  {column.items.map((item) => (
                    <li key={item} className="text-default-600 flex gap-3 text-sm leading-relaxed md:text-base">
                      <span aria-hidden className="bg-default-900 mt-2 size-1.5 shrink-0 rounded-full" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          {page.note ? <p className="text-default-500 mt-8 max-w-2xl text-sm leading-relaxed">{page.note}</p> : null}
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container">
          <SectionHeading eyebrow="Questions" title="Before you continue" />
          <div className="mx-auto max-w-3xl space-y-2.5">
            {page.faqs.map((faq) => (
              <details key={faq.question} className="group rounded-2xl border border-zinc-100 bg-white shadow-sm">
                <summary className="text-default-900 flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 font-medium [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <span aria-hidden className="text-default-400 text-xl leading-none group-open:hidden">
                    +
                  </span>
                  <span aria-hidden className="text-default-400 hidden text-xl leading-none group-open:inline">
                    –
                  </span>
                </summary>
                <p className="text-default-600 px-6 pb-5 text-sm leading-relaxed md:text-base">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-24">
        <div className="container">
          <SectionHeading eyebrow="Keep going" title="Other product pages" />
          <div className="grid gap-5 md:grid-cols-3">
            {related.map((item) => (
              <Link key={item.slug} href={`/products/${item.slug}`} className="rounded-3xl border border-zinc-100 p-6 transition-all hover:shadow-md">
                <p className="text-default-500 text-xs font-medium tracking-wide uppercase">{item.eyebrow}</p>
                <h3 className="text-default-900 mt-2 text-lg font-medium">{item.label}</h3>
                <p className="text-default-600 mt-2 text-sm leading-relaxed">{item.detail}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
