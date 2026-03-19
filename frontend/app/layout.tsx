import type { Metadata } from "next"
import { Montserrat, Inter, Roboto_Mono } from "next/font/google"
import "./globals.css"
import { VapiCallProvider } from "@/components/vapi-call-provider"
import { Navigation } from "@/components/navigation"

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-headings",
  display: "swap",
})
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
})
const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "HealthLah – Your Health Matters, Lah!",
  description:
    "AI-powered voice companion for chronic disease patients in Singapore. Daily check-in calls in your preferred language, powered by MERaLiON AudioLLM.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏥</text></svg>",
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${inter.variable} ${robotoMono.variable} bg-background`}>
      <body className="min-h-screen bg-background font-sans antialiased relative">
        <div className="grain-overlay" aria-hidden />
        <div className="relative z-10">
          <VapiCallProvider>
            <Navigation />
            {children}
          </VapiCallProvider>
        </div>
      </body>
    </html>
  )
}
