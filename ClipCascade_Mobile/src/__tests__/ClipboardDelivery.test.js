import { createClipboardDelivery } from '../ClipboardDelivery';

test('forty unconfirmed retries keep wire identity and do not paste on successful receiver again', async () => {
  const sender = createClipboardDelivery();
  const receiver = createClipboardDelivery();
  const apply = jest.fn().mockResolvedValue(true);
  const build = jest.fn(async () => ({ id: `id-${build.mock.calls.length}`, body: 'encrypted-wire-body' }));
  for (let i = 0; i < 40; i += 1) {
    const message = await sender.prepare('example', 'text', build);
    expect(message.body).toBe('encrypted-wire-body');
    expect(await receiver.applyOnce({ deliveryId: message.id, sourceSessionId: 'source' }, 'example', 'text', apply)).toBe(true);
  }
  expect(build).toHaveBeenCalledTimes(1);
  expect(apply).toHaveBeenCalledTimes(1);
  await sender.prepare('example', 'text', build, true);
  expect(build).toHaveBeenCalledTimes(2);
  await sender.prepare('different', 'text', build);
  expect(build).toHaveBeenCalledTimes(3);
  sender.resetOutbound();
  await sender.prepare('different', 'text', build);
  expect(build).toHaveBeenCalledTimes(4);
});

test('concurrent unconfirmed sends share the same encryption operation', async () => {
  const sender = createClipboardDelivery();
  const build = jest.fn(async () => ({ id: 'id', body: 'encrypted' }));
  const first = sender.prepare('example', 'text', build);
  const second = sender.prepare('example', 'text', build);
  expect(await first).toEqual(await second);
  expect(build).toHaveBeenCalledTimes(1);
});

test('an encryption operation cannot repopulate a reset connection', async () => {
  const sender = createClipboardDelivery();
  let finish;
  const build = () => new Promise(resolve => { finish = resolve; });
  const preparing = sender.prepare('example', 'text', build);
  await Promise.resolve();
  sender.resetOutbound();
  finish({ id: 'stale', body: 'old connection' });
  await expect(preparing).rejects.toThrow('connection change');
  expect(sender.acknowledge({ protocol: 1, kind: 'clipboard_delivery', deliveryId: 'stale', expected: 1, applied: 1, complete: true })).toBeNull();
});

test('a send is eligible until all recipients explicitly acknowledge application', () => {
  const delivery = createClipboardDelivery({ now: () => 1000 });
  delivery.begin('id-1', 'example', 'text');
  expect(delivery.shouldSuppress('example', 'text')).toBe(false);
  expect(delivery.acknowledge({ protocol: 1, kind: 'clipboard_delivery', deliveryId: 'id-1', expected: 0, applied: 0, complete: true })).toBeNull();
  expect(delivery.shouldSuppress('example', 'text')).toBe(false);
  expect(delivery.acknowledge({ protocol: 1, kind: 'clipboard_delivery', deliveryId: 'id-1', expected: 2, applied: 1, complete: false })).toBeNull();
  expect(delivery.acknowledge({ protocol: 1, kind: 'clipboard_delivery', deliveryId: 'id-1', expected: 2, applied: 2, complete: true })).toBe('text');
  expect(delivery.shouldSuppress('example', 'text')).toBe(true);
  delivery.resetOutbound();
  expect(delivery.shouldSuppress('example', 'text')).toBe(false);
});

test('failed apply stays retryable, successful retransmit is ACKable without reapply', async () => {
  const delivery = createClipboardDelivery();
  const meta = { deliveryId: 'id-1', sourceSessionId: 'phone' };
  const apply = jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
  expect(await delivery.applyOnce(meta, 'example', 'text', apply)).toBe(false);
  expect(await delivery.applyOnce(meta, 'example', 'text', apply)).toBe(true);
  expect(await delivery.applyOnce(meta, 'example', 'text', apply)).toBe(true);
  expect(apply).toHaveBeenCalledTimes(2);
});

test('concurrent retransmits share application and changed content is not falsely ACKed', async () => {
  const delivery = createClipboardDelivery();
  const meta = { deliveryId: 'id-1', sourceSessionId: 'phone' };
  let finish;
  const apply = jest.fn(() => new Promise(resolve => { finish = resolve; }));
  const first = delivery.applyOnce(meta, 'example', 'text', apply);
  const duplicate = delivery.applyOnce(meta, 'example', 'text', apply);
  await Promise.resolve();
  finish(true);
  expect(await first).toBe(true);
  expect(await duplicate).toBe(true);
  expect(apply).toHaveBeenCalledTimes(1);
  await expect(delivery.applyOnce(meta, 'changed', 'text', apply)).rejects.toThrow();
});
