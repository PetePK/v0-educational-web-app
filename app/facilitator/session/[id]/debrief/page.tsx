"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import type { Team, Answer } from "@/lib/types"
import { Spinner } from "@/components/ui/spinner"

const QUESTIONS = [
  "What is the primary market opportunity?",
  "What are the key operational challenges?",
  "What is the financial projection for Year 1?",
  "What is the recommended marketing strategy?",
]

export default function DebriefPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [teams, setTeams] = useState<Team[]>([])
  const [answersByTeam, setAnswersByTeam] = useState<Record<string, Answer[]>>({})
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

        // Get all answers
        const { data: answersData, error: answersError } = await supabase
          .from("answers")
          .select("*")
          .eq("session_id", sessionId)
          .order("question_number", { ascending: true })

        if (answersError) throw answersError

        // Group answers by team
        const grouped: Record<string, Answer[]> = {}
        answersData.forEach((answer) => {
          if (!grouped[answer.team_id]) {
            grouped[answer.team_id] = []
          }
          grouped[answer.team_id].push(answer)
        })
        setAnswersByTeam(grouped)

        setLoading(false)
      } catch (err) {
        console.error("[v0] Error fetching data:", err)
        setLoading(false)
      }
    }

    fetchData()
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
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Session Debrief</h1>
          <Button variant="outline" onClick={() => router.push(`/facilitator/session/${sessionId}`)}>
            Back to Session
          </Button>
        </div>

        <div className="space-y-6">
          {teams.map((team) => {
            const answers = answersByTeam[team.id] || []

            return (
              <Card key={team.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Team {team.team_number}</CardTitle>
                    <Button onClick={() => router.push(`/facilitator/session/${sessionId}/debrief/team/${team.id}`)}>
                      View Chat History
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {QUESTIONS.map((question, index) => {
                    const answer = answers.find((a) => a.question_number === index + 1)
                    return (
                      <div key={index} className="rounded-lg border bg-background p-4">
                        <p className="mb-2 font-semibold">
                          {index + 1}. {question}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {answer ? answer.answer_text : "No answer submitted"}
                        </p>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
