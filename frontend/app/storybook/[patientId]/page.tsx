"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  BookOpen, 
  ArrowLeft, 
  Calendar, 
  Heart, 
  Sparkles,
  ChevronRight,
  Clock,
  Quote,
  Phone
} from "lucide-react"
import { motion } from "framer-motion"

// Beautiful hardcoded memories for Mr. Tan - no nulls, everything has content
const PATIENT_MEMORIES = [
  // Passions & Pastimes
  {
    id: "mem-1",
    patient_id: "mr-tan",
    call_id: "call-1",
    memory_text: "Mentioned enjoying time in the garden and checking on flowers. She said the tulips are starting to bloom early this year, just like they did when she was a child in Bedok. She remembers her mother teaching her the names of all the flowers.",
    category: "hobby",
    date_mentioned: "1965-04-15",
    sentiment: "positive",
    created_at: "2026-03-15T10:30:00Z"
  },
  {
    id: "mem-2",
    patient_id: "mr-tan",
    call_id: "call-2",
    memory_text: "Shared that she used to knit sweaters for all her students at Christmas. Each one took three weeks, and she would stay up late after grading papers to finish them. The children would write thank you notes that she still keeps in a box.",
    category: "hobby",
    date_mentioned: "1970-12-20",
    sentiment: "positive",
    created_at: "2026-03-14T09:15:00Z"
  },
  // Kitchen Memories
  {
    id: "mem-3",
    patient_id: "mr-tan",
    call_id: "call-3",
    memory_text: "Talked about a favourite family recipe for butter tarts that came from her grandmother. The secret is a pinch of maple syrup in the filling. She made them every Sunday for forty years, and his wife would always eat two with his afternoon tea.",
    category: "food",
    date_mentioned: "1958-11-10",
    sentiment: "positive",
    created_at: "2026-03-13T14:20:00Z"
  },
  {
    id: "mem-4",
    patient_id: "mr-tan",
    call_id: "call-4",
    memory_text: "Recalled learning to make bread during the winter of 1962 when the roads were impassable for three weeks. The whole house smelled of yeast and warmth. She says that was when she truly understood the meaning of comfort food.",
    category: "food",
    date_mentioned: "1962-01-15",
    sentiment: "nostalgic",
    created_at: "2026-03-12T11:45:00Z"
  },
  // Working Years
  {
    id: "mem-5",
    patient_id: "mr-tan",
    call_id: "call-5",
    memory_text: "It was 1967 — I was twenty-two and completely terrified. The schoolhouse had one room, thirty-four children across six grades, and a woodstove that I never did learn to light properly. But that was the proudest year of my life. I think about those children still.",
    category: "work",
    date_mentioned: "1967-09-01",
    sentiment: "nostalgic",
    created_at: "2026-03-10T16:00:00Z"
  },
  {
    id: "mem-6",
    patient_id: "mr-tan",
    call_id: "call-6",
    memory_text: "Remembered little Sarah with the pigtails who brought her apples every Friday. Sarah's family was poor, and those apples were precious. Years later, Sarah became a nurse and sent Mr. Tan a letter saying she was the reason Sarah believed in kindness.",
    category: "work",
    date_mentioned: "1968-05-10",
    sentiment: "positive",
    created_at: "2026-03-08T13:30:00Z"
  },
  // Family Stories
  {
    id: "mem-7",
    patient_id: "mr-tan",
    call_id: "call-7",
    memory_text: "Spoke about his wife's proposal at the church social in 1963. He was so nervous he dropped the ring in the punch bowl. Everyone laughed, and they drank the punch anyway, carefully. They were married six months later in the same church.",
    category: "family",
    date_mentioned: "1963-06-15",
    sentiment: "positive",
    created_at: "2026-03-11T10:00:00Z"
  },
  {
    id: "mem-8",
    patient_id: "mr-tan",
    call_id: "call-8",
    memory_text: "Recalled her son's first steps during a thunderstorm. The power was out, and they were huddled by candlelight when little Thomas let go of the sofa and walked three whole steps to his father. The thunder clapped right then, and they all cheered.",
    category: "family",
    date_mentioned: "1965-08-22",
    sentiment: "positive",
    created_at: "2026-03-09T09:45:00Z"
  },
  // Early Years
  {
    id: "mem-9",
    patient_id: "mr-tan",
    call_id: "call-9",
    memory_text: "Shared memories of her childhood home in Bedok. There was a willow tree in the backyard that she would read under for hours. She still has a book of poetry from those days, the pages soft as fabric from being read so many times.",
    category: "childhood",
    date_mentioned: "1948-07-10",
    sentiment: "nostalgic",
    created_at: "2026-03-07T14:15:00Z"
  },
  {
    id: "mem-10",
    patient_id: "mr-tan",
    call_id: "call-10",
    memory_text: "Remembered her father's hands — strong and calloused from working at the mill, but gentle when he braided her hair for church on Sundays. He would hum hymns while he worked, and she can still hear his voice when she closes her eyes.",
    category: "childhood",
    date_mentioned: "1950-03-05",
    sentiment: "nostalgic",
    created_at: "2026-03-06T11:30:00Z"
  },
  // Love & Romance
  {
    id: "mem-11",
    patient_id: "mr-tan",
    call_id: "call-11",
    memory_text: "Spoke about dancing with his wife in their living room on Saturday nights. They would put on the radio and dance until their feet hurt. Even after fifty years, he still looked at her the same way he did when they were young.",
    category: "love",
    date_mentioned: "1985-12-25",
    sentiment: "positive",
    created_at: "2026-03-05T16:45:00Z"
  },
  // Journeys Taken
  {
    id: "mem-12",
    patient_id: "mr-tan",
    call_id: "call-12",
    memory_text: "Recalled their trip to the Maritimes in 1978. They slept in a bed and breakfast where the ocean waves sounded like lullabies. his wife collected seashells for the children, and they still have one on the mantle — white and smooth as porcelain.",
    category: "travel",
    date_mentioned: "1978-08-15",
    sentiment: "positive",
    created_at: "2026-03-04T10:20:00Z"
  }
]

interface Memory {
  id: string
  patient_id: string
  call_id: string
  memory_text: string
  category: string | null
  date_mentioned: string | null
  sentiment: string | null
  created_at: string
}

interface Chapter {
  category: string
  title: string
  memories: Memory[]
  icon: string
  color: string
  description: string
}

const categoryConfig: Record<string, { title: string; icon: string; color: string; description: string }> = {
  hobby: { 
    title: "Passions & Pastimes", 
    icon: "🌱", 
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    description: "The activities that brought joy and meaning to everyday life"
  },
  food: { 
    title: "Kitchen Memories", 
    icon: "👨‍🍳", 
    color: "bg-amber-100 text-amber-700 border-amber-200",
    description: "Recipes, meals, and the love shared around the table"
  },
  family: { 
    title: "Family Stories", 
    icon: "👨‍👩‍👧‍👦", 
    color: "bg-blue-100 text-blue-700 border-blue-200",
    description: "Moments with loved ones that shaped a lifetime"
  },
  work: { 
    title: "Working Years", 
    icon: "📚", 
    color: "bg-purple-100 text-purple-700 border-purple-200",
    description: "A career dedicated to nurturing young minds"
  },
  travel: { 
    title: "Journeys Taken", 
    icon: "✈️", 
    color: "bg-teal-100 text-teal-700 border-teal-200",
    description: "Adventures near and far, memories from the road"
  },
  childhood: { 
    title: "Early Years", 
    icon: "🧸", 
    color: "bg-pink-100 text-pink-700 border-pink-200",
    description: "The foundations of a life well-lived"
  },
  love: { 
    title: "Love & Romance", 
    icon: "💕", 
    color: "bg-rose-100 text-rose-700 border-rose-200",
    description: "A love story that spanned decades"
  },
  default: { 
    title: "Life Stories", 
    icon: "📖", 
    color: "bg-primary/10 text-primary border-primary/20",
    description: "Moments and memories from a rich life"
  },
}

export default function HealthLogPage() {
  const params = useParams()
  const patientId = params.patientId as string
  
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [patientName, setPatientName] = useState("Mr. Tan Ah Kow")
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null)
  const [loading, setLoading] = useState(true)
  const [totalMemories, setTotalMemories] = useState(0)

  useEffect(() => {
    // Simulate loading and use hardcoded data
    const timer = setTimeout(() => {
      const memories = PATIENT_MEMORIES
      setTotalMemories(memories.length)
      
      // Group memories by category
      const grouped = memories.reduce((acc, memory) => {
        const category = memory.category || "default"
        if (!acc[category]) {
          acc[category] = []
        }
        acc[category].push(memory)
        return acc
      }, {} as Record<string, Memory[]>)

      // Convert to chapters
      const chaptersList: Chapter[] = Object.entries(grouped).map(([category, mems]) => {
        const config = categoryConfig[category] || categoryConfig.default
        return {
          category,
          title: config.title,
          memories: mems.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ),
          icon: config.icon,
          color: config.color,
          description: config.description,
        }
      })

      // Sort chapters by number of memories
      chaptersList.sort((a, b) => b.memories.length - a.memories.length)

      setChapters(chaptersList)
      setLoading(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [patientId])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Opening storybook...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/dashboard?patient=${patientId}`}>
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground font-heading flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-primary" />
                  {patientName}&apos;s Health Log
                </h1>
                <p className="text-sm text-muted-foreground">
                  A living memoir of {totalMemories} memories across {chapters.length} chapters
                </p>
              </div>
            </div>
            <Badge variant="outline" className="rounded-full px-4 py-1 bg-primary/5 border-primary/20">
              <Sparkles className="w-3 h-3 mr-1 text-primary" />
              Health Journal
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {selectedChapter ? (
          <ChapterView 
            chapter={selectedChapter} 
            onBack={() => setSelectedChapter(null)}
            patientName={patientName}
          />
        ) : (
          <div className="space-y-8">
            {/* Introduction */}
            <Card className="bg-gradient-to-br from-primary/5 via-amber-50/50 to-background border-primary/20 overflow-hidden">
              <CardContent className="p-8 relative">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-200/20 rounded-full blur-2xl" />
                
                <div className="relative flex items-start gap-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-4xl shadow-lg">
                    📖
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-foreground font-heading mb-3">
                      Health Journey
                    </h2>
                    <p className="text-muted-foreground leading-relaxed max-w-2xl mb-4">
                      Every conversation with {patientName} has been carefully preserved. These stories, 
                      captured through our daily calls, form a living memoir of a life filled with love, 
                      teaching, family, and the simple joys that make life beautiful.
                    </p>
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span>Collected since March 2026</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Heart className="w-4 h-4 text-primary" />
                        <span>{totalMemories} precious memories</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-4 h-4 text-primary" />
                        <span>From daily conversations</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Chapters Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {chapters.map((chapter, index) => (
                <motion.div
                  key={chapter.category}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card 
                    className="group cursor-pointer hover:shadow-xl transition-all duration-300 h-full border-2 hover:border-primary/20"
                    onClick={() => setSelectedChapter(chapter)}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className={`w-16 h-16 rounded-2xl ${chapter.color} flex items-center justify-center text-3xl border-2`}>
                          {chapter.icon}
                        </div>
                        <Badge variant="secondary" className="rounded-full">
                          {chapter.memories.length} stories
                        </Badge>
                      </div>
                      <CardTitle className="text-xl font-heading mt-4 group-hover:text-primary transition-colors">
                        {chapter.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {chapter.description}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-secondary/30 rounded-xl p-3 mb-4">
                        <p className="text-sm text-muted-foreground italic line-clamp-2">
                          &ldquo;{chapter.memories[0]?.memory_text.substring(0, 100)}...&rdquo;
                        </p>
                      </div>
                      <div className="flex items-center text-primary text-sm font-medium group-hover:gap-2 transition-all">
                        Read chapter
                        <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function ChapterView({ 
  chapter, 
  onBack,
  patientName 
}: { 
  chapter: Chapter
  onBack: () => void
  patientName: string
}) {
  const sentimentColors: Record<string, string> = {
    positive: "bg-green-100 text-green-700 border-green-200",
    nostalgic: "bg-blue-100 text-blue-700 border-blue-200",
    happy: "bg-amber-100 text-amber-700 border-amber-200",
    neutral: "bg-gray-100 text-gray-600 border-gray-200",
    negative: "bg-rose-100 text-rose-700 border-rose-200",
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Chapter Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={onBack} className="rounded-full">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className={`w-14 h-14 rounded-2xl ${chapter.color} flex items-center justify-center text-3xl border-2`}>
          {chapter.icon}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground font-heading">
            {chapter.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {chapter.memories.length} memories · {chapter.description}
          </p>
        </div>
      </div>

      {/* Memories Timeline */}
      <div className="space-y-6">
        {chapter.memories.map((memory, index) => (
          <motion.div
            key={memory.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <Card className="group hover:shadow-lg transition-shadow border-l-4 border-l-primary/30">
              <CardContent className="p-6">
                <div className="flex gap-5">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10">
                      <Quote className="w-5 h-5 text-primary" />
                    </div>
                    {index < chapter.memories.length - 1 && (
                      <div className="w-0.5 flex-1 bg-gradient-to-b from-primary/20 to-transparent mt-3 min-h-[40px]" />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      <Badge variant="outline" className="rounded-full text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(memory.created_at).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </Badge>
                      {memory.date_mentioned && (
                        <Badge variant="secondary" className="rounded-full text-xs">
                          Memory from {new Date(memory.date_mentioned).getFullYear()}
                        </Badge>
                      )}
                      {memory.sentiment && (
                        <Badge 
                          variant="outline" 
                          className={`rounded-full text-xs ${sentimentColors[memory.sentiment] || sentimentColors.neutral}`}
                        >
                          {memory.sentiment.charAt(0).toUpperCase() + memory.sentiment.slice(1)}
                        </Badge>
                      )}
                    </div>
                    <blockquote className="text-foreground text-lg leading-relaxed italic mb-4">
                      &ldquo;{memory.memory_text}&rdquo;
                    </blockquote>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                        {patientName.charAt(0)}
                      </div>
                      <span>— {patientName}, during a conversation</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
