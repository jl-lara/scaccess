import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import {
  LocalKnowledgeAssistantProvider,
  getContextualSuggestions,
} from '../lib/assistant/knowledgeBase'
import { explainAccessEvent } from '../lib/assistant/metadataInterpreter'
import type {
  AssistantEventContext,
  AssistantMessage,
  AssistantProvider as AssistantProviderContract,
} from '../lib/assistant/types'
import { usePermissions, type WebPermissions } from '../lib/permissions'

export interface AssistantContextValue {
  isOpen: boolean
  messages: readonly AssistantMessage[]
  isResponding: boolean
  activeEventContext: AssistantEventContext | null
  suggestions: readonly string[]
  permissions: WebPermissions
  pathname: string
  openAssistant: (initialPrompt?: string) => void
  openAssistantWithEvent: (eventContext: AssistantEventContext) => void
  closeAssistant: () => void
  toggleAssistant: () => void
  sendMessage: (text: string) => Promise<void>
  clearConversation: () => void
}

const AssistantContext = createContext<AssistantContextValue | null>(null)

const DEFAULT_PROVIDER = new LocalKnowledgeAssistantProvider()

let messageCounter = 0
function nextMessageId(prefix: string): string {
  messageCounter += 1
  return `${prefix}-${Date.now()}-${messageCounter}`
}

export interface AssistantProviderProps {
  children: ReactNode
  provider?: AssistantProviderContract
}

/**
 * Proveedor del asistente operativo y traductor de metadatos de Accesa.
 * Se monta dentro de AppShell para adaptarse a la ruta y al perfil RBAC activo.
 */
export function AssistantProvider({
  children,
  provider = DEFAULT_PROVIDER,
}: AssistantProviderProps) {
  const location = useLocation()
  const permissions = usePermissions()

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [isResponding, setIsResponding] = useState(false)
  const [activeEventContext, setActiveEventContext] = useState<AssistantEventContext | null>(null)

  const conversationEpochRef = useRef(0)
  const messagesRef = useRef<AssistantMessage[]>(messages)
  messagesRef.current = messages
  const activeEventRef = useRef<AssistantEventContext | null>(activeEventContext)
  activeEventRef.current = activeEventContext

  const suggestions = useMemo(
    () => getContextualSuggestions(location.pathname, permissions),
    [location.pathname, permissions],
  )

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) {
        return
      }

      const requestEpoch = conversationEpochRef.current
      const userMessage: AssistantMessage = {
        id: nextMessageId('user'),
        sender: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      }

      const nextHistory = [...messagesRef.current, userMessage]
      setMessages(nextHistory)
      setIsResponding(true)

      try {
        const reply = await provider.reply({
          message: trimmed,
          pageContext: {
            pathname: location.pathname,
            permissions,
          },
          eventContext: activeEventRef.current,
          history: nextHistory,
        })

        if (conversationEpochRef.current !== requestEpoch) {
          return
        }

        const assistantMessage: AssistantMessage = {
          id: nextMessageId('assistant'),
          sender: 'assistant',
          content: reply.content,
          createdAt: new Date().toISOString(),
          metadataItems: reply.metadataItems,
          eventSummary: reply.eventSummary,
          suggestions: reply.suggestions,
        }

        setMessages((current) => [...current, assistantMessage])
      } catch {
        if (conversationEpochRef.current !== requestEpoch) {
          return
        }

        const fallbackMessage: AssistantMessage = {
          id: nextMessageId('assistant-error'),
          sender: 'assistant',
          content:
            'No pude procesar la consulta en este momento. Intenta reformularla o pega el bloque JSON de metadatos.',
          createdAt: new Date().toISOString(),
        }
        setMessages((current) => [...current, fallbackMessage])
      } finally {
        if (conversationEpochRef.current === requestEpoch) {
          setIsResponding(false)
        }
      }
    },
    [location.pathname, permissions, provider],
  )

  const openAssistant = useCallback(
    (initialPrompt?: string) => {
      setIsOpen(true)
      if (initialPrompt && initialPrompt.trim().length > 0) {
        void sendMessage(initialPrompt)
      }
    },
    [sendMessage],
  )

  const openAssistantWithEvent = useCallback((eventContext: AssistantEventContext) => {
    conversationEpochRef.current += 1
    setIsResponding(false)
    setActiveEventContext(eventContext)
    setIsOpen(true)

    const explanation = explainAccessEvent(eventContext)
    const nowIso = new Date().toISOString()

    const userMessage: AssistantMessage = {
      id: nextMessageId('user-event'),
      sender: 'user',
      content: `Explicar evento y metadatos (${eventContext.cardUid} · ${eventContext.areaLabel})`,
      createdAt: nowIso,
    }

    const assistantMessage: AssistantMessage = {
      id: nextMessageId('assistant-event'),
      sender: 'assistant',
      content: explanation.content,
      createdAt: nowIso,
      metadataItems: explanation.metadataItems,
      eventSummary: explanation.eventSummary,
    }

    setMessages((current) => [...current, userMessage, assistantMessage])
  }, [])

  const closeAssistant = useCallback(() => {
    setIsOpen(false)
  }, [])

  const toggleAssistant = useCallback(() => {
    setIsOpen((current) => !current)
  }, [])

  const clearConversation = useCallback(() => {
    conversationEpochRef.current += 1
    setMessages([])
    setActiveEventContext(null)
    setIsResponding(false)
  }, [])

  const value = useMemo<AssistantContextValue>(
    () => ({
      isOpen,
      messages,
      isResponding,
      activeEventContext,
      suggestions,
      permissions,
      pathname: location.pathname,
      openAssistant,
      openAssistantWithEvent,
      closeAssistant,
      toggleAssistant,
      sendMessage,
      clearConversation,
    }),
    [
      isOpen,
      messages,
      isResponding,
      activeEventContext,
      suggestions,
      permissions,
      location.pathname,
      openAssistant,
      openAssistantWithEvent,
      closeAssistant,
      toggleAssistant,
      sendMessage,
      clearConversation,
    ],
  )

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
}

/**
 * Hook obligatorio para consumir el asistente dentro de AppShell.
 */
export function useAssistant(): AssistantContextValue {
  const ctx = useContext(AssistantContext)
  if (!ctx) {
    throw new Error('useAssistant debe utilizarse dentro de AssistantProvider.')
  }
  return ctx
}

/**
 * Hook opcional para páginas que pueden renderizarse de forma aislada en pruebas
 * sin AppShell ni AssistantProvider; devuelve null cuando no existe proveedor.
 */
export function useOptionalAssistant(): AssistantContextValue | null {
  return useContext(AssistantContext)
}
