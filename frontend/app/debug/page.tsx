"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, XCircle, AlertTriangle, ExternalLink, RefreshCw, Copy, Check } from "lucide-react"
import Link from "next/link"

export default function DebugPage() {
  const [webhookStatus, setWebhookStatus] = useState<"checking" | "ok" | "error">("checking")
  const [recentCalls, setRecentCalls] = useState<any[]>([])
  const [envVars, setEnvVars] = useState<Record<string, boolean>>({})
  const [webhookUrl, setWebhookUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [isLocalhost, setIsLocalhost] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Check environment variables
    setEnvVars({
      NEXT_PUBLIC_VAPI_PUBLIC_KEY: !!process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY,
      NEXT_PUBLIC_VAPI_ASSISTANT_ID: !!process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID,
    })

    // Determine webhook URL
    const host = window.location.host
    const protocol = window.location.protocol
    const localhost = host.includes('localhost') || host.includes('127.0.0.1')
    setIsLocalhost(localhost)
    
    if (localhost) {
      setWebhookUrl(`https://YOUR_NGROK_URL.ngrok.io/api/webhook/vapi`)
    } else {
      setWebhookUrl(`${protocol}//${host}/api/webhook/vapi`)
    }

    fetchDiagnostics()
  }, [])

  const fetchDiagnostics = async () => {
    try {
      const res = await fetch("/api/webhook-status")
      if (res.ok) {
        const data = await res.json()
        setDiagnostics(data)
        setRecentCalls(data.recentCalls || [])
      }
    } catch (e) {
      console.error("Failed to fetch diagnostics:", e)
    }
  }

  const testWebhook = async () => {
    setWebhookStatus("checking")
    try {
      const res = await fetch("/api/debug/webhook-test", { method: "POST" })
      const data = await res.json()
      setWebhookStatus(data.received ? "ok" : "error")
    } catch (e) {
      setWebhookStatus("error")
    }
  }

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl.replace('YOUR_NGROK_URL.ngrok.io', 'your-ngrok-url'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Prevent hydration mismatch by not rendering status-dependent UI until mounted
  if (!mounted) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <h1 className="text-3xl font-bold font-heading mb-2">VAPI Debug & Setup</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <h1 className="text-3xl font-bold font-heading mb-2">VAPI Debug & Setup</h1>
      <p className="text-muted-foreground mb-8">
        Troubleshoot your VAPI integration and webhook setup.
      </p>

      {/* Quick Status */}
      <Card className="mb-6 border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Quick Status Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${recentCalls.length > 0 ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <div>
                <p className="text-sm font-medium">Recent Calls</p>
                <p className="text-xs text-muted-foreground">{recentCalls.length} found in database</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${envVars.NEXT_PUBLIC_VAPI_PUBLIC_KEY ? 'bg-green-500' : 'bg-red-500'}`} />
              <div>
                <p className="text-sm font-medium">VAPI Config</p>
                <p className="text-xs text-muted-foreground">{envVars.NEXT_PUBLIC_VAPI_PUBLIC_KEY ? 'Keys set' : 'Missing keys'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${!isLocalhost ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <div>
                <p className="text-sm font-medium">Deployment</p>
                <p className="text-xs text-muted-foreground">{isLocalhost ? 'Local dev' : 'Deployed'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook URL Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Your Webhook URL</CardTitle>
          <CardDescription>
            {isLocalhost 
              ? "Copy this URL (with your ngrok domain) to VAPI Dashboard"
              : "This is your production webhook URL"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <code className="flex-1 bg-secondary px-4 py-3 rounded-lg text-sm font-mono break-all">
              {webhookUrl}
            </code>
            <Button variant="outline" size="icon" onClick={copyWebhookUrl} className="shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          {isLocalhost && (
            <p className="text-sm text-yellow-600 mt-3">
              ⚠️ Replace YOUR_NGROK_URL with your actual ngrok URL (e.g., abc123.ngrok.io)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Two-column layout */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Setup Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Setup Instructions</CardTitle>
            <CardDescription>How to configure VAPI webhooks</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">1</span>
                <div>
                  <p className="font-medium">Go to VAPI Dashboard</p>
                  <p className="text-muted-foreground mt-1">
                    Click your <strong>Organization name</strong> (top left, next to VAPI logo)
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">2</span>
                <div>
                  <p className="font-medium">Select Settings</p>
                  <p className="text-muted-foreground mt-1">
                    From the dropdown menu
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">3</span>
                <div>
                  <p className="font-medium">Paste your Webhook URL</p>
                  <p className="text-muted-foreground mt-1">
                    Find <strong>Webhook URL</strong> field and paste the URL above
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">4</span>
                <div>
                  <p className="font-medium">Save and Test</p>
                  <p className="text-muted-foreground mt-1">
                    Save changes, then make a test call
                  </p>
                </div>
              </li>
            </ol>

            <div className="mt-6 pt-6 border-t">
              <Link 
                href="https://dashboard.vapi.ai" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                Open VAPI Dashboard
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* ngrok Instructions (only show for localhost) */}
        {isLocalhost && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Local Dev Setup (ngrok)</CardTitle>
              <CardDescription>Required for local webhook testing</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center text-xs font-medium">1</span>
                  <div>
                    <p className="font-medium">Install ngrok</p>
                    <code className="text-xs bg-secondary px-2 py-1 rounded mt-1 inline-block">brew install ngrok</code>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center text-xs font-medium">2</span>
                  <div>
                    <p className="font-medium">Configure ngrok</p>
                    <code className="text-xs bg-secondary px-2 py-1 rounded mt-1 inline-block">ngrok config add-authtoken TOKEN</code>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center text-xs font-medium">3</span>
                  <div>
                    <p className="font-medium">Start ngrok</p>
                    <code className="text-xs bg-secondary px-2 py-1 rounded mt-1 inline-block">ngrok http 3001</code>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center text-xs font-medium">4</span>
                  <div>
                    <p className="font-medium">Copy URL to VAPI</p>
                    <p className="text-xs text-muted-foreground mt-1">Copy the https URL and paste in VAPI Dashboard</p>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Deployment Card (only show for localhost) */}
        {isLocalhost && (
          <Card className="md:col-span-2 border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-lg text-green-800">Want to share with friends?</CardTitle>
              <CardDescription className="text-green-700">
                Your friends can&apos;t access localhost:3001. Deploy to Vercel to share!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-green-800">
                <p>Deploy in 5 minutes:</p>
                <ol className="space-y-2 ml-4">
                  <li>1. <code className="bg-green-100 px-2 py-0.5 rounded">npm i -g vercel</code></li>
                  <li>2. <code className="bg-green-100 px-2 py-0.5 rounded">vercel login</code></li>
                  <li>3. <code className="bg-green-100 px-2 py-0.5 rounded">vercel</code> (from frontend folder)</li>
                  <li>4. Add environment variables in Vercel Dashboard</li>
                  <li>5. Update VAPI webhook URL to your production URL</li>
                </ol>
                <p className="mt-4">
                  See full instructions in the <Link href="/" className="underline font-medium">README</Link>
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Calls */}
      {recentCalls.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Recent Calls</CardTitle>
              <CardDescription>Last {recentCalls.length} calls from your database</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchDiagnostics}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentCalls.map((call: any) => (
                <div key={call.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{new Date(call.started_at).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {call.has_transcript ? "✓ Transcript" : "✗ No transcript"} • 
                      {call.has_summary ? " ✓ Summary" : " ✗ No summary"} • 
                      Duration: {call.duration || 0}s
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs ${call.ended_at ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {call.ended_at ? "Completed" : "In progress"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {recentCalls.length === 0 && (
        <Alert className="mb-6 border-yellow-500/50 bg-yellow-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No calls found</AlertTitle>
          <AlertDescription>
            <p className="mb-2">No call logs in your database yet. This could mean:</p>
            <ul className="list-disc ml-4 space-y-1 text-sm">
              <li>You haven&apos;t made any calls yet</li>
              <li>Webhooks aren&apos;t reaching your server</li>
              <li>The call registration failed</li>
            </ul>
            <p className="mt-3">
              <strong>To test:</strong> Make a call from your dashboard, then check your terminal for{" "}
              <code>[VAPI Webhook]</code> logs.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Test Webhook Button */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Test Webhook Endpoint</CardTitle>
          <CardDescription>Verify your server can receive webhooks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={testWebhook} variant="outline">
              Test Webhook Reception
            </Button>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                webhookStatus === "ok" ? "bg-green-500" : 
                webhookStatus === "error" ? "bg-red-500" : 
                "bg-yellow-500"
              }`} />
              <span className="text-sm text-muted-foreground">
                {webhookStatus === "ok" ? "Server reachable" : 
                 webhookStatus === "error" ? "Test failed" : 
                 "Not tested"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
