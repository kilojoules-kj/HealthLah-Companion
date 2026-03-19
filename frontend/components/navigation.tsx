"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Heart, UserPlus, LayoutDashboard } from "lucide-react"

const navLinks = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#why-healthlah", label: "Why HealthLah" },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Heart className="h-4 w-4" />
          </div>
          <div>
            <span className="text-lg font-semibold text-foreground font-heading block">HealthLah</span>
            <span className="text-[10px] md:text-xs text-muted-foreground font-mono hidden sm:block">
              Your Health Matters, Lah!
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label }) => {
            const isPage = href.startsWith("/") && !href.startsWith("/#")
            const isActive = isPage && pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors hover:text-foreground hover:bg-secondary/50 font-mono ${
                  isActive ? "text-primary bg-secondary/50" : "text-muted-foreground"
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex rounded-[28px] text-muted-foreground hover:text-foreground">
            <Link href="/register-patient">
              <UserPlus className="h-4 w-4 mr-1.5" />
              Register Patient
            </Link>
          </Button>
          <Button asChild size="sm" className="rounded-[28px] bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link href="/dashboard">
              <LayoutDashboard className="h-4 w-4 mr-1.5" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
