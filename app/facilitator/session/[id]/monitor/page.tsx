"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import type { Participant, Message, Team } from "@/lib/types"
import { Spinner } from "@/components/ui/spinner"
import { getRoleDisplayName } from "@/lib/garbling"

export default function MonitorPage() {
  const params = useParams()
  const sessionId = params.id as string

  const [teams, setTeams] = useState<Team[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [messagesByTeam, setMessagesByTeam] = useState<Record<string, Message[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const fetchData = async () => {
      try {
        // Get teams
        const { data: teamsData, error: teamsError } = await supabase
          .from("teams")
          .select("*")
          .eq("session_id", sessionId)
          .order("team_number", { ascending: true })

        if (teamsError) throw teamsError
        setTeams(teamsData || [])

        // Get participants
        const { data: participantsData, error: participantsError } = await supabase
          .from("participants")
          .select("*")
          .eq("session_id", sessionId)

        if (participantsError) throw participantsError
        setParticipants(participantsData)

        // Get messages for all teams
        const { data: messagesData, error: messagesError } = await supabase
          .from("messages")
          .select("*")
          .eq("session_id", sessionId)
          .order("timestamp", { ascending: true })

        if (messagesError) throw messagesError

        // Group messages by team
        const grouped: Record<string, Message[]> = {}
        messagesData.forEach((msg) => {
          if (!grouped[msg.team_id]) {
            grouped[msg.team_id] = []
          }
          grouped[msg.team_id].push(msg)
        })
        setMessagesByTeam(grouped)

        setLoading(false)
      } catch (err) {
        console.error("[v0] Error fetching data:", err)
        setLoading(false)
      }
    }

    fetchData()

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel(`monitor-messages-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchData()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(messagesChannel)
    }
  }, [sessionId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="text-3xl font-bold">Live Team Monitoring</h1>

        <div className="grid gap-6 lg:grid-cols-2">
          {teams.map((team) => {
            const teamParticipants = participants.filter((p) => p.team_id === team.id)
            const messages = messagesByTeam[team.id] || []

            return (
              <Card key={team.id}>
                <CardHeader>
                  <CardTitle>Team {team.team_number}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {teamParticipants.map((p) => (
                      <Badge key={p.id} variant="outline">
                        {p.name} - {getRoleDisplayName(p.role)}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-3 h-64 overflow-y-auto">
                    {messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No messages yet</p>
                    ) : (
                      messages.map((msg) => {
                        const sender = teamParticipants.find((p) => p.id === msg.participant_id)
                        return (
                          <div key={msg.id} className="rounded-md bg-background p-2">
                            <p className="text-xs font-semibold text-muted-foreground">
                              {sender?.name} ({getRoleDisplayName(sender?.role || null)})
                              {msg.is_code_switched && <Badge className="ml-2 text-xs">Native Lang</Badge>}
                            </p>
                            <p className="text-sm">{msg.content}</p>
                          </div>
                        )
                      })
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{messages.length} messages</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
