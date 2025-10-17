"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

export default function FacilitatorPage() {
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()

  const generatePin = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const handleCreateSession = async () => {
    setIsCreating(true)

    try {
      const supabase = createClient()
      const pin = generatePin()

      const { data: session, error } = await supabase
        .from("sessions")
        .insert({
          game_pin: pin,
          status: "waiting",
          timer_duration: 900,
        })
        .select()
        .single()

      if (error) throw error

      router.push(`/facilitator/session/${session.id}`)
    } catch (err) {
      console.error("[v0] Error creating session:", err)
      alert("Failed to create session")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Facilitator Dashboard</CardTitle>
          <CardDescription>Create and manage simulation sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleCreateSession} disabled={isCreating} size="lg" className="w-full">
            {isCreating ? "Creating..." : "Create New Session"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
