"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Phone, Clock, MessageCircle, RefreshCw, Smile, 
  AlertCircle, Play, ChevronDown, ChevronUp,
  Heart, Sparkles
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface CallLog {
  id: string
  vapi_call_id: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  transcript: string | null
  summary: string | null
  mood_score: number | null
  medication_confirmed: boolean | null
  concern_flags: string[] | null
  memories_extracted: any[] | null
  created_at: string
}

export function CallDataViewer() {
  const [calls, setCalls] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCall, setSelectedCall] = useState<string | null>(null)

  const fetchCalls = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/calls/recent")
      if (res.ok) {
        const data = await res.json()
        setCalls(data.calls)
      }
    } catch (e) {
      console.error("Failed to fetch calls:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCalls()
    const interval = setInterval(fetchCalls, 10000)
    return () => clearInterval(interval)
  }, [])

  const getMoodInfo = (score: number | null) => {
    if (!score || score >= 4) return { 
      emoji: "😊", 
      label: "Happy", 
      color: "bg-green-100 text-green-700 border-green-300",
      gradient: "from-green-50 to-emerald-50"
    }
    if (score >= 3) return { 
      emoji: "🙂", 
      label: "Good", 
      color: "bg-blue-100 text-blue-700 border-blue-300",
      gradient: "from-blue-50 to-indigo-50"
    }
    if (score >= 2) return { 
      emoji: "😐", 
      label: "Okay", 
      color: "bg-yellow-100 text-yellow-700 border-yellow-300",
      gradient: "from-yellow-50 to-amber-50"
    }
    return { 
      emoji: "😔", 
      label: "Low", 
      color: "bg-red-100 text-red-700 border-red-300",
      gradient: "from-red-50 to-rose-50"
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  if (calls.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur border-0 border-dashed">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-teal-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Phone className="w-8 h-8 text-teal-600" />
          </div>
          <p className="text-gray-600 mb-4">No calls captured yet</p>
          <Button variant="outline" onClick={fetchCalls} disabled={loading} className="rounded-full">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Check for Calls
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Phone className="w-5 h-5 text-teal-600" />
          Call History
          <Badge variant="outline" className="rounded-full bg-white">
            {calls.length}
          </Badge>
        </h3>
        <Button variant="ghost" size="sm" onClick={fetchCalls} disabled={loading} className="rounded-full">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {calls.map((call, index) => {
          const mood = getMoodInfo(call.mood_score)
          const isExpanded = selectedCall === call.id
          const hasTranscript = !!call.transcript && call.transcript.length > 10
          const hasMemories = call.memories_extracted && call.memories_extracted.length > 0
          
          return (
            <motion.div
              key={call.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className={`bg-gradient-to-br ${mood.gradient} border-0 overflow-hidden cursor-pointer transition-all hover:shadow-md`}
                onClick={() => setSelectedCall(isExpanded ? null : call.id)}
              >
                <CardContent className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm bg-white`}>
                        {mood.emoji}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">
                            {new Date(call.started_at).toLocaleDateString("en-US", {
                              weekday: "long",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="text-gray-400">·</span>
                          <span className="text-sm text-gray-500">
                            {new Date(call.started_at).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="w-3 h-3" />
                          {formatDuration(call.duration_seconds)}
                          {hasTranscript && (
                            <>
                              <span className="text-gray-300">·</span>
                              <MessageCircle className="w-3 h-3" />
                              Transcript
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge className={`rounded-full ${mood.color}`}>
                        {mood.label}
                      </Badge>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>

                  {/* Summary */}
                  {call.summary && (
                    <p className="text-sm text-gray-700 mt-3 line-clamp-2">
                      {call.summary}
                    </p>
                  )}

                  {/* Badges */}
                  <div className="flex items-center gap-2 mt-3">
                    {call.medication_confirmed && (
                      <Badge variant="outline" className="rounded-full bg-green-100 text-green-700 border-green-300 text-xs">
                        <Heart className="w-3 h-3 mr-1" /> Meds taken
                      </Badge>
                    )}
                    {hasMemories && (
                      <Badge variant="outline" className="rounded-full bg-amber-100 text-amber-700 border-amber-300 text-xs">
                        <Sparkles className="w-3 h-3 mr-1" /> {call.memories_extracted?.length} story
                      </Badge>
                    )}
                    {call.concern_flags && call.concern_flags.length > 0 && (
                      <Badge variant="outline" className="rounded-full bg-red-100 text-red-700 border-red-300 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" /> {call.concern_flags.length} note
                      </Badge>
                    )}
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 mt-4 border-t border-gray-200 space-y-4">
                          {/* Transcript */}
                          {hasTranscript && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <MessageCircle className="w-4 h-4" />
                                Transcript
                              </h4>
                              <div className="bg-white/70 rounded-xl p-4 max-h-48 overflow-y-auto">
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                  {call.transcript}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Memories */}
                          {hasMemories && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-500" />
                                Captured Memories
                              </h4>
                              <div className="space-y-2">
                                {call.memories_extracted?.map((memory: any, idx: number) => (
                                  <div key={idx} className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                                    <p className="text-sm font-medium text-amber-900">{memory.title}</p>
                                    <p className="text-sm text-amber-800 mt-1">{memory.text}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Concerns */}
                          {call.concern_flags && call.concern_flags.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                Notes
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {call.concern_flags.map((flag, idx) => (
                                  <Badge key={idx} variant="outline" className="rounded-full bg-red-50 text-red-700 border-red-200">
                                    {flag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 pt-2">
                            <Button variant="outline" size="sm" className="rounded-full">
                              <Play className="w-4 h-4 mr-2" /> Replay
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
