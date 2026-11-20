import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'A plain description of this marketing site. It is not a lawyer-reviewed privacy policy, and it does not name a legal entity.',
}

const Page = () => {
  return (
    <section className="pt-32 pb-20">
      <div className="container">
        <article className="mx-auto max-w-3xl">
          <h1 className="text-default-900 text-4xl font-medium md:text-5xl">Privacy</h1>

          <p className="text-default-600 mt-6 text-base leading-relaxed md:text-lg">
            This is a description of this marketing site, not a lawyer-reviewed privacy policy, and it does not name a legal entity.
          </p>

          <h2 className="text-default-900 mt-10 mb-3 text-xl font-medium md:text-2xl">Keys</h2>
          <p className="text-default-600 text-base leading-relaxed md:text-lg">This marketing site does not ask for a private key or a seed.</p>

          <h2 className="text-default-900 mt-10 mb-3 text-xl font-medium md:text-2xl">Email</h2>
          <p className="text-default-600 text-base leading-relaxed md:text-lg">This site does not provide a form that stores your email.</p>

          <h2 className="text-default-900 mt-10 mb-3 text-xl font-medium md:text-2xl">This page</h2>
          <p className="text-default-600 text-base leading-relaxed md:text-lg">
            We do not describe a tracker on this page because this page is not a place you sign in.
          </p>
        </article>
      </div>
    </section>
  )
}

export default Page
