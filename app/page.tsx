"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

export default function HomePage() {
  const [gamePin, setGamePin] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Validate game PIN exists and is in waiting status
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .select("*")
        .eq("game_pin", gamePin.toUpperCase())
        .eq("status", "waiting")
        .single()

      if (sessionError || !session) {
        throw new Error("Invalid game PIN or session has already started")
      }

      // Add participant to session
      const { data: participant, error: participantError } = await supabase
        .from("participants")
        .insert({
          session_id: session.id,
          name: name.trim(),
        })
        .select()
        .single()

      if (participantError) throw participantError

      // Redirect to waiting room
      router.push(`/session/${gamePin.toUpperCase()}/waiting?participantId=${participant.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join session")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Join Simulation</CardTitle>
          <CardDescription>Enter your game PIN and name to begin</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="gamePin">Game PIN</Label>
              <Input
                suppressHydrationWarning id="gamePin"
                type="text"
                placeholder="Enter 6-digit PIN"
                value={gamePin}
                onChange={(e) => setGamePin(e.target.value.toUpperCase())}
                maxLength={6}
                required
                className="text-center text-2xl font-bold tracking-widest"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                suppressHydrationWarning id="name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" size="lg" disabled={isLoading} className="w-full">
              {isLoading ? "Joining..." : "Join Session"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
