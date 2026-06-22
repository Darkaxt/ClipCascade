import { shouldApplyPolledStatusMessage } from '../UiStatusMessage';

describe('UI status message polling', () => {
  test('applies empty service messages so recovered warnings are cleared', () => {
    expect(shouldApplyPolledStatusMessage('')).toBe(true);
    expect(shouldApplyPolledStatusMessage('✅ Connected')).toBe(true);
  });

  test('ignores missing service messages', () => {
    expect(shouldApplyPolledStatusMessage(null)).toBe(false);
    expect(shouldApplyPolledStatusMessage(undefined)).toBe(false);
  });
});
