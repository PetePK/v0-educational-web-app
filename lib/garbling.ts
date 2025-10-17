import type { ParticipantRole } from "./types"

/**
 * Garbles a message based on sender and receiver roles
 * Rules:
 * - Same type (both native or both non-native): no garbling
 * - Code-switched message from non-native to non-native: no garbling
 * - Code-switched message to native speaker: 100% garbling
 * - Otherwise: 25% chance per word (>3 chars, not numbers)
 */
export function garbleMessage(
  message: string,
  senderRole: ParticipantRole | null,
  senderIsNative: boolean | null,
  receiverRole: ParticipantRole | null,
  receiverIsNative: boolean | null,
  isCodeSwitched: boolean,
): string {
  // If no role info, return original
  if (senderIsNative === null || receiverIsNative === null) {
    return message
  }

  // Same type (both native or both non-native) - no garbling
  if (senderIsNative === receiverIsNative && !isCodeSwitched) {
    return message
  }

  // Code-switched message
  if (isCodeSwitched) {
    // If receiver is native, 100% garble
    if (receiverIsNative) {
      return garbleWords(message, 1.0)
    }
    // If receiver is non-native, no garbling
    return message
  }

  // Different types - 25% garbling
  return garbleWords(message, 0.25)
}

function garbleWords(message: string, probability: number): string {
  const words = message.split(" ")

  return words
    .map((word) => {
      // Don't garble short words or numbers
      if (word.length <= 3 || /^\d+$/.test(word)) {
        return word
      }

      // Apply garbling probability
      if (Math.random() < probability) {
        return garbleWord(word)
      }

      return word
    })
    .join(" ")
}

function garbleWord(word: string): string {
  const symbols = ["*", "!", "#", "@", "%", "&"]
  const garbled = word
    .split("")
    .map((char) => {
      // Keep punctuation
      if (/[.,!?;:]/.test(char)) {
        return char
      }
      // Replace with random symbol
      return symbols[Math.floor(Math.random() * symbols.length)]
    })
    .join("")

  return garbled
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: ParticipantRole | null): string {
  if (!role) return "Unassigned"

  const roleNames: Record<ParticipantRole, string> = {
    CEO: "CEO",
    VP_Operations: "VP Operations",
    VP_Finance: "VP Finance",
    VP_Marketing: "VP Marketing",
  }

  return roleNames[role]
}

/**
 * Get role color for UI
 */
export function getRoleColor(role: ParticipantRole | null): string {
  if (!role) return "bg-gray-500"

  const roleColors: Record<ParticipantRole, string> = {
    CEO: "bg-purple-600",
    VP_Operations: "bg-blue-600",
    VP_Finance: "bg-green-600",
    VP_Marketing: "bg-orange-600",
  }

  return roleColors[role]
}
