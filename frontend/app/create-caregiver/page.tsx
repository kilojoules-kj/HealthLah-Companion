"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Heart } from "lucide-react"

export default function CreateCaregiverPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="paper-card p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground mb-3">
            <Heart className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold text-foreground font-heading">Create Caregiver</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Your caregiver info is collected when you register a patient. Register a patient to get started.
          </p>
        </div>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name" className="font-mono">Name</Label>
            <Input id="name" placeholder="Your name" className="rounded-[28px] border-border" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email" className="font-mono">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" className="rounded-[28px] border-border" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone" className="font-mono">Phone</Label>
            <Input id="phone" type="tel" placeholder="+65 9000 0000" className="rounded-[28px] border-border" />
          </div>
          <Button asChild className="w-full rounded-[28px] bg-primary hover:bg-primary/90 text-primary-foreground mt-4">
            <Link href="/register-patient">Continue to Register Patient</Link>
          </Button>
          <Button asChild variant="outline" className="w-full rounded-[28px] border-border">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
