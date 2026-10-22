import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { AnimatePresence, motion } from "motion/react"
import { ShieldCheck, KeyRound, MailCheck } from "lucide-react"

import { Button } from "@correnthian/ui/components/button"
import { Input } from "@correnthian/ui/components/input"
import { Label } from "@correnthian/ui/components/label"

import { api } from "@/lib/api"
import { pressable, step } from "@/components/motion"

const LOGOS = ["google", "slack", "openai"]
const FOOTER_LINKS = ["Support", "Privacy", "Terms"]

export function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  /**
   * Ask the API for a reset link.
   *
   * The page used to flip to "we sent you a link" without asking anything —
   * a control that pretended to work. It now calls the real endpoint, and it
   * shows the answer the API gives: the same message whether or not the
   * address holds an account, because confirming that an address is
   * registered is how a list of addresses becomes a list of targets.
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSending(true)
    const result = await api.request("POST /api/v1/auth/password-reset", {
      method: "POST",
      auth: false,
      body: { email: email.trim() },
    })
    setSending(false)
    if (result.status === "ok") {
      setSent(true)
      return
    }
    setError(
      result.status === "unavailable"
        ? "Cannot reach the Correnthian API. It may be starting, or stopped."
        : result.status === "unauthorised"
          ? "The API refused the request. Sign in and try again."
          : result.message,
    )
  }

  const Icon = sent ? MailCheck : KeyRound

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      {/* Dot pattern */}
      <div className="pointer-events-none absolute inset-0 text-neutral-400/70 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(700px_circle_at_center,white,transparent)]" />

      <header className="relative z-20 flex h-20 items-center justify-between px-6 lg:px-12">
        <Link
          to="/"
          className="hero-in flex items-center gap-2 text-sm font-semibold"
          style={step(0)}
        >
          <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
            <ShieldCheck className="size-4" />
          </div>
          Correnthian
        </Link>
        <p className="hero-in text-sm text-muted-foreground" style={step(1)}>
          Remembered your password?{" "}
          <Link
            to="/auth/login"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Sign in
          </Link>
        </p>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-8">
        <div className="grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1fr_380px] lg:gap-16">
          <section className="hidden lg:block">
            <div
              className="hero-in mb-5 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm"
              style={step(1)}
            >
              <span className="size-1.5 rounded-full bg-primary" />
              Account recovery
            </div>
            <h1
              className="hero-in max-w-xl text-4xl font-semibold tracking-tight xl:text-5xl"
              style={step(2)}
            >
              Locked out? <span className="text-primary">We've got you.</span>
            </h1>
            <p
              className="hero-in mt-6 max-w-lg text-base leading-7 text-muted-foreground"
              style={step(3)}
            >
              Enter your email and we'll send you a secure link to reset your
              password and get you back to your pipeline in minutes.
            </p>

            <div className="hero-in" style={step(5)}>
              <p className="mb-5 mt-16 text-sm font-medium text-muted-foreground">
                Trusted by leading teams
              </p>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-4 opacity-80 dark:opacity-100">
                {LOGOS.map((logo) => (
                  <img
                    key={logo}
                    src={`/logos/${logo}.svg`}
                    alt={logo}
                    className={`${logo === "google" ? "h-6" : "h-5"} w-auto object-contain grayscale dark:brightness-0 dark:invert`}
                  />
                ))}
              </div>
            </div>
          </section>

          <div
            className="hero-in w-full rounded-2xl border bg-background/90 p-7 shadow-xl backdrop-blur-md sm:p-8"
            style={step(2)}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={sent ? "sent" : "form"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <motion.div
                  key={sent ? "mail" : "key"}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", bounce: 0.4, duration: 0.5 }}
                  className="mb-6 flex size-12 items-center justify-center rounded-xl border bg-muted/50"
                >
                  <Icon className="size-5" />
                </motion.div>

                <h2 className="text-xl font-semibold tracking-tight">
                  {sent ? "Check your email" : "Forgot your password?"}
                </h2>
                <p className="mb-7 mt-1.5 text-sm text-muted-foreground">
                  {sent ? (
                    <>
                      If that address holds an account, a reset link is on its
                      way. It works once and expires in an hour.
                    </>
                  ) : (
                    "Enter the email linked to your account and we'll send you a reset link."
                  )}
                </p>

                {sent && (
                  <p className="mb-5 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Development sends nothing: the link is written to the
                    API's log, where the console sink renders it.
                  </p>
                )}

                {sent ? (
                  <div className="grid gap-3">
                    {/*
                      The reset link lands in the holder's inbox and opens
                      the web client's reset page, which is not this console.
                      So the button returns to sign-in rather than to a page
                      that cannot work.
                    */}
                    <motion.div {...pressable}>
                      <Button
                        className="w-full"
                        onClick={() => navigate({ to: "/auth/login" })}
                      >
                        Back to sign in
                      </Button>
                    </motion.div>
                    <motion.div {...pressable}>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => setSent(false)}
                      >
                        Use a different email
                      </Button>
                    </motion.div>
                  </div>
                ) : (
                  <form className="grid gap-5" onSubmit={handleSubmit}>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Work email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    {error && (
                      <p role="alert" className="text-sm text-destructive">
                        {error}
                      </p>
                    )}
                    <motion.div {...pressable}>
                      <Button type="submit" className="w-full" disabled={sending}>
                        {sending ? "Sending…" : "Send reset link"}
                      </Button>
                    </motion.div>
                  </form>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      <footer
        className="hero-in relative z-20 flex flex-col items-center justify-between gap-4 px-6 pb-6 pt-4 text-xs text-muted-foreground sm:flex-row sm:px-10 lg:px-12"
        style={step(6)}
      >
        <p>© {new Date().getFullYear()} Correnthian. All rights reserved.</p>
        <nav className="flex items-center gap-5">
          {FOOTER_LINKS.map((item) => (
            <a
              key={item}
              href="#"
              className="transition-colors hover:text-foreground"
            >
              {item}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  )
}