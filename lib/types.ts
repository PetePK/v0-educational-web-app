export type SessionStatus = "waiting" | "in_progress" | "completed"

export type ParticipantRole = "CEO" | "VP_Operations" | "VP_Finance" | "VP_Marketing"

export interface Session {
  id: string
  game_pin: string
  status: SessionStatus
  timer_duration: number
  created_at: string
  started_at: string | null
  ended_at: string | null
}

export interface Team {
  id: string
  session_id: string
  team_number: number
  created_at: string
}

export interface Participant {
  id: string
  session_id: string
  team_id: string | null
  name: string
  role: ParticipantRole | null
  is_native_speaker: boolean | null
  joined_at: string
}

export interface Message {
  id: string
  session_id: string
  team_id: string
  participant_id: string
  content: string
  is_code_switched: boolean
  timestamp: string
}

export interface Answer {
  id: string
  session_id: string
  team_id: string
  question_number: number
  answer_text: string
  submitted_by: string
  submitted_at: string
}
