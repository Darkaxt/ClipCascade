import { createForegroundServiceLifecycle } from '../ForegroundServiceLifecycle';

describe('foreground service lifecycle', () => {
  test('native ticks progress while JS timers are suspended and cancellation wakes a pending tick', async () => {
    jest.useFakeTimers();
    try {
      const lifecycle = createForegroundServiceLifecycle();
      let callback;
      let nativeTick;
      let enteredPendingTick;
      const pendingTick = new Promise(resolve => { enteredPendingTick = resolve; });
      const events = [];
      lifecycle.register(handler => { callback = handler; }, async (notification, run) => {
        events.push(`start:${notification.id}`);
        if (notification.id === 'first') {
          await run.waitForTick(() => new Promise(resolve => { nativeTick = resolve; }));
          events.push('tick');
          await run.waitForTick(() => {
            enteredPendingTick();
            return new Promise(() => {});
          });
          expect(run.isCancellationRequested()).toBe(true);
          events.push('cleanup');
        }
      });
      const first = callback({id: 'first'});
      await Promise.resolve();
      nativeTick();
      await pendingTick;
      const replacement = callback({id: 'second'});
      await Promise.all([first, replacement]);
      expect(events).toEqual(['start:first', 'tick', 'cleanup', 'start:second']);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  test('native wait failures propagate without preventing replacement cleanup', async () => {
    const lifecycle = createForegroundServiceLifecycle();
    let callback;
    const error = new Error('native tick unavailable');
    lifecycle.register(handler => { callback = handler; }, async (_, run) => {
      await expect(run.waitForTick(() => Promise.reject(error))).rejects.toBe(error);
      run.cancel();
      const wait = jest.fn();
      await run.waitForTick(wait);
      expect(wait).not.toHaveBeenCalled();
    });
    await callback({id: 'first'});
    await callback({id: 'second'});
  });

  test('service polling uses the native tick and module destruction clears pending callbacks', () => {
    const fs = require('fs');
    const path = require('path');
    const service = fs.readFileSync(path.join(__dirname, '../StartForegroundService.js'), 'utf8');
    const native = fs.readFileSync(path.join(__dirname, '../android/app/src/main/java/com/clipcascade/NativeBridgeModule.kt'), 'utf8');
    expect(service).toContain('NativeBridgeModule.waitForServiceTick()');
    expect(service).not.toContain('await sleep(1000)');
    expect(native).toContain('Handler(Looper.getMainLooper())');
    expect(native).toContain('postDelayed({ promise.resolve(true) }, 1000L)');
    expect(native).toContain('serviceTickHandler.removeCallbacksAndMessages(null)');
  });

  test('registers the native foreground callback only once', () => {
    const lifecycle = createForegroundServiceLifecycle();
    const register = jest.fn();
    const runner = jest.fn();

    lifecycle.register(register, runner);
    lifecycle.register(register, runner);

    expect(register).toHaveBeenCalledTimes(1);
  });

  test('cancels and finishes the previous run before starting another', async () => {
    const lifecycle = createForegroundServiceLifecycle();
    const events = [];
    let foregroundCallback;

    lifecycle.register(callback => {
      foregroundCallback = callback;
    }, async (notification, run) => {
      events.push(`start:${notification.id}`);
      if (notification.id === 'first') {
        await run.waitForCancellation();
        events.push('stop:first');
      }
    });

    const firstRun = foregroundCallback({ id: 'first' });
    await Promise.resolve();
    const secondRun = foregroundCallback({ id: 'second' });

    await Promise.all([firstRun, secondRun]);

    expect(events).toEqual(['start:first', 'stop:first', 'start:second']);
  });
});
