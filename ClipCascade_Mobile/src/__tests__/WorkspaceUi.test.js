import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert, TextInput, TouchableOpacity } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import ConnectedWorkspace from '../ConnectedWorkspace';
import ClipboardActivityLog from '../ClipboardActivityLog';
import {
  appendClipboardEvent,
  clearClipboardEvents,
} from '../ClipboardEventLog';
import { registerClipboardResender } from '../ClipboardResend';

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));
jest.mock('../AsyncStorageManagement', () => ({
  setDataInAsyncStorage: jest.fn(),
}));
jest.mock('lucide-react-native', () => {
  const ReactModule = require('react');
  const Icon = props => ReactModule.createElement('View', props);
  return new Proxy(
    {},
    { get: (_target, key) => (key === '__esModule' ? true : Icon) },
  );
});

global.IS_REACT_ACT_ENVIRONMENT = true;
const button = (tree, label) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find(node => node.props.accessibilityLabel === label);
let tree;
let unregister;
beforeEach(() => {
  clearClipboardEvents();
  jest.clearAllMocks();
});
afterEach(() => {
  act(() => {
    tree?.unmount();
    unregister?.();
  });
  tree = null;
  unregister = null;
});

test('native history copy is local, resend explicit and search does not lose entries', async () => {
  const send = jest.fn().mockResolvedValue(true);
  unregister = registerClipboardResender({ isConnected: () => true, send });
  appendClipboardEvent({
    direction: 'outbound',
    type: 'text',
    status: 'sent',
    content: 'Harmless complete project notes',
  });
  act(() => {
    tree = renderer.create(<ClipboardActivityLog />);
  });
  await act(async () => {
    await button(tree, 'Copy locally without syncing').props.onPress();
  });
  expect(Clipboard.setString).toHaveBeenCalledWith(
    'Harmless complete project notes',
  );
  expect(send).not.toHaveBeenCalled();
  await act(async () => {
    await button(tree, 'Resend text to connected devices').props.onPress();
  });
  expect(send).toHaveBeenCalledWith('Harmless complete project notes', 'text', {
    manualResend: true,
  });
  act(() => {
    tree.root.findByType(TextInput).props.onChangeText('no match');
  });
  expect(button(tree, 'Copy locally without syncing').props.disabled).toBe(
    true,
  );
  act(() => {
    tree.root.findByType(TextInput).props.onChangeText('project');
  });
  expect(button(tree, 'Copy locally without syncing').props.disabled).toBe(
    false,
  );
});

test('native image rows disable text actions and clear history requires confirmation', () => {
  appendClipboardEvent({
    direction: 'inbound',
    type: 'image',
    status: 'applied',
  });
  act(() => {
    tree = renderer.create(<ClipboardActivityLog />);
  });
  expect(button(tree, 'Copy locally without syncing').props.disabled).toBe(
    true,
  );
  expect(button(tree, 'Resend text to connected devices').props.disabled).toBe(
    true,
  );
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  act(() => {
    button(tree, 'Clear history').props.onPress();
  });
  expect(alert).toHaveBeenCalledWith(
    'Clear clipboard history?',
    expect.any(String),
    expect.arrayContaining([
      expect.objectContaining({ style: 'cancel' }),
      expect.objectContaining({ style: 'destructive' }),
    ]),
  );
});

test('native workspace routes health, settings and service actions without changing transport', () => {
  const onSettings = jest.fn();
  const onToggleService = jest.fn();
  const onRestart = jest.fn();
  act(() => {
    tree = renderer.create(
      <ConnectedWorkspace
        running
        data={{
          cipher_enabled: 'true',
          server_url: 'https://clipboard.example',
        }}
        captureState={{ backend: 'paused', shizukuStatus: 'not_authorized' }}
        onSettings={onSettings}
        onToggleService={onToggleService}
        onRestart={onRestart}
        onLogout={jest.fn()}
        appVersion="test"
      />,
    );
  });
  act(() => {
    button(tree, 'Health').props.onPress();
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Shizuku permission denied');
  act(() => {
    button(tree, 'Restart service').props.onPress();
    button(tree, 'Stop service').props.onPress();
    button(tree, 'Settings').props.onPress();
  });
  expect(onRestart).toHaveBeenCalledTimes(1);
  expect(onToggleService).toHaveBeenCalledTimes(1);
  expect(onSettings).toHaveBeenCalledTimes(1);
});
