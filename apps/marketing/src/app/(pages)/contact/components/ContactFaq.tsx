import Link from 'next/link'

const ContactFaq = () => {
  return (
    <div className="mx-auto max-w-3xl space-y-2.5 text-start">
      <style>{`.contact-faq[open] .contact-faq-plus{transform:rotate(45deg)}`}</style>
      <details className="contact-faq rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <summary className="text-default-900 flex cursor-pointer list-none items-center justify-between gap-4 p-3.5 font-medium md:text-xl lg:p-5 [&::-webkit-details-marker]:hidden">
          Will someone receive this?
          <span className="contact-faq-plus bg-default-200 text-default-800 inline-flex size-6.5 shrink-0 items-center justify-center rounded-full text-lg leading-none transition-transform duration-300 md:size-8.5" aria-hidden="true">
            +
          </span>
        </summary>
        <p className="px-3.5 pb-3.5 text-base leading-normal text-zinc-500 md:text-lg md:leading-relaxed lg:px-5 lg:pb-5">No.</p>
      </details>
      <details className="contact-faq rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <summary className="text-default-900 flex cursor-pointer list-none items-center justify-between gap-4 p-3.5 font-medium md:text-xl lg:p-5 [&::-webkit-details-marker]:hidden">
          Where do I ask to use the app?
          <span className="contact-faq-plus bg-default-200 text-default-800 inline-flex size-6.5 shrink-0 items-center justify-center rounded-full text-lg leading-none transition-transform duration-300 md:size-8.5" aria-hidden="true">
            +
          </span>
        </summary>
        <p className="px-3.5 pb-3.5 text-base leading-normal text-zinc-500 md:text-lg md:leading-relaxed lg:px-5 lg:pb-5">
          <Link href="/waitlist" className="text-default-900 underline decoration-2 underline-offset-4">
            /waitlist
          </Link>
        </p>
      </details>
    </div>
  )
}

export default ContactFaq
