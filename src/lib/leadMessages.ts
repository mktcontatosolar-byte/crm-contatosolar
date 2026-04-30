const INTERNAL_MESSAGE_MARKERS = [
  "# DADOS DO LEAD",
  "DADOS DO LEAD",
  "PERGUNTA OBRIGATÓRIA",
  "Tentativa de Contato",
  "(Input)",
  "Input",
  "System:",
  "system_prompt",
  "prompt interno",
  "contexto interno",
]

export function shouldHideConversationMessage(content: string) {
  const normalizedContent = content.toLowerCase()

  return INTERNAL_MESSAGE_MARKERS.some((marker) => normalizedContent.includes(marker.toLowerCase()))
}

export function cleanLeadConversationMessage(text: string) {
  const normalizedText = text.trim()

  if (!normalizedText) {
    return text
  }

  const leadMessageMarker = /\[?\s*mensagem do lead\s*\]?/i
  const markerMatch = leadMessageMarker.exec(normalizedText)

  if (!markerMatch) {
    return text
  }

  const extractedMessage = normalizedText.slice(markerMatch.index + markerMatch[0].length).trim()

  return extractedMessage || text
}
