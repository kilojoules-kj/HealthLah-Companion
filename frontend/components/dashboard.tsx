"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Phone, Heart, Clock, ArrowLeft, Loader2, ChevronRight,
  BookOpen, Calendar, Sparkles, Smile, Mic, Volume2,
  MessageCircle, Activity, TrendingUp, Users, Pill,
  Play, Pause, Download, Share2, MoreHorizontal
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useVapi } from "@/components/vapi-call-provider"
import type { PatientLike } from "@/components/vapi-call-provider"
import { CallDataViewer } from "@/components/call-data-viewer"

// ============================================
// MR_TAN - Beautiful Demo Persona
// ============================================
const MR_TAN = {
  name: "Mr. Tan Ah Kow",
  firstName: "Mr. Tan",
  age: 67,
  location: "Bedok, Singapore",
  avatar: "👵",
  
  vitals: {
    mood: { value: 87, label: "Happy", trend: "up", emoji: "😊" },
    engagement: { value: 94, label: "Engaged", trend: "up", emoji: "🤝" },
    wellness: { value: 92, label: "Well", trend: "stable", emoji: "💪" },
    connection: { value: 89, label: "Connected", trend: "up", emoji: "❤️" },
  },
  
  thisWeek: {
    calls: 4,
    minutes: 127,
    stories: 3,
    memories: 2
  },
  
  latestCall: {
    date: "Today",
    time: "8:27 AM",
    duration: "18 min",
    excerpt: "Shared beautiful memories about his garden and morning tai chi routine...",
    transcript: "We talked about the weather being good for morning walks. Mr. Tan remembered his old neighbourhood in Bedok and how he'd bring the grandchildren to the hawker centre.",
    mood: "Joyful",
    topics: ["Tai Chi", "Family", "Spring"]
  }
}

interface DashboardProps {
  onBackToList?: () => void
}

export function Dashboard({ onBackToList }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "calls" | "memories">("overview")
  const [showWaveform, setShowWaveform] = useState(false)
  const [isCollectingData, setIsCollectingData] = useState(false)
  const { startCall, endCall, isActive, isConnecting, error, lastCallData } = useVapi()

  // Track when we're collecting data after call ends
  useEffect(() => {
    if (!isActive && isCollectingData) {
      // Call ended, show collecting state for a few seconds
      const timer = setTimeout(() => {
        setIsCollectingData(false)
      }, 8000) // Show for 8 seconds
      return () => clearTimeout(timer)
    }
  }, [isActive, isCollectingData])

  const handleEndCall = async () => {
    setIsCollectingData(true)
    await endCall()
  }

  const patientLike: PatientLike = {
    name: MR_TAN.name,
    age: MR_TAN.age,
    biography: `Lives in ${MR_TAN.location}. Enjoys gardening, family time, and sharing stories.`,
    hobbies: ["Tai Chi", "Reading newspapers", "Kopi session"],
    medications: [{ name: "Metformin", time: "8:00 AM" }],
    personality_notes: "Warm, nostalgic, loves sharing stories",
  }

  // Trigger waveform animation when call is active
  useEffect(() => {
    setShowWaveform(isActive)
  }, [isActive])

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-200/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {onBackToList && (
              <Button variant="ghost" size="icon" onClick={onBackToList} className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            
            {/* Avatar with Status Ring */}
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-3xl shadow-lg">
                {MR_TAN.avatar}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-white flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              </div>
            </div>
            
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{MR_TAN.name}</h1>
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                {MR_TAN.age} years · {MR_TAN.location}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" className="rounded-full border-teal-200 bg-white/80 backdrop-blur" asChild>
              <Link href="/storybook/mr-tan">
                <BookOpen className="w-4 h-4 mr-2 text-teal-700" />
                Health Log
              </Link>
            </Button>
            
            {/* Call Button with Animation */}
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                className={`rounded-full shadow-lg px-6 ${
                  isActive 
                    ? "bg-red-500 hover:bg-red-600 text-white" 
                    : "bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-orange-600 hover:to-rose-600 text-white"
                }`}
                onClick={() => isActive ? handleEndCall() : startCall(patientLike)}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : isActive ? (
                  <><Phone className="w-4 h-4 mr-2" /> End</>
                ) : (
                  <><Phone className="w-4 h-4 mr-2" /> Call</>
                )}
              </Button>
            </motion.div>
          </div>
        </header>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700"
          >
            {error}
          </motion.div>
        )}

        {/* Live Call Indicator */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8"
            >
              <Card className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white border-0 overflow-hidden">
                <CardContent className="p-6 relative">
                  {/* Waveform Animation */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-20">
                    {[...Array(20)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-1 mx-0.5 bg-white rounded-full"
                        animate={{
                          height: [20, 60, 20],
                        }}
                        transition={{
                          duration: 0.5,
                          repeat: Infinity,
                          delay: i * 0.05,
                        }}
                      />
                    ))}
                  </div>
                  
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                        <Mic className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold">Call in Progress</p>
                        <p className="text-white/80">Speaking with Mr. Tan...</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-5 h-5 animate-pulse" />
                      <span className="text-sm">Listening</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collecting Data Loading State */}
        <AnimatePresence>
          {isCollectingData && !isActive && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8"
            >
              <Card className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0 overflow-hidden">
                <CardContent className="p-6 relative">
                  {/* Spinner Animation */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-10">
                    <motion.div
                      className="w-32 h-32 border-4 border-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.div
                      className="absolute w-24 h-24 border-4 border-white rounded-full"
                      animate={{ rotate: -360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                  
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold">Analyzing Health Data...</p>
                        <p className="text-white/80">Processing health check-in with Mr. Tan</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="w-2 h-2 bg-white rounded-full"
                            animate={{ 
                              scale: [1, 1.5, 1],
                              opacity: [0.5, 1, 0.5]
                            }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              delay: i * 0.2,
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-white/70">Analyzing transcript...</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Just Captured - Flashy Card }}
        <AnimatePresence>
          {lastCallData && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8"
            >
              <Card className="border-2 border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-400/20 rounded-full -translate-y-1/2 translate-x-1/2" />
                
                <CardContent className="p-6 relative">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg">
                      ✨
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-green-500 text-white rounded-full">
                          Just Captured
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {new Date().toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {lastCallData.chapter_title}
                      </h3>
                      
                      <p className="text-gray-700 italic mb-3">
                        "{lastCallData.chapter_content}"
                      </p>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="rounded-full bg-white">
                          {lastCallData.mood === 'happy' ? '😊' : '🙂'} {lastCallData.mood}
                        </Badge>
                        {lastCallData.meds_taken && (
                          <Badge variant="outline" className="rounded-full bg-green-100 text-green-700 border-green-300">
                            <Pill className="w-3 h-3 mr-1" /> Meds confirmed
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <Button variant="ghost" size="icon" className="rounded-full" onClick={() => {}}>
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vitals Grid */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {Object.entries(MR_TAN.vitals).map(([key, vital], i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="bg-white/80 backdrop-blur border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500 capitalize">{key}</span>
                    {vital.trend === "up" && <TrendingUp className="w-4 h-4 text-green-500" />}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">{vital.value}%</span>
                    <span className="text-2xl">{vital.emoji}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{vital.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left Column - Latest Call */}
          <div className="col-span-2 space-y-6">
            {/* This Week Stats */}
            <Card className="bg-white/80 backdrop-blur border-0">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-teal-600" />
                  This Week
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { icon: Phone, value: MR_TAN.thisWeek.calls, label: "Calls" },
                    { icon: Clock, value: MR_TAN.thisWeek.minutes, label: "Minutes" },
                    { icon: MessageCircle, value: MR_TAN.thisWeek.stories, label: "Stories" },
                    { icon: Sparkles, value: MR_TAN.thisWeek.memories, label: "Memories" },
                  ].map((stat, i) => (
                    <div key={i} className="text-center p-4 rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50">
                      <stat.icon className="w-6 h-6 mx-auto mb-2 text-teal-600" />
                      <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                      <div className="text-sm text-gray-600">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Latest Call Card */}
            <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
                      <Phone className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Latest Call</h3>
                      <p className="text-sm text-gray-600">{MR_TAN.latestCall.date} · {MR_TAN.latestCall.time}</p>
                    </div>
                  </div>
                  <Badge className="bg-teal-600 text-white rounded-full">
                    {MR_TAN.latestCall.duration}
                  </Badge>
                </div>

                <div className="bg-white/60 rounded-xl p-4 mb-4">
                  <p className="text-gray-700">{MR_TAN.latestCall.transcript}</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {MR_TAN.latestCall.topics.map(topic => (
                      <Badge key={topic} variant="outline" className="rounded-full bg-white/80">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="rounded-full">
                    <Play className="w-4 h-4 mr-1" /> Replay
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* All Calls Section */}
            <CallDataViewer />
          </div>

          {/* Right Column - Quick Actions & Info */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="bg-white/80 backdrop-blur border-0">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start rounded-xl" asChild>
                    <Link href="/storybook/mr-tan">
                      <BookOpen className="w-4 h-4 mr-2 text-amber-600" />
                      View Health Log
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start rounded-xl">
                    <Users className="w-4 h-4 mr-2 text-blue-600" />
                    Family Members
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </Button>
                  <Button variant="outline" className="w-full justify-start rounded-xl">
                    <Download className="w-4 h-4 mr-2 text-green-600" />
                    Export Report
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Medication Status */}
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                    <Pill className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Medications</h3>
                    <p className="text-sm text-green-700">On track today</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {["Metformin", "Amlodipine", "Insulin Glargine"].map((med, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-gray-700">{med}</span>
                      <span className="text-gray-400 ml-auto">Taken</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Next Scheduled Call */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Next Call</h3>
                    <p className="text-sm text-blue-700">Tomorrow, 9:00 AM</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  Mr. Tan prefers morning calls in Mandarin. He&apos;ll likely want to discuss his morning routine and medication.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
