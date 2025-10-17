"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import type { Participant, Session, Team } from "@/lib/types"
import { Spinner } from "@/components/ui/spinner"
import { getRoleDisplayName, getRoleColor } from "@/lib/garbling"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function FacilitatorSessionPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [session, setSession] = useState<Session | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const fetchData = async () => {
      try {
        // Get session
        const { data: sessionData, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .single()

        if (sessionError) throw sessionError
        setSession(sessionData)

        // Get participants
        const { data: participantsData, error: participantsError } = await supabase
          .from("participants")
          .select("*")
          .eq("session_id", sessionId)
          .order("joined_at", { ascending: true })

        if (participantsError) throw participantsError
        setParticipants(participantsData)

        // Get teams
        const { data: teamsData, error: teamsError } = await supabase
          .from("teams")
          .select("*")
          .eq("session_id", sessionId)
          .order("team_number", { ascending: true })

        if (teamsError) throw teamsError
        setTeams(teamsData || [])

        setLoading(false)
      } catch (err) {
        console.error("[v0] Error fetching data:", err)
        setLoading(false)
      }
    }

    fetchData()

    // Subscribe to participants changes
    const participantsChannel = supabase
      .channel(`facilitator-participants-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          fetchData()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(participantsChannel)
    }
  }, [sessionId])

  const canFormTeams = (count: number): boolean => {
    // Check if count can be divided into groups of 4 or 5
    if (count < 4) return false

    // Try to form teams
    let remaining = count
    while (remaining >= 4) {
      if (remaining === 4 || remaining === 5) return true
      if (remaining % 5 === 0) return true
      if (remaining % 4 === 0) return true

      // Try removing a team of 5
      if (remaining >= 5) {
        remaining -= 5
      } else {
        remaining -= 4
      }
    }

    return remaining === 0
  }

  const handleAssignRoles = async () => {
    const supabase = createClient()

    try {
      // Validate participant count
      if (!canFormTeams(participants.length)) {
        setValidationError(`Cannot form teams with ${participants.length} participants. Need groups of 4-5 people.`)
        return
      }

      setValidationError(null)

      // Form teams
      const teamsToCreate: { session_id: string; team_number: number }[] = []
      let teamNumber = 1
      let remaining = participants.length

      while (remaining > 0) {
        if (remaining === 5 || remaining % 5 === 0) {
          teamsToCreate.push({ session_id: sessionId, team_number: teamNumber })
          remaining -= 5
        } else {
          teamsToCreate.push({ session_id: sessionId, team_number: teamNumber })
          remaining -= 4
        }
        teamNumber++
      }

      // Create teams
      const { data: createdTeams, error: teamsError } = await supabase.from("teams").insert(teamsToCreate).select()

      if (teamsError) throw teamsError

      // Assign participants to teams with roles
      const participantUpdates = []
      let participantIndex = 0

      for (const team of createdTeams) {
        const teamSize = participantIndex + 5 <= participants.length ? 5 : 4

        for (let i = 0; i < teamSize; i++) {
          const participant = participants[participantIndex]
          let role
          let isNative

          // First 2 are native speakers
          if (i === 0) {
            role = "CEO"
            isNative = true
          } else if (i === 1) {
            role = "VP_Operations"
            isNative = true
          } else if (i === 2) {
            role = "VP_Finance"
            isNative = false
          } else if (i === 3) {
            role = "VP_Marketing"
            isNative = false
          } else {
            // 5th person if exists
            role = "VP_Marketing"
            isNative = false
          }

          participantUpdates.push({
            id: participant.id,
            team_id: team.id,
            role,
            is_native_speaker: isNative,
          })

          participantIndex++
        }
      }

      // Update all participants
      for (const update of participantUpdates) {
        await supabase.from("participants").update(update).eq("id", update.id)
      }

      alert("Roles assigned successfully!")
    } catch (err) {
      console.error("[v0] Error assigning roles:", err)
      alert("Failed to assign roles")
    }
  }

  const handleStartSession = async () => {
    if (!session) return

    const supabase = createClient()

    try {
      await supabase
        .from("sessions")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
        })
        .eq("id", sessionId)

      alert("Session started!")
    } catch (err) {
      console.error("[v0] Error starting session:", err)
      alert("Failed to start session")
    }
  }

  const handleEndSession = async () => {
    if (!session) return

    const supabase = createClient()

    try {
      await supabase
        .from("sessions")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
        })
        .eq("id", sessionId)

      router.push(`/facilitator/session/${sessionId}/debrief`)
    } catch (err) {
      console.error("[v0] Error ending session:", err)
      alert("Failed to end session")
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const hasRoles = participants.some((p) => p.role !== null)
  const isWaiting = session?.status === "waiting"
  const isInProgress = session?.status === "in_progress"

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl font-bold">Session Control</CardTitle>
                <CardDescription className="mt-2 text-lg">
                  Game PIN: <span className="font-mono text-2xl font-bold text-foreground">{session?.game_pin}</span>
                </CardDescription>
              </div>
              <Badge
                variant={isWaiting ? "secondary" : isInProgress ? "default" : "outline"}
                className="text-lg px-4 py-2"
              >
                {session?.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex gap-4">
            {isWaiting && !hasRoles && (
              <Button onClick={handleAssignRoles} size="lg" disabled={participants.length < 4}>
                Assign Roles & Form Teams
              </Button>
            )}
            {isWaiting && hasRoles && (
              <Button onClick={handleStartSession} size="lg">
                Start Session
              </Button>
            )}
            {isInProgress && (
              <>
                <Button onClick={handleEndSession} size="lg" variant="destructive">
                  End Session
                </Button>
                <Button
                  onClick={() => router.push(`/facilitator/session/${sessionId}/monitor`)}
                  size="lg"
                  variant="outline"
                >
                  Monitor Teams
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {validationError && (
          <Alert variant="destructive">
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        {/* Participants */}
        <Card>
          <CardHeader>
            <CardTitle>Participants ({participants.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {teams.length > 0 ? (
              <div className="space-y-6">
                {teams.map((team) => {
                  const teamParticipants = participants.filter((p) => p.team_id === team.id)
                  return (
                    <div key={team.id} className="rounded-lg border bg-card p-4">
                      <h3 className="mb-3 font-semibold">Team {team.team_number}</h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {teamParticipants.map((participant) => (
                          <div
                            key={participant.id}
                            className="flex items-center gap-3 rounded-md border bg-background p-3"
                          >
                            <div className="flex-1">
                              <p className="font-medium">{participant.name}</p>
                              {participant.role && (
                                <div className="mt-1 flex items-center gap-2">
                                  <Badge className={`${getRoleColor(participant.role)} text-white text-xs`}>
                                    {getRoleDisplayName(participant.role)}
                                  </Badge>
                                  {participant.is_native_speaker !== null && (
                                    <Badge variant="outline" className="text-xs">
                                      {participant.is_native_speaker ? "Native" : "Non-Native"}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {participants.map((participant) => (
                  <div key={participant.id} className="rounded-md border bg-background p-3">
                    <p className="font-medium">{participant.name}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
