/**
 * Reconnect State Machine for TmuxMobile
 * 
 * Handles automatic reconnection with exponential backoff when app returns to foreground.
 * 
 * Parameters (from plan):
 * - Initial delay: 0.5s
 * - Backoff multiplier: 2
 * - Max delay: 8s
 * - Max attempts: 8
 * - Cancel if user leaves TerminalScreen
 */

export type ReconnectState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

export type ReconnectEvent = 
  | { type: 'CONNECT' }
  | { type: 'CONNECT_SUCCESS' }
  | { type: 'CONNECT_FAILURE' }
  | { type: 'DISCONNECT' }
  | { type: 'TRIGGER_RECONNECT' }
  | { type: 'RECONNECT_SUCCESS' }
  | { type: 'RECONNECT_FAILURE' }
  | { type: 'CANCEL' }
  | { type: 'RESET' };

export interface ReconnectContext {
  state: ReconnectState;
  attemptCount: number;
  currentDelay: number;
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  multiplier: number;
  lastError?: string;
  isCancelled: boolean;
}

export const DEFAULT_CONFIG = {
  initialDelay: 500,    // 0.5s
  multiplier: 2,
  maxDelay: 8000,       // 8s
  maxAttempts: 8,
};

export function createInitialContext(config = DEFAULT_CONFIG): ReconnectContext {
  return {
    state: 'idle',
    attemptCount: 0,
    currentDelay: config.initialDelay,
    maxAttempts: config.maxAttempts,
    initialDelay: config.initialDelay,
    maxDelay: config.maxDelay,
    multiplier: config.multiplier,
    isCancelled: false,
  };
}

export function calculateNextDelay(context: ReconnectContext): number {
  const nextDelay = context.currentDelay * context.multiplier;
  return Math.min(nextDelay, context.maxDelay);
}

export function transition(context: ReconnectContext, event: ReconnectEvent): ReconnectContext {
  const { state } = context;

  switch (event.type) {
    case 'CONNECT':
      if (state === 'idle') {
        return { ...context, state: 'connecting' };
      }
      return context;

    case 'CONNECT_SUCCESS':
      if (state === 'connecting' || state === 'reconnecting') {
        return {
          ...context,
          state: 'connected',
          attemptCount: 0,
          currentDelay: context.initialDelay,
          lastError: undefined,
          isCancelled: false,
        };
      }
      return context;

    case 'CONNECT_FAILURE':
      if (state === 'connecting') {
        return { ...context, state: 'failed', lastError: 'Connection failed' };
      }
      return context;

    case 'DISCONNECT':
      if (state === 'connected') {
        return { ...context, state: 'idle' };
      }
      return context;

    case 'TRIGGER_RECONNECT':
      if (state === 'connected' || state === 'idle' || state === 'failed') {
        if (context.isCancelled) {
          return context;
        }
        if (context.attemptCount >= context.maxAttempts) {
          return { ...context, state: 'failed', lastError: 'Max reconnect attempts reached' };
        }
        return {
          ...context,
          state: 'reconnecting',
          attemptCount: context.attemptCount + 1,
        };
      }
      return context;

    case 'RECONNECT_SUCCESS':
      if (state === 'reconnecting') {
        return {
          ...context,
          state: 'connected',
          attemptCount: 0,
          currentDelay: context.initialDelay,
          lastError: undefined,
          isCancelled: false,
        };
      }
      return context;

    case 'RECONNECT_FAILURE':
      if (state === 'reconnecting') {
        if (context.attemptCount >= context.maxAttempts) {
          return { ...context, state: 'failed', lastError: 'Max reconnect attempts reached' };
        }
        return {
          ...context,
          state: 'reconnecting',
          currentDelay: calculateNextDelay(context),
          lastError: 'Reconnect attempt failed',
        };
      }
      return context;

    case 'CANCEL':
      return {
        ...context,
        state: 'idle',
        isCancelled: true,
        attemptCount: 0,
        currentDelay: context.initialDelay,
      };

    case 'RESET':
      return createInitialContext({
        initialDelay: context.initialDelay,
        multiplier: context.multiplier,
        maxDelay: context.maxDelay,
        maxAttempts: context.maxAttempts,
      });

    default:
      return context;
  }
}

/**
 * Reconnect State Machine class for use in components
 */
export class ReconnectStateMachine {
  private context: ReconnectContext;
  private timeoutId: NodeJS.Timeout | null = null;
  private onStateChange?: (context: ReconnectContext) => void;
  private onReconnectAttempt?: () => Promise<boolean>;

  constructor(
    config = DEFAULT_CONFIG,
    callbacks?: {
      onStateChange?: (context: ReconnectContext) => void;
      onReconnectAttempt?: () => Promise<boolean>;
    }
  ) {
    this.context = createInitialContext(config);
    this.onStateChange = callbacks?.onStateChange;
    this.onReconnectAttempt = callbacks?.onReconnectAttempt;
  }

  getContext(): ReconnectContext {
    return { ...this.context };
  }

  getState(): ReconnectState {
    return this.context.state;
  }

  private dispatch(event: ReconnectEvent): void {
    const prevState = this.context.state;
    this.context = transition(this.context, event);
    
    if (prevState !== this.context.state && this.onStateChange) {
      this.onStateChange(this.getContext());
    }
  }

  connect(): void {
    this.dispatch({ type: 'CONNECT' });
  }

  connectSuccess(): void {
    this.dispatch({ type: 'CONNECT_SUCCESS' });
  }

  connectFailure(): void {
    this.dispatch({ type: 'CONNECT_FAILURE' });
  }

  disconnect(): void {
    this.dispatch({ type: 'DISCONNECT' });
  }

  async triggerReconnect(): Promise<void> {
    if (this.context.isCancelled) {
      return;
    }

    this.dispatch({ type: 'TRIGGER_RECONNECT' });

    if (this.context.state !== 'reconnecting') {
      return;
    }

    // Schedule reconnect attempt with current delay
    await this.scheduleReconnectAttempt();
  }

  private async scheduleReconnectAttempt(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    return new Promise((resolve) => {
      this.timeoutId = setTimeout(async () => {
        if (this.context.isCancelled || this.context.state !== 'reconnecting') {
          resolve();
          return;
        }

        try {
          const success = this.onReconnectAttempt 
            ? await this.onReconnectAttempt()
            : false;

          if (success) {
            this.dispatch({ type: 'RECONNECT_SUCCESS' });
          } else {
            this.dispatch({ type: 'RECONNECT_FAILURE' });
            
            // If still reconnecting after failure, schedule next attempt
            if (this.context.state === 'reconnecting') {
              await this.scheduleReconnectAttempt();
            }
          }
        } catch (error) {
          this.dispatch({ type: 'RECONNECT_FAILURE' });
          
          if (this.context.state === 'reconnecting') {
            await this.scheduleReconnectAttempt();
          }
        }

        resolve();
      }, this.context.currentDelay);
    });
  }

  cancel(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.dispatch({ type: 'CANCEL' });
  }

  reset(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.dispatch({ type: 'RESET' });
  }

  destroy(): void {
    this.cancel();
    this.onStateChange = undefined;
    this.onReconnectAttempt = undefined;
  }
}

export default ReconnectStateMachine;
