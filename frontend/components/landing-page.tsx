"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Phone, ArrowRight, Calendar, Heart, Smile, BookOpen, Shield, MessageCircle, Sparkles, Clock, Users, Play } from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.15
    }
  }
}

// Emotional image URLs from Unsplash
const images = {
    // Hero: warm, human, direct, believable
    hero: "https://images.pexels.com/photos/7477721/pexels-photo-7477721.jpeg?auto=compress&cs=tinysrgb&w=1400",

    // Problem / connection card
    connection: "https://images.pexels.com/photos/7232037/pexels-photo-7232037.jpeg?auto=compress&cs=tinysrgb&w=1200",

    // Memory keeper
    memories: "https://images.pexels.com/photos/8307521/pexels-photo-8307521.jpeg?auto=compress&cs=tinysrgb&w=1200",

    // Family / generational warmth
    family: "https://images.pexels.com/photos/7117617/pexels-photo-7117617.jpeg?auto=compress&cs=tinysrgb&w=1200",

    // Story/testimonial section
    phone: "https://images.pexels.com/photos/7117618/pexels-photo-7117618.jpeg?auto=compress&cs=tinysrgb&w=1200",

    // Calm lifestyle / presence
    elderly: "https://images.pexels.com/photos/7394789/pexels-photo-7394789.jpeg?auto=compress&cs=tinysrgb&w=1200",
}

export function LandingPage() {
  return (
    <main className="min-h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Hero Section */}
        {/* Hero Section */}
        <section className="relative">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

            <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24">
                <motion.div
                    className="grid gap-8 md:grid-cols-[minmax(0,1fr)_380px] md:items-center"
                    initial="initial"
                    animate="animate"
                    variants={staggerContainer}
                >
                    {/* CHANGED: Left content card stays in column 1 */}
                    <motion.div
                        className="paper-card p-8 md:p-12 relative overflow-hidden"
                        variants={fadeInUp}
                    >
                        {/* Decorative element */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                        <span className="sage-pill text-xs font-mono mb-4 inline-block relative">
          AI-POWERED HEALTH COMPANION FOR SINGAPORE&apos;S ELDERLY
        </span>

                        <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading md:text-4xl lg:text-5xl leading-tight relative">
                            Managing chronic conditions
                            <span className="block text-primary">shouldn&apos;t be lonely.</span>
                            <span className="block mt-2">HealthLah is here.</span>
                        </h1>

                        <p className="mt-6 text-muted-foreground text-lg leading-relaxed max-w-xl">
                            HealthLah is the daily health check-in your elderly loved ones deserve.
                            A warm, multilingual AI voice that monitors their conditions,
                            reminds them about medications, and alerts you when something&apos;s off.
                        </p>

                        <div className="mt-8 flex flex-wrap gap-3">
                            <Button
                                asChild
                                size="lg"
                                className="rounded-[28px] bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                            >
                                <Link href="/dashboard">
                                    <Phone className="mr-2 h-5 w-5" />
                                    Start Caring
                                </Link>
                            </Button>

                            <Button
                                asChild
                                variant="outline"
                                size="lg"
                                className="rounded-[28px] border-border hover:bg-secondary transition-all"
                            >
                                <Link href="/#how-it-works">
                                    See how it works
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </div>

                        {/* Trust indicators */}
                        <div className="mt-10 pt-8 border-t border-border/50 grid grid-cols-3 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-primary font-heading">1.8M</div>
                                <div className="text-xs text-muted-foreground font-mono mt-1">Chronic patients in SG</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-primary font-heading">4 Languages</div>
                                <div className="text-xs text-muted-foreground font-mono mt-1">EN, 华语, BM, Tamil</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-primary font-heading">24/7</div>
                                <div className="text-xs text-muted-foreground font-mono mt-1">Health monitoring</div>
                            </div>
                        </div>
                    </motion.div>

                    {/* CHANGED: Image card moved OUTSIDE the left card so it becomes column 2 */}
                    <motion.div className="relative" variants={fadeInUp}>
                        <div className="paper-card overflow-hidden p-0 aspect-[4/5] max-h-[520px] relative">
                            <Image
                                src={images.hero}
                                alt="Elderly person smiling while talking on phone - warm connection"
                                fill
                                className="object-cover"
                                priority
                            />

                            {/* Overlay gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />

                            {/* Floating card */}
                            <motion.div
                                className="absolute bottom-6 left-4 right-4 paper-card p-4"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.8, duration: 0.6 }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                        <Play className="h-4 w-4 text-primary fill-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">
                                            &ldquo;Good morning! How did you sleep?&rdquo;
                                        </p>
                                        <p className="text-xs text-muted-foreground">HealthLah • Daily check-in</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </section>

      {/* The Problem / Emotional Hook */}
      <section className="border-t border-border bg-secondary/20 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div 
            className="max-w-3xl mx-auto text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl font-bold text-foreground font-heading md:text-3xl lg:text-4xl">
              Chronic disease management
              <span className="block text-primary mt-2">needs a daily companion.</span>
            </h2>
            <p className="mt-6 text-muted-foreground text-lg leading-relaxed">
              1.8 million Singaporeans live with chronic conditions like diabetes, hypertension, and kidney disease.
              Many are elderly, multilingual, and managing complex medication schedules alone.
            </p>
            <p className="mt-4 text-muted-foreground">
              HealthLah bridges the gap between clinic visits with daily AI-powered check-ins
              in their preferred language. Powered by MERaLiON AudioLLM.
            </p>
          </motion.div>

          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: Clock,
                image: images.connection,
                title: "Daily health check-in",
                desc: "Blood sugar readings, blood pressure, sleep quality. Gentle monitoring that catches issues before they escalate."
              },
              {
                icon: Heart,
                image: images.elderly,
                title: "Medication adherence",
                desc: "Timely reminders for Metformin, Amlodipine, Insulin. In Mandarin, English, Malay, or Tamil."
              },
              {
                icon: Shield,
                image: images.memories,
                title: "Caregiver alerts",
                desc: "Missed medications, unusual symptoms, mood changes. Your family gets notified instantly."
              }
            ].map((item, i) => (
              <motion.div 
                key={item.title}
                className="paper-card overflow-hidden group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="relative h-48 overflow-hidden">
                    <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
                    />
                  <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
                </div>
                <div className="p-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground font-heading">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 md:py-24 bg-background">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div 
            className="text-center max-w-2xl mx-auto mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl font-bold text-foreground font-heading md:text-3xl">
              Getting started takes minutes.
              <span className="block text-muted-foreground font-normal text-lg mt-2">Better health monitoring starts today.</span>
            </h2>
          </motion.div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "1",
                title: "Register patient",
                desc: "Add your loved one's details — conditions, medications, preferred language, and emergency contacts.",
                cta: "Register Patient",
                href: "/register-patient"
              },
              {
                step: "2",
                title: "Daily voice calls",
                desc: "HealthLah calls them daily in their preferred language to check vitals, medication adherence, and wellbeing.",
                cta: "See Dashboard",
                href: "/dashboard"
              },
              {
                step: "3",
                title: "AI monitors health",
                desc: "Our AI analyses each conversation for warning signs — missed medications, unusual symptoms, mood changes.",
                cta: "Learn More",
                href: "/#features"
              },
              {
                step: "4",
                title: "Caregivers get alerts",
                desc: "Family members and doctors receive real-time notifications when something needs attention.",
                cta: "Add Caregiver",
                href: "/create-caregiver"
              }
            ].map((item, i) => (
              <motion.div
                key={item.step}
                className="relative"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
              >
                <div className="paper-card p-8 h-full flex flex-col">
                  <span className="sage-pill font-mono text-xs">{item.step}</span>
                  <h3 className="mt-4 font-semibold text-foreground font-heading text-xl">{item.title}</h3>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed flex-grow">{item.desc}</p>
                  <Button asChild variant="outline" size="sm" className="mt-6 rounded-[28px] w-full">
                    <Link href={item.href}>{item.cta}</Link>
                  </Button>
                </div>
                {i < 3 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <ArrowRight className="h-5 w-5 text-muted-foreground/30" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features with emotion */}
      <section id="features" className="border-t border-border bg-secondary/20 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-2xl font-bold text-foreground font-heading md:text-3xl lg:text-4xl">
                More than technology.
                <span className="block text-primary mt-2">It&apos;s healthcare that cares.</span>
              </h2>
              <p className="mt-6 text-muted-foreground leading-relaxed">
                Built for Singapore&apos;s multilingual elderly population.
                Every call is an opportunity to catch health issues early and keep families informed.
              </p>
            </motion.div>
            <motion.div
              className="relative h-64 rounded-[28px] overflow-hidden"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Image
                src={images.family}
                alt="Family connection across generations"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent" />
            </motion.div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Phone,
                title: "Multilingual AI calls",
                desc: "Powered by MERaLiON AudioLLM. Speaks English, Mandarin, Malay, Tamil, and common dialects like Hokkien and Cantonese."
              },
              {
                icon: Heart,
                title: "Chronic disease monitoring",
                desc: "Tracks diabetes markers, blood pressure trends, kidney function symptoms. Catches warning signs between clinic visits."
              },
              {
                icon: Smile,
                title: "Medication adherence",
                desc: "Gentle daily reminders for complex regimens — Metformin, Amlodipine, Insulin Glargine — woven naturally into conversation."
              },
              {
                icon: Calendar,
                title: "Appointment reminders",
                desc: "Polyclinic visits, specialist appointments, blood tests. HealthLah keeps track so they never miss a date."
              },
              {
                icon: MessageCircle,
                title: "Family dashboard",
                desc: "After each call, caregivers get a summary — vitals reported, medications taken, mood assessment, and any concern flags."
              },
              {
                icon: Shield,
                title: "PDPA compliant",
                desc: "Built with Singapore's Personal Data Protection Act in mind. Health data stays secure and belongs to your family."
              }
            ].map((feature, i) => (
              <motion.div 
                key={feature.title}
                className="flex gap-4 rounded-[28px] border border-border bg-card p-6 hover:shadow-lg transition-all duration-300 group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                  <feature.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground font-heading">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Story/Testimonial Section */}
      <section className="py-16 md:py-24 bg-background overflow-hidden">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="paper-card p-8 md:p-10 bg-gradient-to-br from-primary/5 to-transparent">
                <Sparkles className="h-8 w-8 text-primary mb-6" />
                <blockquote className="text-xl md:text-2xl font-heading text-foreground italic leading-relaxed">
                  &ldquo;My father has diabetes and hypertension. HealthLah calls him every morning
                  in Mandarin to check if he took his medicine. Last week it flagged that he
                  was feeling dizzy — we got him to the polyclinic before it got worse.&rdquo;
                </blockquote>
                <div className="mt-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Mei Ling T.</p>
                    <p className="text-sm text-muted-foreground">Daughter, Toa Payoh</p>
                  </div>
                </div>
              </div>
            </motion.div>
            
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="relative h-80 rounded-[28px] overflow-hidden">
                  <Image
                      src={images.elderly}
                      alt="Senior woman smiling while using her phone at home"
                      fill
                      className="object-cover object-center"
                  />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
              </div>
              <div className="absolute -bottom-6 -left-6 paper-card p-4 max-w-xs">
                <p className="text-sm text-muted-foreground italic">
                  &ldquo;Every morning she calls me, ask about my blood sugar, remind me take medicine.
                  Like having a kaki who really cares about my health.&rdquo;
                </p>
                <p className="text-xs text-primary mt-2 font-medium">— Mr. Tan, 67</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Why HealthLah */}
      <section id="why-healthlah" className="border-t border-border bg-secondary/30 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div 
            className="text-center max-w-2xl mx-auto mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl font-bold text-foreground font-heading md:text-3xl">
              Because healthcare
              <span className="block text-primary mt-2">doesn&apos;t stop at the clinic.</span>
            </h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Sparkles,
                title: "Powered by MERaLiON",
                desc: "Built on Singapore's own MERaLiON AudioLLM — AI that understands our accents, our languages, and our cultural context."
              },
              {
                icon: BookOpen,
                title: "Between-visit monitoring",
                desc: "Chronic conditions need daily attention, not just quarterly check-ups. HealthLah fills the gaps between polyclinic visits."
              },
              {
                icon: Heart,
                title: "Peace of mind for families",
                desc: "Know that someone checked on your parents today. Get alerts when something needs attention, not just when it's too late."
              }
            ].map((item, i) => (
              <motion.div 
                key={item.title}
                className="paper-card p-8 group hover:shadow-xl transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                  <item.icon className="h-7 w-7 text-primary group-hover:text-primary-foreground transition-colors" />
                </div>
                <h3 className="font-semibold text-foreground font-heading text-xl">{item.title}</h3>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-20 md:py-28 bg-background overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/5 pointer-events-none" />
        
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold text-foreground font-heading md:text-4xl lg:text-5xl">
              Your Health Matters, Lah!
            </h2>
            <p className="mt-4 text-2xl md:text-3xl font-heading text-primary">
              Better chronic disease care starts with a daily call.
            </p>
            <p className="mt-6 text-muted-foreground max-w-xl mx-auto text-lg">
              Register your loved one in five minutes. HealthLah will start monitoring their
              health daily — in their language, on their schedule, with alerts to your phone.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Button asChild size="lg" className="rounded-[28px] bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 px-8">
                <Link href="/register-patient">
                  <Heart className="mr-2 h-5 w-5" />
                  Start Free Today
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-[28px] px-8">
                <Link href="/dashboard">View Dashboard</Link>
              </Button>
            </div>
            <p className="mt-8 text-xs text-muted-foreground font-mono">
              No credit card required. Set up in minutes. Cancel anytime.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer quote */}
      <section className="border-t border-border bg-secondary/30 py-12">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <p className="text-sm text-muted-foreground font-mono">
            Made in Singapore for families managing chronic health conditions.
          </p>
        </div>
      </section>
    </main>
  )
}
