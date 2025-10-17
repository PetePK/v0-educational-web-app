"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import type { Participant, Session } from "@/lib/types"
import { Spinner } from "@/components/ui/spinner"

export default function WaitingRoomPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pin = params.pin as string
  const participantId = searchParams.get("participantId")

  const [session, setSession] = useState<Session | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Fetch initial session and participants
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

        // Get participants
        const { data: participantsData, error: participantsError } = await supabase
          .from("participants")
          .select("*")
          .eq("session_id", sessionData.id)
          .order("joined_at", { ascending: true })

        if (participantsError) throw participantsError
        setParticipants(participantsData)

        // If session already started, redirect to play
        if (sessionData.status === "in_progress") {
          router.push(`/session/${pin}/play?participantId=${participantId}`)
        }
      } catch (err) {
        console.error("[v0] Error fetching data:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Subscribe to participants changes
    const participantsChannel = supabase
      .channel(`participants-${pin}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${session?.id}`,
        },
        () => {
          fetchData()
        },
      )
      .subscribe()

    // Subscribe to session status changes
    const sessionChannel = supabase
      .channel(`session-${pin}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `game_pin=eq.${pin}`,
        },
        (payload) => {
          const updatedSession = payload.new as Session
          setSession(updatedSession)

          // Redirect when session starts
          if (updatedSession.status === "in_progress") {
            router.push(`/session/${pin}/play?participantId=${participantId}`)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(participantsChannel)
      supabase.removeChannel(sessionChannel)
    }
  }, [pin, participantId, router, session?.id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Waiting Room</CardTitle>
          <CardDescription className="text-lg">
            Game PIN: <span className="font-mono text-2xl font-bold text-foreground">{pin}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center justify-center gap-2">
            <Spinner className="h-5 w-5" />
            <p className="text-muted-foreground">Waiting for facilitator to start the session...</p>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-4 font-semibold">Participants ({participants.length})</h3>
            <div className="flex flex-col gap-2">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className={`rounded-md border p-3 ${
                    participant.id === participantId ? "border-primary bg-primary/5" : "bg-background"
                  }`}
                >
                  <p className="font-medium">{participant.name}</p>
                  {participant.id === participantId && <p className="text-xs text-muted-foreground">You</p>}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
