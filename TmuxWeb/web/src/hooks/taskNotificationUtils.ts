type TaskEventType = 'task_started' | 'task_completed' | 'task_failed' | 'task_waiting'

export type WaitingAction = 'authorization' | 'selection'

interface TaskEventLike {
  type?: string
  user_message?: string
  assistant_message?: string
}

const ACTIONABLE_WAITING_PATTERNS = [
  /authorization/i,
  /authorisation/i,
  /permission/i,
  /approve/i,
  /confirm/i,
  /select/i,
  /selection/i,
  /choose/i,
  /pick one/i,
  /which .*option/i,
]

const SYSTEM_NOISE_PATTERNS = [
  /system directive/i,
  /omo/i,
  /internal reminder/i,
  /internal initiator/i,
  /system-reminder/i,
]

function combinedText(event: TaskEventLike): string {
  return [event.user_message, event.assistant_message]
    .filter(Boolean)
    .join('\n')
    .trim()
}

export function isSystemNoiseMessage(event: TaskEventLike): boolean {
  const text = combinedText(event)
  if (!text) return false
  return SYSTEM_NOISE_PATTERNS.some(pattern => pattern.test(text))
}

export function isActionableWaitingMessage(event: TaskEventLike): boolean {
  const text = combinedText(event)
  if (!text) return false
  return ACTIONABLE_WAITING_PATTERNS.some(pattern => pattern.test(text))
}

export function classifyWaitingAction(event: TaskEventLike): WaitingAction | null {
  const text = combinedText(event)
  if (!text) return null

  if (/authorization|authorisation|permission|approve|confirm/i.test(text)) return 'authorization'
  if (/select|selection|choose|pick one|which .*option/i.test(text)) return 'selection'

  return null
}

export function waitingActionLabel(action: WaitingAction | null): string {
  if (action === 'authorization') return 'Authorization Required'
  if (action === 'selection') return 'Selection Required'
  return 'Waiting'
}

export function shouldNotifyForTaskEvent(event: TaskEventLike): boolean {
  const type = event.type as TaskEventType | undefined
  if (!type) return false
  if (isSystemNoiseMessage(event)) return false

  if (type === 'task_completed') return true
  if (type === 'task_waiting') return isActionableWaitingMessage(event)

  return false
}
