import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Bot, Send, Sparkles, Trash2, X } from 'lucide-react'
import { useAssistant } from '../../context/AssistantContext'
import type { AssistantMessage } from '../../lib/assistant/types'

function renderMessageLines(content: string) {
  const lines = content.split('\n')
  return lines.map((line, index) => {
    if (line.trim().length === 0) {
      return <div key={`gap-${index}`} className="assistant-msg-gap" aria-hidden="true" />
    }
    return (
      <p key={`line-${index}`} className="assistant-msg-paragraph">
        {line}
      </p>
    )
  })
}

function renderMetadataList(message: AssistantMessage) {
  if (!message.metadataItems || message.metadataItems.length === 0) {
    return null
  }

  return (
    <ul className="assistant-meta-list" aria-label="Interpretación de metadatos">
      {message.metadataItems.map((item) => (
        <li
          key={`${message.id}-${item.key}`}
          className={`assistant-meta-item tone-${item.tone ?? 'neutral'}`}
        >
          <div className="assistant-meta-head">
            <span className="assistant-meta-label">{item.label}</span>
            <code className="assistant-meta-key" translate="no">
              {item.key}
            </code>
          </div>
          <div className="assistant-meta-value">{item.value}</div>
          <p className="assistant-meta-explanation">{item.explanation}</p>
        </li>
      ))}
    </ul>
  )
}

export function AssistantWidget() {
  const {
    isOpen,
    messages,
    isResponding,
    suggestions,
    permissions,
    toggleAssistant,
    closeAssistant,
    sendMessage,
    clearConversation,
  } = useAssistant()

  const [draft, setDraft] = useState('')
  const toggleBtnRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true
      inputRef.current?.focus()
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false
      toggleBtnRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeAssistant()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, closeAssistant])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight
    }
  }, [messages, isResponding, isOpen])

  function submitDraft() {
    const trimmed = draft.trim()
    if (!trimmed || isResponding) return
    setDraft('')
    void sendMessage(trimmed)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submitDraft()
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submitDraft()
    }
  }

  return (
    <div className="assistant-root">
      {isOpen ? (
        <section
          id="accesa-assistant-panel"
          className="assistant-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Asistente operativo Accesa"
        >
          <header className="assistant-header">
            <div className="assistant-header-info">
              <div className="assistant-avatar" aria-hidden="true">
                <Bot size={18} />
              </div>
              <div>
                <h2 className="assistant-title">Asistente operativo Accesa</h2>
                <p className="assistant-subtitle">
                  Ayuda y metadatos · Perfil {permissions.profileLabel}
                </p>
              </div>
            </div>
            <div className="assistant-header-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm assistant-icon-btn"
                onClick={clearConversation}
                disabled={messages.length === 0}
                aria-label="Limpiar conversación"
                title="Limpiar conversación"
              >
                <Trash2 size={14} aria-hidden="true" />
                <span>Limpiar</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm assistant-icon-btn"
                onClick={closeAssistant}
                aria-label="Cerrar asistente"
                title="Cerrar asistente (Escape)"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          </header>

          <div
            ref={messagesEndRef}
            className="assistant-messages"
            aria-live="polite"
            aria-label="Historial de conversación con el asistente"
          >
            {messages.length === 0 ? (
              <div className="assistant-welcome">
                <div className="assistant-welcome-badge">
                  <Sparkles size={14} aria-hidden="true" />
                  <span>Guía contextual para {permissions.profileLabel}</span>
                </div>
                <p className="assistant-welcome-copy">
                  Consulta dudas operativas sobre la bitácora, motivos de denegación, tarjetas RFID,
                  conectividad de controladores o pega un JSON de metadatos para interpretarlo.
                </p>
                <div className="assistant-suggestions" role="group" aria-label="Consultas sugeridas">
                  {suggestions.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="assistant-chip"
                      onClick={() => void sendMessage(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <article
                  key={message.id}
                  className={`assistant-msg assistant-msg--${message.sender}`}
                >
                  {message.eventSummary ? (
                    <div className="assistant-event-banner">
                      <span
                        className={`assistant-decision-pill is-${message.eventSummary.decision}`}
                      >
                        {message.eventSummary.decisionLabel}
                      </span>
                      <span className="assistant-event-meta">
                        {message.eventSummary.reasonLabel} ·{' '}
                        <code translate="no">{message.eventSummary.cardUid}</code>
                      </span>
                    </div>
                  ) : null}
                  <div className="assistant-msg-body">{renderMessageLines(message.content)}</div>
                  {renderMetadataList(message)}
                </article>
              ))
            )}

            {isResponding ? (
              <div className="assistant-typing" role="status">
                Analizando consulta…
              </div>
            ) : null}
          </div>

          <form className="assistant-composer" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="accesa-assistant-input">
              Escribe tu consulta o pega metadatos JSON
            </label>
            <textarea
              ref={inputRef}
              id="accesa-assistant-input"
              className="assistant-input"
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Pregunta sobre Accesa o pega metadatos JSON…"
            />
            <div className="assistant-composer-footer">
              <span className="assistant-composer-hint">
                Enter para enviar · Shift+Enter nueva línea
              </span>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={draft.trim().length === 0 || isResponding}
                aria-label="Enviar consulta"
              >
                <Send size={14} aria-hidden="true" />
                <span>Enviar</span>
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <button
        ref={toggleBtnRef}
        type="button"
        className="assistant-fab"
        onClick={toggleAssistant}
        aria-label="Abrir asistente de Accesa"
        aria-expanded={isOpen}
        aria-controls="accesa-assistant-panel"
        title="Asistente operativo Accesa"
      >
        {isOpen ? <X size={20} aria-hidden="true" /> : <Bot size={20} aria-hidden="true" />}
        <span className="assistant-fab-label">{isOpen ? 'Cerrar' : 'Asistente'}</span>
      </button>
    </div>
  )
}
