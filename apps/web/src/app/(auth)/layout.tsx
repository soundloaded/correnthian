import type { ReactNode } from "react"
import { VaultShell } from "@/components/vault-auth"

/**
 * Auth shell: every auth route renders inside the same warm-obsidian vault
 * card so sign-in, register, forgot, and the two email-landing routes read
 * as one product before the wallet opens.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <VaultShell>{children}</VaultShell>
}
