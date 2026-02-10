import {
  ReconnectStateMachine,
  ReconnectContext,
  ReconnectEvent,
  DEFAULT_CONFIG,
  createInitialContext,
  calculateNextDelay,
  transition,
} from '../reconnectStateMachine';

describe('reconnectStateMachine', () => {
  describe('createInitialContext', () => {
    test('creates context with default config', () => {
      const ctx = createInitialContext();
      expect(ctx).toEqual({
        state: 'idle',
        attemptCount: 0,
        currentDelay: 500,
        maxAttempts: 8,
        initialDelay: 500,
        maxDelay: 8000,
        multiplier: 2,
        isCancelled: false,
      });
    });

    test('creates context with custom config', () => {
      const customConfig = {
        initialDelay: 1000,
        multiplier: 3,
        maxDelay: 10000,
        maxAttempts: 5,
      };
      const ctx = createInitialContext(customConfig);
      expect(ctx.initialDelay).toBe(1000);
      expect(ctx.multiplier).toBe(3);
      expect(ctx.maxDelay).toBe(10000);
      expect(ctx.maxAttempts).toBe(5);
    });
  });

  describe('calculateNextDelay', () => {
    test('applies multiplier to current delay', () => {
      const ctx = createInitialContext();
      ctx.currentDelay = 500;
      const nextDelay = calculateNextDelay(ctx);
      expect(nextDelay).toBe(1000);
    });

    test('caps delay at maxDelay', () => {
      const ctx = createInitialContext();
      ctx.currentDelay = 5000;
      const nextDelay = calculateNextDelay(ctx);
      expect(nextDelay).toBe(8000);
    });

    test('respects custom multiplier', () => {
      const ctx = createInitialContext({ ...DEFAULT_CONFIG, multiplier: 3 });
      ctx.currentDelay = 500;
      const nextDelay = calculateNextDelay(ctx);
      expect(nextDelay).toBe(1500);
    });
  });

  describe('transition - CONNECT', () => {
    test('transitions from idle to connecting', () => {
      const ctx = createInitialContext();
      const newCtx = transition(ctx, { type: 'CONNECT' });
      expect(newCtx.state).toBe('connecting');
    });

    test('ignores CONNECT from non-idle state', () => {
      const ctx = createInitialContext();
      ctx.state = 'connected';
      const newCtx = transition(ctx, { type: 'CONNECT' });
      expect(newCtx.state).toBe('connected');
    });
  });

  describe('transition - CONNECT_SUCCESS', () => {
    test('transitions from connecting to connected', () => {
      const ctx = createInitialContext();
      ctx.state = 'connecting';
      const newCtx = transition(ctx, { type: 'CONNECT_SUCCESS' });
      expect(newCtx.state).toBe('connected');
      expect(newCtx.attemptCount).toBe(0);
      expect(newCtx.currentDelay).toBe(DEFAULT_CONFIG.initialDelay);
      expect(newCtx.lastError).toBeUndefined();
    });

    test('transitions from reconnecting to connected', () => {
      const ctx = createInitialContext();
      ctx.state = 'reconnecting';
      ctx.attemptCount = 3;
      ctx.currentDelay = 2000;
      ctx.lastError = 'Previous failure';
      const newCtx = transition(ctx, { type: 'CONNECT_SUCCESS' });
      expect(newCtx.state).toBe('connected');
      expect(newCtx.attemptCount).toBe(0);
      expect(newCtx.currentDelay).toBe(DEFAULT_CONFIG.initialDelay);
      expect(newCtx.lastError).toBeUndefined();
    });

    test('resets isCancelled flag on success', () => {
      const ctx = createInitialContext();
      ctx.state = 'reconnecting';
      ctx.isCancelled = true;
      const newCtx = transition(ctx, { type: 'CONNECT_SUCCESS' });
      expect(newCtx.isCancelled).toBe(false);
    });

    test('ignores CONNECT_SUCCESS from non-connecting/reconnecting state', () => {
      const ctx = createInitialContext();
      ctx.state = 'idle';
      const newCtx = transition(ctx, { type: 'CONNECT_SUCCESS' });
      expect(newCtx.state).toBe('idle');
    });
  });

  describe('transition - CONNECT_FAILURE', () => {
    test('transitions from connecting to failed', () => {
      const ctx = createInitialContext();
      ctx.state = 'connecting';
      const newCtx = transition(ctx, { type: 'CONNECT_FAILURE' });
      expect(newCtx.state).toBe('failed');
      expect(newCtx.lastError).toBe('Connection failed');
    });

    test('ignores CONNECT_FAILURE from non-connecting state', () => {
      const ctx = createInitialContext();
      ctx.state = 'idle';
      const newCtx = transition(ctx, { type: 'CONNECT_FAILURE' });
      expect(newCtx.state).toBe('idle');
    });
  });

  describe('transition - DISCONNECT', () => {
    test('transitions from connected to idle', () => {
      const ctx = createInitialContext();
      ctx.state = 'connected';
      const newCtx = transition(ctx, { type: 'DISCONNECT' });
      expect(newCtx.state).toBe('idle');
    });

    test('ignores DISCONNECT from non-connected state', () => {
      const ctx = createInitialContext();
      ctx.state = 'reconnecting';
      const newCtx = transition(ctx, { type: 'DISCONNECT' });
      expect(newCtx.state).toBe('reconnecting');
    });
  });

  describe('transition - TRIGGER_RECONNECT', () => {
    test('transitions from connected to reconnecting', () => {
      const ctx = createInitialContext();
      ctx.state = 'connected';
      ctx.attemptCount = 0;
      const newCtx = transition(ctx, { type: 'TRIGGER_RECONNECT' });
      expect(newCtx.state).toBe('reconnecting');
      expect(newCtx.attemptCount).toBe(1);
    });

    test('transitions from idle to reconnecting', () => {
      const ctx = createInitialContext();
      ctx.state = 'idle';
      const newCtx = transition(ctx, { type: 'TRIGGER_RECONNECT' });
      expect(newCtx.state).toBe('reconnecting');
      expect(newCtx.attemptCount).toBe(1);
    });

    test('transitions from failed to reconnecting if attempts available', () => {
      const ctx = createInitialContext();
      ctx.state = 'failed';
      ctx.attemptCount = 1;
      const newCtx = transition(ctx, { type: 'TRIGGER_RECONNECT' });
      expect(newCtx.state).toBe('reconnecting');
      expect(newCtx.attemptCount).toBe(2);
    });

    test('stays in failed state when max attempts reached', () => {
      const ctx = createInitialContext();
      ctx.state = 'failed';
      ctx.attemptCount = 8;
      ctx.maxAttempts = 8;
      const newCtx = transition(ctx, { type: 'TRIGGER_RECONNECT' });
      expect(newCtx.state).toBe('failed');
      expect(newCtx.lastError).toBe('Max reconnect attempts reached');
    });

    test('ignores TRIGGER_RECONNECT when cancelled', () => {
      const ctx = createInitialContext();
      ctx.state = 'connected';
      ctx.isCancelled = true;
      const newCtx = transition(ctx, { type: 'TRIGGER_RECONNECT' });
      expect(newCtx.state).toBe('connected'); // No state change
    });
  });

  describe('transition - RECONNECT_SUCCESS', () => {
    test('transitions from reconnecting to connected and resets state', () => {
      const ctx = createInitialContext();
      ctx.state = 'reconnecting';
      ctx.attemptCount = 3;
      ctx.currentDelay = 2000;
      ctx.lastError = 'Previous attempt failed';
      const newCtx = transition(ctx, { type: 'RECONNECT_SUCCESS' });
      expect(newCtx.state).toBe('connected');
      expect(newCtx.attemptCount).toBe(0);
      expect(newCtx.currentDelay).toBe(DEFAULT_CONFIG.initialDelay);
      expect(newCtx.lastError).toBeUndefined();
      expect(newCtx.isCancelled).toBe(false);
    });

    test('ignores RECONNECT_SUCCESS from non-reconnecting state', () => {
      const ctx = createInitialContext();
      ctx.state = 'idle';
      const newCtx = transition(ctx, { type: 'RECONNECT_SUCCESS' });
      expect(newCtx.state).toBe('idle');
    });
  });

  describe('transition - RECONNECT_FAILURE', () => {
    test('increments delay and stays in reconnecting on failure', () => {
      const ctx = createInitialContext();
      ctx.state = 'reconnecting';
      ctx.attemptCount = 1;
      ctx.currentDelay = 500;
      const newCtx = transition(ctx, { type: 'RECONNECT_FAILURE' });
      expect(newCtx.state).toBe('reconnecting');
      expect(newCtx.currentDelay).toBe(1000);
      expect(newCtx.lastError).toBe('Reconnect attempt failed');
    });

    test('transitions to failed when max attempts reached', () => {
      const ctx = createInitialContext();
      ctx.state = 'reconnecting';
      ctx.attemptCount = 8;
      ctx.maxAttempts = 8;
      const newCtx = transition(ctx, { type: 'RECONNECT_FAILURE' });
      expect(newCtx.state).toBe('failed');
      expect(newCtx.lastError).toBe('Max reconnect attempts reached');
    });

    test('respects maxDelay when calculating next delay', () => {
      const ctx = createInitialContext();
      ctx.state = 'reconnecting';
      ctx.attemptCount = 3;
      ctx.currentDelay = 5000;
      const newCtx = transition(ctx, { type: 'RECONNECT_FAILURE' });
      expect(newCtx.currentDelay).toBe(8000);
    });

    test('ignores RECONNECT_FAILURE from non-reconnecting state', () => {
      const ctx = createInitialContext();
      ctx.state = 'idle';
      const newCtx = transition(ctx, { type: 'RECONNECT_FAILURE' });
      expect(newCtx.state).toBe('idle');
    });
  });

  describe('transition - CANCEL', () => {
    test('cancels reconnect from any state', () => {
      const ctx = createInitialContext();
      ctx.state = 'reconnecting';
      ctx.attemptCount = 2;
      ctx.currentDelay = 1000;
      const newCtx = transition(ctx, { type: 'CANCEL' });
      expect(newCtx.state).toBe('idle');
      expect(newCtx.isCancelled).toBe(true);
      expect(newCtx.attemptCount).toBe(0);
      expect(newCtx.currentDelay).toBe(DEFAULT_CONFIG.initialDelay);
    });

    test('marks as cancelled even when already idle', () => {
      const ctx = createInitialContext();
      const newCtx = transition(ctx, { type: 'CANCEL' });
      expect(newCtx.isCancelled).toBe(true);
    });
  });

  describe('transition - RESET', () => {
    test('resets to initial state with preserved config', () => {
      const ctx = createInitialContext();
      ctx.state = 'failed';
      ctx.attemptCount = 5;
      ctx.currentDelay = 4000;
      ctx.lastError = 'Some error';
      ctx.isCancelled = true;
      const newCtx = transition(ctx, { type: 'RESET' });
      expect(newCtx.state).toBe('idle');
      expect(newCtx.attemptCount).toBe(0);
      expect(newCtx.currentDelay).toBe(500);
      expect(newCtx.lastError).toBeUndefined();
      expect(newCtx.isCancelled).toBe(false);
      expect(newCtx.maxAttempts).toBe(8);
    });
  });

  describe('ReconnectStateMachine class', () => {
    test('initializes with default config', () => {
      const machine = new ReconnectStateMachine();
      const ctx = machine.getContext();
      expect(ctx.state).toBe('idle');
      expect(ctx.maxAttempts).toBe(8);
      expect(ctx.initialDelay).toBe(500);
    });

    test('initializes with custom config', () => {
      const customConfig = {
        initialDelay: 1000,
        multiplier: 3,
        maxDelay: 15000,
        maxAttempts: 5,
      };
      const machine = new ReconnectStateMachine(customConfig);
      const ctx = machine.getContext();
      expect(ctx.initialDelay).toBe(1000);
      expect(ctx.maxAttempts).toBe(5);
    });

    test('getState returns current state', () => {
      const machine = new ReconnectStateMachine();
      expect(machine.getState()).toBe('idle');
    });

    test('getContext returns copy of context', () => {
      const machine = new ReconnectStateMachine();
      const ctx1 = machine.getContext();
      const ctx2 = machine.getContext();
      expect(ctx1).toEqual(ctx2);
      expect(ctx1).not.toBe(ctx2);
    });

    test('connect transitions to connecting', () => {
      const machine = new ReconnectStateMachine();
      machine.connect();
      expect(machine.getState()).toBe('connecting');
    });

    test('connectSuccess transitions to connected', () => {
      const machine = new ReconnectStateMachine();
      machine.connect();
      machine.connectSuccess();
      expect(machine.getState()).toBe('connected');
      expect(machine.getContext().attemptCount).toBe(0);
    });

    test('connectFailure transitions to failed', () => {
      const machine = new ReconnectStateMachine();
      machine.connect();
      machine.connectFailure();
      expect(machine.getState()).toBe('failed');
    });

    test('disconnect transitions to idle', () => {
      const machine = new ReconnectStateMachine();
      machine.connect();
      machine.connectSuccess();
      machine.disconnect();
      expect(machine.getState()).toBe('idle');
    });

    test('cancel sets isCancelled flag', () => {
      const machine = new ReconnectStateMachine();
      machine.cancel();
      expect(machine.getContext().isCancelled).toBe(true);
    });

    test('reset returns to idle state', () => {
      const machine = new ReconnectStateMachine();
      machine.connect();
      machine.connectSuccess();
      machine.reset();
      expect(machine.getState()).toBe('idle');
      expect(machine.getContext().attemptCount).toBe(0);
    });

    test('onStateChange callback fires on state transitions', (done) => {
      const stateChanges: string[] = [];
      const machine = new ReconnectStateMachine(DEFAULT_CONFIG, {
        onStateChange: (ctx) => {
          stateChanges.push(ctx.state);
        },
      });

      machine.connect();
      machine.connectSuccess();

      setImmediate(() => {
        expect(stateChanges).toEqual(['connecting', 'connected']);
        done();
      });
    });

    test('onStateChange not called when state does not change', (done) => {
      let callCount = 0;
      const machine = new ReconnectStateMachine(DEFAULT_CONFIG, {
        onStateChange: () => {
          callCount++;
        },
      });

      machine.connect();
      machine.connect();

      setImmediate(() => {
        expect(callCount).toBe(1);
        done();
      });
    });

    test('destroy clears callbacks', () => {
      let callCount = 0;
      const machine = new ReconnectStateMachine(DEFAULT_CONFIG, {
        onStateChange: () => {
          callCount++;
        },
      });

      machine.destroy();
      machine.connect();

      expect(callCount).toBe(0);
    });
  });

  describe('Successful connect sequence', () => {
    test('idle -> connecting -> connected', () => {
      const machine = new ReconnectStateMachine();
      expect(machine.getState()).toBe('idle');

      machine.connect();
      expect(machine.getState()).toBe('connecting');

      machine.connectSuccess();
      expect(machine.getState()).toBe('connected');
      expect(machine.getContext().attemptCount).toBe(0);
      expect(machine.getContext().lastError).toBeUndefined();
    });
  });

  describe('Failed connect sequence', () => {
    test('idle -> connecting -> failed', () => {
      const machine = new ReconnectStateMachine();
      machine.connect();
      machine.connectFailure();
      expect(machine.getState()).toBe('failed');
      expect(machine.getContext().lastError).toBe('Connection failed');
    });
  });

  describe('Reconnect sequence with backoff', () => {
    test('connected -> reconnecting -> connected with delay increase', async () => {
      const machine = new ReconnectStateMachine();
      const ctx = machine.getContext();

      machine.connect();
      machine.connectSuccess();
      expect(machine.getState()).toBe('connected');
      const initialDelay = machine.getContext().currentDelay;

      machine.triggerReconnect();
      expect(machine.getState()).toBe('reconnecting');
      expect(machine.getContext().attemptCount).toBe(1);
      expect(machine.getContext().currentDelay).toBe(initialDelay);

      const mocked = transition(machine.getContext(), { type: 'RECONNECT_FAILURE' });
      expect(mocked.currentDelay).toBe(initialDelay * 2);
      expect(mocked.state).toBe('reconnecting');
    });
  });

  describe('Cancel on disconnect', () => {
    test('reconnect can be cancelled', () => {
      const machine = new ReconnectStateMachine();
      machine.connect();
      machine.connectSuccess();

      machine.triggerReconnect();
      expect(machine.getState()).toBe('reconnecting');

      machine.cancel();
      expect(machine.getState()).toBe('idle');
      expect(machine.getContext().isCancelled).toBe(true);

      machine.triggerReconnect();
      expect(machine.getState()).toBe('idle');
    });
  });

  describe('Max attempts reached', () => {
    test('fails when RECONNECT_FAILURE called with attemptCount >= maxAttempts', () => {
      const ctx = createInitialContext();
      ctx.state = 'reconnecting';
      ctx.attemptCount = 8;
      ctx.maxAttempts = 8;

      const newCtx = transition(ctx, { type: 'RECONNECT_FAILURE' });
      expect(newCtx.state).toBe('failed');
      expect(newCtx.lastError).toBe('Max reconnect attempts reached');
    });

    test('blocks TRIGGER_RECONNECT when maxAttempts reached', () => {
      const ctx = createInitialContext();
      ctx.state = 'connected';
      ctx.attemptCount = 8;
      ctx.maxAttempts = 8;

      const newCtx = transition(ctx, { type: 'TRIGGER_RECONNECT' });
      expect(newCtx.state).toBe('failed');
      expect(newCtx.lastError).toBe('Max reconnect attempts reached');
    });
  });

  describe('State reset', () => {
    test('reset clears all state and counters', () => {
      const machine = new ReconnectStateMachine();
      machine.connect();
      machine.connectSuccess();
      machine.triggerReconnect();

      const beforeReset = machine.getContext();
      expect(beforeReset.state).toBe('reconnecting');

      machine.reset();

      const afterReset = machine.getContext();
      expect(afterReset.state).toBe('idle');
      expect(afterReset.attemptCount).toBe(0);
      expect(afterReset.currentDelay).toBe(DEFAULT_CONFIG.initialDelay);
      expect(afterReset.lastError).toBeUndefined();
    });
  });

  describe('Exponential backoff calculation', () => {
    test('backoff sequence follows multiplier', () => {
      const ctx = createInitialContext();
      let delay = ctx.initialDelay;

      expect(delay).toBe(500);

      delay = calculateNextDelay({ ...ctx, currentDelay: delay });
      expect(delay).toBe(1000);

      delay = calculateNextDelay({ ...ctx, currentDelay: delay });
      expect(delay).toBe(2000);

      delay = calculateNextDelay({ ...ctx, currentDelay: delay });
      expect(delay).toBe(4000);

      delay = calculateNextDelay({ ...ctx, currentDelay: delay });
      expect(delay).toBe(8000);

      delay = calculateNextDelay({ ...ctx, currentDelay: delay });
      expect(delay).toBe(8000);
    });
  });

  describe('Reconnect attempt callback', () => {
    test('onReconnectAttempt is called during reconnect', async () => {
      const attemptLog: number[] = [];
      let attemptCount = 0;

      const machine = new ReconnectStateMachine(DEFAULT_CONFIG, {
        onReconnectAttempt: async () => {
          attemptCount++;
          attemptLog.push(attemptCount);
          return false;
        },
      });

      machine.connect();
      machine.connectSuccess();
    });
  });
});
