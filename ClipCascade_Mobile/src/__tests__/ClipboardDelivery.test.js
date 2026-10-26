import { createClipboardDelivery } from '../ClipboardDelivery';

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
