import { useRef, useState, type FormEvent } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { AnimatePresence, motion } from "motion/react"
import { Eye, EyeOff, ShieldCheck } from "lucide-react"
import { FaGithub } from "react-icons/fa6"
import { FcGoogle } from "react-icons/fc"

import { login } from "@/lib/api"

import { Button } from "@correnthian/ui/components/button"
import { Input } from "@correnthian/ui/components/input"
import { Label } from "@correnthian/ui/components/label"

import { pressable, step } from "@/components/motion"

const LOGOS = ["google", "slack", "openai"]
const SOCIALS = [
  { name: "Google", icon: FcGoogle },
  { name: "GitHub", icon: FaGithub },
]
const FOOTER_LINKS = ["Support", "Privacy", "Terms"]

export function Login() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState("")
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const passRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Captured synchronously: React nulls currentTarget once dispatch ends,
    // so the async continuation below would otherwise dereference null.
    const form = e.currentTarget
    const data = new FormData(form)
    const email = String(data.get("email") ?? "").trim()
    const password = String(data.get("password") ?? "")
    if (!email || !password) {
      setFailed(true)
      setMessage("Enter both an email address and a password.")
      return
    }
    setBusy(true)
    setFailed(false)
    setMessage("")
    void (async () => {
      try {
        const r = await login(email, password)
        if (!r.ok) {
          // Deliberately vague on bad credentials: this form must not confirm
          // which addresses exist. The helper returns that shape already.
          // The password field alone is cleared — the secret must not sit in
          // the DOM, but the operator should not have to retype their email.
          if (passRef.current) passRef.current.value = ""
          setFailed(true)
          setMessage(r.error)
          return
        }
        form.reset()
        void navigate({ to: "/dashboard" })      } finally {
        setBusy(false)
      }
    })()
  }

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
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-8">
        <div className="grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1fr_380px] lg:gap-16">
          <section className="hidden lg:block">
            <div
              className="hero-in mb-5 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm"
              style={step(1)}
            >
              <span className="size-1.5 rounded-full bg-primary" />
              Built for modern web applications
            </div>
            <h1
              className="hero-in max-w-xl text-4xl font-semibold tracking-tight xl:text-5xl"
              style={step(2)}
            >
              Manage your business <span className="text-primary">smarter.</span>
            </h1>
            <p
              className="hero-in mt-6 max-w-lg text-base leading-7 text-muted-foreground"
              style={step(3)}
            >
              Welcome to Correnthian Admin. Manage your leads, track deals, organize
              activities, and collaborate with your team in one place.
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
                    className="h-5 w-auto object-contain grayscale dark:brightness-0 dark:invert"
                  />
                ))}
              </div>
            </div>
          </section>

          <div
            className="hero-in w-full rounded-2xl border bg-background/90 p-7 shadow-xl backdrop-blur-md sm:p-8"
            style={step(2)}
          >
            <h2 className="text-xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mb-7 mt-1.5 text-sm text-muted-foreground">
              Sign in to your Correnthian Admin account.
            </p>

            <div className="grid gap-3">
              {SOCIALS.map(({ name, icon: Icon }) => (
                <motion.div key={name} {...pressable}>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      setMessage(`${name} sign-in is not configured yet.`)
                    }
                  >
                    <Icon className="size-4" />
                    Continue with {name}
                  </Button>
                </motion.div>
              ))}
            </div>

            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              OR
              <div className="h-px flex-1 bg-border" />
            </div>

            <form
              className="grid gap-5"
              onSubmit={handleSubmit}
              onChange={() => setMessage("")}
            >
              <div className="grid gap-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  disabled={busy}
                  required
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/auth/forgot-password"
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    ref={passRef}
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="pr-10"
                    minLength={8}
                    disabled={busy}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={showPassword ? "hide" : "show"}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.12 }}
                        className="flex"
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </motion.span>
                    </AnimatePresence>
                  </button>
                </div>
              </div>

              <motion.div {...pressable}>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </motion.div>

              <AnimatePresence>
                {message && (
                  <motion.p
                    key={message}
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className={`text-center text-sm ${failed ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {message}
                  </motion.p>
                )}
              </AnimatePresence>
            </form>
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