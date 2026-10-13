import {
  registerClipboardResender,
  resendClipboardText,
  isClipboardResendAvailable,
} from '../ClipboardResend';

test('explicit resend sends retained text every time, never offline or evicted', async () => {
  let connected = true;
  const send = jest.fn(async () => true);
  const release = registerClipboardResender({ send, isConnected: () => connected });
  const getText = () => 'full value';
  expect(isClipboardResendAvailable()).toBe(true);
  expect(await resendClipboardText('row', getText)).toBe('sent');
  expect(await resendClipboardText('row', getText)).toBe('sent');
  expect(send).toHaveBeenCalledTimes(2);
  expect(send).toHaveBeenCalledWith('full value', 'text', { manualResend: true });
  connected = false;
  expect(await resendClipboardText('row', getText)).toBe('disconnected');
  expect(await resendClipboardText('row', () => undefined)).toBe('unavailable');
  expect(send).toHaveBeenCalledTimes(2);
  release();
});

test('stale service cleanup cannot unregister its replacement', async () => {
  const releaseOld = registerClipboardResender({ send: jest.fn(), isConnected: () => true });
  const send = jest.fn(async () => false);
  const release = registerClipboardResender({ send, isConnected: () => true });
  releaseOld();
  expect(isClipboardResendAvailable()).toBe(true);
  expect(await resendClipboardText('row', () => 'text')).toBe('failed');
  send.mockRejectedValueOnce(new Error('connection lost'));
  expect(await resendClipboardText('row', () => 'text')).toBe('failed');
  release();
  expect(isClipboardResendAvailable()).toBe(false);
});
