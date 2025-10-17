"use client"

import type React from "react"

import { useEffect, useState, useRef } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import type { Participant, Message, Session, Team } from "@/lib/types"
import { garbleMessage, getRoleDisplayName, getRoleColor } from "@/lib/garbling"
import { Spinner } from "@/components/ui/spinner"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

const QUESTIONS = [
  "What is the primary market opportunity?",
  "What are the key operational challenges?",
  "What is the financial projection for Year 1?",
  "What is the recommended marketing strategy?",
]

export default function PlayPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pin = params.pin as string
  const participantId = searchParams.get("participantId")

  const [session, setSession] = useState<Session | null>(null)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [messageInput, setMessageInput] = useState("")
  const [isCodeSwitched, setIsCodeSwitched] = useState(false)
  const [answers, setAnswers] = useState<string[]>(["", "", "", ""])
  const [timeRemaining, setTimeRemaining] = useState(900)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Timer countdown
  useEffect(() => {
    if (!session || session.status !== "in_progress" || !session.started_at) return

    const startTime = new Date(session.started_at).getTime()
    const duration = session.timer_duration * 1000

    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = now - startTime
      const remaining = Math.max(0, Math.floor((duration - elapsed) / 1000))

      setTimeRemaining(remaining)

      if (remaining === 0) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [session])

  useEffect(() => {
    if (!participantId) {
      router.push("/")
      return
    }

    const supabase = createClient()

    const fetchData = async () => {
      try {
        // Get session
        const { data: sessionData, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("game_pin", pin)
          .single()

        if (sessionError) throw sessionError
        setSession(sessionData)

        // Get current participant
        const { data: participantData, error: participantError } = await supabase
          .from("participants")
          .select("*")
          .eq("id", participantId)
          .single()

        if (participantError) throw participantError
        setParticipant(participantData)

        // Get team if assigned
        if (participantData.team_id) {
          const { data: teamData, error: teamError } = await supabase
            .from("teams")
            .select("*")
            .eq("id", participantData.team_id)
            .single()

          if (teamError) throw teamError
          setTeam(teamData)

          // Get team participants
          const { data: teamParticipants, error: teamParticipantsError } = await supabase
            .from("participants")
            .select("*")
            .eq("team_id", participantData.team_id)

          if (teamParticipantsError) throw teamParticipantsError
          setParticipants(teamParticipants)

          // Get messages for this team
          const { data: messagesData, error: messagesError } = await supabase
            .from("messages")
            .select("*")
            .eq("team_id", participantData.team_id)
            .order("timestamp", { ascending: true })

          if (messagesError) throw messagesError
          setMessages(messagesData)
        }

        setLoading(false)
      } catch (err) {
        console.error("[v0] Error fetching data:", err)
        setLoading(false)
      }
    }

    fetchData()

    // Subscribe to messages
    const messagesChannel = supabase
      .channel(`messages-${participantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new as Message
          if (newMessage.team_id === participant?.team_id) {
            setMessages((prev) => [...prev, newMessage])
          }
        },
      )
      .subscribe()

    // Subscribe to participant updates (role assignments)
    const participantsChannel = supabase
      .channel(`participants-${participantId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "participants",
        },
        () => {
          fetchData()
        },
      )
      .subscribe()

    // Subscribe to session updates
    const sessionChannel = supabase
      .channel(`session-${pin}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
        },
        (payload) => {
          const updatedSession = payload.new as Session
          setSession(updatedSession)

          if (updatedSession.status === "completed") {
            router.push(`/session/${pin}/completed`)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(messagesChannel)
      supabase.removeChannel(participantsChannel)
      supabase.removeChannel(sessionChannel)
    }
  }, [pin, participantId, router, participant?.team_id])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim() || !participant?.team_id) return

    const supabase = createClient()

    try {
      await supabase.from("messages").insert({
        session_id: session!.id,
        team_id: participant.team_id,
        participant_id: participant.id,
        content: messageInput.trim(),
        is_code_switched: isCodeSwitched,
      })

      setMessageInput("")
      setIsCodeSwitched(false)
    } catch (err) {
      console.error("[v0] Error sending message:", err)
    }
  }

  const handleSubmitAnswers = async () => {
    if (!participant?.team_id || participant.role !== "CEO") return

    const supabase = createClient()

    try {
      // Submit all 4 answers
      const answersToInsert = answers.map((answer, index) => ({
        session_id: session!.id,
        team_id: participant.team_id!,
        question_number: index + 1,
        answer_text: answer,
        submitted_by: participant.id,
      }))

      await supabase.from("answers").upsert(answersToInsert)

      alert("Answers submitted successfully!")
    } catch (err) {
      console.error("[v0] Error submitting answers:", err)
      alert("Failed to submit answers")
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!participant?.role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Waiting for Role Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Spinner className="h-5 w-5" />
              <p className="text-muted-foreground">The facilitator is assigning roles...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const isCEO = participant.role === "CEO"

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="border-b bg-white p-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold">Team {team?.team_number}</h1>
              <p className="text-sm text-muted-foreground">{participant.name}</p>
            </div>
            <Badge className={`${getRoleColor(participant.role)} text-white`}>
              {getRoleDisplayName(participant.role)}
            </Badge>
            {!participant.is_native_speaker && <Badge variant="outline">Non-Native Speaker</Badge>}
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Time Remaining</p>
            <p className="text-2xl font-bold">{formatTime(timeRemaining)}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-4 overflow-hidden p-4">
        {/* Chat Area */}
        <Card className="flex flex-1 flex-col">
          <CardHeader>
            <CardTitle>Team Chat</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4 overflow-hidden">
            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border bg-muted/30 p-4">
              {messages.map((message) => {
                const sender = participants.find((p) => p.id === message.participant_id)
                const garbledContent = garbleMessage(
                  message.content,
                  sender?.role || null,
                  sender?.is_native_speaker || null,
                  participant.role,
                  participant.is_native_speaker,
                  message.is_code_switched,
                )

                const isOwnMessage = message.participant_id === participant.id

                return (
                  <div key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${isOwnMessage ? "bg-primary text-primary-foreground" : "bg-background"}`}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <p className="text-xs font-semibold">{sender?.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {getRoleDisplayName(sender?.role || null)}
                        </Badge>
                        {message.is_code_switched && (
                          <Badge variant="secondary" className="text-xs">
                            [Native Language]
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm">{garbledContent}</p>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
              {!participant.is_native_speaker && (
                <div className="flex items-center gap-2">
                  <Switch id="code-switch" checked={isCodeSwitched} onCheckedChange={setIsCodeSwitched} />
                  <Label htmlFor="code-switch" className="text-sm">
                    Use native language (will be garbled to native speakers)
                  </Label>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1"
                />
                <Button type="submit">Send</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Answers Panel (CEO Only) */}
        {isCEO && (
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Submit Answers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {QUESTIONS.map((question, index) => (
                <div key={index} className="space-y-2">
                  <Label className="text-sm font-semibold">
                    {index + 1}. {question}
                  </Label>
                  <Textarea
                    value={answers[index]}
                    onChange={(e) => {
                      const newAnswers = [...answers]
                      newAnswers[index] = e.target.value
                      setAnswers(newAnswers)
                    }}
                    placeholder="Enter answer..."
                    rows={3}
                  />
                </div>
              ))}
              <Button onClick={handleSubmitAnswers} className="w-full" size="lg">
                Submit All Answers
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
