import { createForegroundServiceLifecycle } from '../ForegroundServiceLifecycle';

describe('foreground service lifecycle', () => {
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
