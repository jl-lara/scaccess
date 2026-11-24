import type { AccessDecision, AccessReason } from '@scaccess/shared'
import type { WebPermissions } from '../permissions'

export type AssistantSender = 'user' | 'assistant'

export type AssistantTone = 'neutral' | 'success' | 'warning' | 'danger'

export interface AssistantMetadataItem {
  key: string
  label: string
  value: string
  explanation: string
  tone?: AssistantTone
}

export interface AssistantEventContext {
  id: string
  decision: AccessDecision
  reasonCode: AccessReason | string
  cardUid: string
  employeeLabel: string
  areaLabel: string
  deviceLabel: string
  occurredAt: string
  receivedAt: string
  clientEventId: string
  deviceEpoch: string | null
  deviceSequence: string | null
  metadata: unknown | null
}

export interface AssistantEventSummary {
  title: string
  decision: AccessDecision
  decisionLabel: string
  reasonLabel: string
  cardUid: string
}

export interface AssistantMessage {
  id: string
  sender: AssistantSender
  content: string
  createdAt: string
  metadataItems?: AssistantMetadataItem[]
  eventSummary?: AssistantEventSummary
  suggestions?: string[]
}

export interface AssistantPageContext {
  pathname: string
  permissions: WebPermissions
}

export interface AssistantReply {
  content: string
  metadataItems?: AssistantMetadataItem[]
  eventSummary?: AssistantEventSummary
  suggestions?: string[]
}

export interface AssistantRequest {
  message: string
  pageContext: AssistantPageContext
  eventContext?: AssistantEventContext | null
  history?: readonly AssistantMessage[]
}

/**
 * Contrato extensible para proveedores de respuestas del asistente.
 * Permite reemplazar el motor local por un endpoint REST o proveedor LLM
 * sin acoplar la interfaz ni el contexto de React.
 */
export interface AssistantProvider {
  readonly id: string
  readonly name: string
  reply(request: AssistantRequest): Promise<AssistantReply>
}
