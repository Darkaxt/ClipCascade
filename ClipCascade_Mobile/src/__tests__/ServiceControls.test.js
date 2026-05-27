import {
  getConnectedHeaderActions,
  getConnectedServiceActions,
} from '../ServiceControls';

describe('connected service actions', () => {
  test('does not expose restart while the foreground service is stopped', () => {
    expect(getConnectedServiceActions('false')).toEqual({
      primaryLabel: 'Start',
      showRestart: false,
    });
  });

  test('exposes restart only while the foreground service is running', () => {
    expect(getConnectedServiceActions('true')).toEqual({
      primaryLabel: 'Stop',
      showRestart: true,
    });
  });

  test('exposes logout as a header action separate from service controls', () => {
    expect(getConnectedHeaderActions()).toEqual({
      showLogout: true,
      showSettings: true,
    });
  });
});
