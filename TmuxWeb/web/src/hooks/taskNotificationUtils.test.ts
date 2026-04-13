import { describe, expect, it } from 'vitest'
import { classifyWaitingAction, shouldNotifyForTaskEvent, waitingActionLabel } from './taskNotificationUtils'

describe('shouldNotifyForTaskEvent', () => {
  it('shows task completion notifications for normal user tasks', () => {
    expect(shouldNotifyForTaskEvent({
      type: 'task_completed',
      user_message: 'finish the refactor',
      assistant_message: 'Done',
    })).toBe(true)
  })

  it('hides system directive notifications', () => {
    expect(shouldNotifyForTaskEvent({
      type: 'task_completed',
      user_message: 'SYSTEM DIRECTIVE: internal routing',
      assistant_message: 'ok',
    })).toBe(false)
  })

  it('hides omo system notifications', () => {
    expect(shouldNotifyForTaskEvent({
      type: 'task_completed',
      user_message: 'omo internal reminder',
      assistant_message: 'completed',
    })).toBe(false)
  })

  it('shows waiting notifications that require authorization', () => {
    expect(shouldNotifyForTaskEvent({
      type: 'task_waiting',
      assistant_message: 'Waiting for user authorization to continue',
    })).toBe(true)
  })

  it('shows waiting notifications that require selection', () => {
    expect(shouldNotifyForTaskEvent({
      type: 'task_waiting',
      assistant_message: 'Please choose one option before continuing',
    })).toBe(true)
  })

  it('classifies authorization and selection waiting messages', () => {
    expect(classifyWaitingAction({ assistant_message: 'Need authorization to proceed' })).toBe('authorization')
    expect(classifyWaitingAction({ assistant_message: 'Choose one option' })).toBe('selection')
  })

  it('renders clearer labels for waiting actions', () => {
    expect(waitingActionLabel('authorization')).toBe('Authorization Required')
    expect(waitingActionLabel('selection')).toBe('Selection Required')
    expect(waitingActionLabel(null)).toBe('Waiting')
  })

  it('hides non-actionable waiting notifications', () => {
    expect(shouldNotifyForTaskEvent({
      type: 'task_waiting',
      assistant_message: 'waiting for background sync',
    })).toBe(false)
  })

  it('hides task_started and task_failed toast noise', () => {
    expect(shouldNotifyForTaskEvent({ type: 'task_started' })).toBe(false)
    expect(shouldNotifyForTaskEvent({ type: 'task_failed', assistant_message: 'command failed' })).toBe(false)
  })
})
