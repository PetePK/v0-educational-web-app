"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import type { Participant, Message } from "@/lib/types"
import { Spinner } from "@/components/ui/spinner"
import { garbleMessage, getRoleDisplayName, getRoleColor } from "@/lib/garbling"

export default function TeamDebriefPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string
  const teamId = params.teamId as string

  const [participants, setParticipants] = useState<Participant[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedPerspective, setSelectedPerspective] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const fetchData = async () => {
      try {
        // Get team participants
        const { data: participantsData, error: participantsError } = await supabase
          .from("participants")
          .select("*")
          .eq("team_id", teamId)
          .order("joined_at", { ascending: true })

        if (participantsError) throw participantsError
        setParticipants(participantsData)

        // Set default perspective to first participant
        if (participantsData.length > 0 && !selectedPerspective) {
          setSelectedPerspective(participantsData[0].id)
        }

        // Get messages
        const { data: messagesData, error: messagesError } = await supabase
          .from("messages")
          .select("*")
          .eq("team_id", teamId)
          .order("timestamp", { ascending: true })

        if (messagesError) throw messagesError
        setMessages(messagesData)

        setLoading(false)
      } catch (err) {
        console.error("[v0] Error fetching data:", err)
        setLoading(false)
      }
    }

    fetchData()
  }, [teamId, selectedPerspective])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const currentPerspective = participants.find((p) => p.id === selectedPerspective)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Team Chat History</h1>
          <Button variant="outline" onClick={() => router.push(`/facilitator/session/${sessionId}/debrief`)}>
            Back to Debrief
          </Button>
        </div>

        {/* Perspective Selector */}
        <Card>
          <CardHeader>
            <CardTitle>View From Perspective</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <Label htmlFor="perspective" className="min-w-fit">
                  Select Role:
                </Label>
                <Select value={selectedPerspective || undefined} onValueChange={setSelectedPerspective}>
                  <SelectTrigger id="perspective" className="w-full max-w-md">
                    <SelectValue placeholder="Select a perspective" />
                  </SelectTrigger>
                  <SelectContent>
                    {participants.map((participant) => (
                      <SelectItem key={participant.id} value={participant.id}>
                        {participant.name} - {getRoleDisplayName(participant.role)} (
                        {participant.is_native_speaker ? "Native" : "Non-Native"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentPerspective && (
                <div className="flex items-center gap-2">
                  <Badge className={`${getRoleColor(currentPerspective.role)} text-white`}>
                    {getRoleDisplayName(currentPerspective.role)}
                  </Badge>
                  <Badge variant="outline">
                    {currentPerspective.is_native_speaker ? "Native Speaker" : "Non-Native Speaker"}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Viewing chat as <span className="font-semibold">{currentPerspective.name}</span> would have seen it
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chat History */}
        <Card>
          <CardHeader>
            <CardTitle>Messages ({messages.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4 max-h-[600px] overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages in this chat</p>
              ) : (
                messages.map((message) => {
                  const sender = participants.find((p) => p.id === message.participant_id)

                  // Apply garbling from current perspective
                  const garbledContent = currentPerspective
                    ? garbleMessage(
                        message.content,
                        sender?.role || null,
                        sender?.is_native_speaker || null,
                        currentPerspective.role,
                        currentPerspective.is_native_speaker,
                        message.is_code_switched,
                      )
                    : message.content

                  const isGarbled = garbledContent !== message.content

                  return (
                    <div key={message.id} className="rounded-lg border bg-background p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <p className="text-sm font-semibold">{sender?.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {getRoleDisplayName(sender?.role || null)}
                        </Badge>
                        {sender?.is_native_speaker !== null && (
                          <Badge variant="secondary" className="text-xs">
                            {sender.is_native_speaker ? "Native" : "Non-Native"}
                          </Badge>
                        )}
                        {message.is_code_switched && (
                          <Badge variant="default" className="text-xs bg-amber-500">
                            [Native Language]
                          </Badge>
                        )}
                        {isGarbled && (
                          <Badge variant="destructive" className="text-xs">
                            Garbled
                          </Badge>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm">{garbledContent}</p>
                        {isGarbled && (
                          <details className="text-xs text-muted-foreground">
                            <summary className="cursor-pointer hover:text-foreground">Show original</summary>
                            <p className="mt-1 rounded bg-muted p-2">{message.content}</p>
                          </details>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Team Members Reference */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {participants.map((participant) => (
                <div key={participant.id} className="flex items-center gap-3 rounded-md border bg-background p-3">
                  <div className="flex-1">
                    <p className="font-medium">{participant.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge className={`${getRoleColor(participant.role)} text-white text-xs`}>
                        {getRoleDisplayName(participant.role)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {participant.is_native_speaker ? "Native" : "Non-Native"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
