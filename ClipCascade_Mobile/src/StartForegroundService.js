/* global TextEncoder, TextDecoder */
import {
  NativeEventEmitter,
  NativeModules,
  DeviceEventEmitter,
  Alert,
} from 'react-native';

import notifee, { AndroidImportance } from '@notifee/react-native';
import { Client } from '@stomp/stompjs';
import * as encoding from 'text-encoding'; //do not remove this (polyfills for TextEncoder/TextDecoder stompjs)
import { xxHash32 } from 'js-xxhash';
import AesGcmCrypto from 'react-native-aes-gcm-crypto';
import { Buffer } from 'buffer';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
} from 'react-native-webrtc';
import Clipboard from '@react-native-clipboard/clipboard';

import {
  setDataInAsyncStorage,
  getDataFromAsyncStorage,
  getMultipleDataFromAsyncStorage,
  clearAsyncStorage,
} from './AsyncStorageManagement';
import {
  normalizeRuntimeSettings,
  resolveClipboardLimit,
} from './ServiceHealth';
import {
  appendClipboardEvent,
  clearClipboardEvents,
} from './ClipboardEventLog';
import {
  clearClipboardEchoSuppression,
  setClipboardEchoSuppression,
  shouldSuppressClipboardEcho,
} from './ClipboardEchoSuppression';
import {
  createSafeKeyStore,
  deleteSafeKeyStoreValue,
  getSafeKeyStoreValue,
  setSafeKeyStoreValue,
} from './SafeKeyStore';
import {
  getClipboardCaptureUnavailableMessage,
  resolveClipboardCaptureProvider,
} from './ClipboardCaptureProvider';

function cleanupClipboardListeners() {
  DeviceEventEmitter.removeAllListeners('SHARED_TEXT');
  DeviceEventEmitter.removeAllListeners('SHARED_IMAGE');
  DeviceEventEmitter.removeAllListeners('SHARED_FILES');
  DeviceEventEmitter.removeAllListeners('onClipboardChange');
  DeviceEventEmitter.removeAllListeners('onShizukuStatusChange');
}

module.exports = async (inputData = null) => {
  // Constants
  const SUBSCRIPTION_DESTINATION = '/user/queue/cliptext';
  const SEND_DESTINATION = '/app/cliptext';
  const RECONNECT_WS_TIMER = 10000; // 10 seconds
  const HEARTBEAT_INTERVAL = 20000; // 20 seconds
  const FRAGMENT_SIZE = 15360; // 15 KiB

  // forground service
  notifee.registerForegroundService(notification => {
    return new Promise(async () => {
      try {
        const { NativeBridgeModule, ClipboardListener, ShizukuClipboard } =
          NativeModules;
        const textEncoder = new TextEncoder();
        const textDecoder = new TextDecoder();
        clearClipboardEvents();
        await clearClipboardEchoSuppression({
          setValue: setDataInAsyncStorage,
        });
        cleanupClipboardListeners();
        try {
          await ClipboardListener.stopListening();
        } catch (error) {
          // no-op
        }
        try {
          await ShizukuClipboard?.stopListening?.();
        } catch (error) {
          // no-op
        }

        let previous_clipboard_content_hash = '';
        let toggle = false; // p2s toggle
        let block_image_once = false;
        let files_in_memory = null;
        let websocket_status_notification_toggle = false;
        let p2pMsg = null; // p2p status message

        let stompClient = null;
        let wsSignalingClient = null;
        let sendClipBoardP2S = null;
        let sendClipBoardP2P = null;
        let stopServicesP2S = null;
        let stopServicesP2P = null;
        let getP2PStatusMessage = null;
        let isP2PStatusMsgChanged = false;

        // get data from async storage
        const initialSettings = await getMultipleDataFromAsyncStorage([
          'websocket_url',
          'cipher_enabled',
          'maxsize',
          'server_mode',
          'stun_url',
          'enable_image_sharing',
          'enable_file_sharing',
          'enable_shizuku_clipboard_backend',
          'enable_websocket_status_notification',
          'max_clipboard_size_local_limit_bytes',
        ]);

        const {
          websocket_url,
          cipher_enabled,
          maxsize: maxsizeStr,
          server_mode,
          stun_url,
          enable_image_sharing,
          enable_file_sharing,
          enable_shizuku_clipboard_backend,
          enable_websocket_status_notification,
          max_clipboard_size_local_limit_bytes: maxClipboardLimitStr,
        } = initialSettings;

        const maxsize = Number(maxsizeStr);
        let runtimeSettings = {
          enable_shizuku_clipboard_backend:
            enable_shizuku_clipboard_backend || 'false',
          enable_image_sharing,
          enable_file_sharing,
          enable_websocket_status_notification,
          max_clipboard_size_local_limit_bytes: resolveClipboardLimit(
            maxClipboardLimitStr,
            maxsize,
          ),
        };

        // encrption
        const encrypt = async plainText => {
          try {
            const encryptedData = await AesGcmCrypto.encrypt(
              plainText,
              false,
              await getDataFromAsyncStorage('hashed_password'),
            );
            return JSON.stringify({
              nonce: Buffer.from(encryptedData.iv, 'hex').toString('base64'),
              ciphertext: encryptedData.content,
              tag: Buffer.from(encryptedData.tag, 'hex').toString('base64'),
            });
          } catch (e) {
            throw new Error('Failed to encrypt: ' + e);
          }
        };

        // decryption
        const decrypt = async encryptedData => {
          try {
            const plainText = await AesGcmCrypto.decrypt(
              encryptedData['ciphertext'],
              await getDataFromAsyncStorage('hashed_password'),
              Buffer.from(encryptedData['nonce'], 'base64').toString('hex'),
              Buffer.from(encryptedData['tag'], 'base64').toString('hex'),
              false,
            );
            return plainText;
          } catch (e) {
            throw new Error('Failed to decrypt: ' + e);
          }
        };

        // hash clipboard content
        const hashCB = async (input, seed = 0) => {
          return String(xxHash32(input, seed));
        };

        //check if clipboard content changed
        const newCB = async hcb => {
          return previous_clipboard_content_hash !== hcb;
        };

        const calculateBase64DecodedLength = async base64Str => {
          // Calculates the decoded byte length of a Base64-encoded string.
          const n = base64Str.length;
          const padding = (base64Str.match(/=/g) || []).length;
          return 3 * (n / 4) - padding;
        };

        const getOutboundFilePaths = clipContent =>
          String(clipContent)
            .split(',')
            .filter(item => item.trim() !== '');

        const getOutboundClipboardMetadata = async (
          clipContent,
          type_ = 'text',
        ) => {
          try {
            if (type_ === 'image' && typeof clipContent === 'string') {
              return {
                sizeBytes: Number(
                  await NativeBridgeModule.getFileSize(clipContent),
                ),
              };
            }

            if (type_ === 'files' && typeof clipContent === 'string') {
              const filePaths = getOutboundFilePaths(clipContent);
              const fileNames = [];
              for (const filePath of filePaths.slice(0, 3)) {
                fileNames.push(await NativeBridgeModule.getFileName(filePath));
              }

              return {
                fileCount: filePaths.length,
                fileNames,
              };
            }
          } catch (error) {
            return {};
          }

          return {};
        };

        const getInboundClipboardMetadata = async (
          clipContent,
          type_ = 'text',
        ) => {
          try {
            if (type_ === 'image') {
              return {
                sizeBytes: await calculateBase64DecodedLength(clipContent),
              };
            }

            if (type_ === 'files') {
              const files = JSON.parse(clipContent);
              let sizeBytes = 0;
              for (const fileName in files) {
                sizeBytes += await calculateBase64DecodedLength(
                  files[fileName],
                );
              }

              return {
                fileCount: Object.keys(files).length,
                fileNames: Object.keys(files).slice(0, 3),
                sizeBytes,
              };
            }
          } catch (error) {
            return {};
          }

          return {};
        };

        const appendActivityEvent = async ({
          direction,
          type = 'text',
          status,
          content,
          metadata = {},
          operationKey,
        }) => {
          appendClipboardEvent({
            direction: direction.toLowerCase(),
            type,
            status,
            content: type === 'text' ? content : undefined,
            metadata,
            operationKey,
          });
        };

        const appendActivityError = async (direction, type_, error) => {
          await appendActivityEvent({
            direction,
            type: type_,
            status: 'Error',
            metadata: {
              statusDetail: String(error),
            },
          });
        };

        const setLocalClipboardEchoSuppression = async (
          type_,
          contentHash = '',
        ) => {
          await setClipboardEchoSuppression({
            setValue: setDataInAsyncStorage,
            type: type_,
            contentHash,
          });
        };

        const shouldSuppressLocalClipboardEcho = async (type_, content) => {
          return shouldSuppressClipboardEcho({
            getValue: getDataFromAsyncStorage,
            hashCB,
            type: type_,
            content,
          });
        };

        const clearLocalClipboardEchoSuppression = async () => {
          await clearClipboardEchoSuppression({
            setValue: setDataInAsyncStorage,
          });
        };

        const resetLocalClipboardEchoGuards = async () => {
          block_image_once = false;
          await clearLocalClipboardEchoSuppression();
        };

        // fragment string into chunks
        const fragmentString = async (str, fragmentSize) => {
          const bytes = textEncoder.encode(str); // convert to UTF-8 bytes
          const fragments = [];
          for (let i = 0; i < bytes.length; i += fragmentSize) {
            const chunk = bytes.slice(i, i + fragmentSize);
            fragments.push(textDecoder.decode(chunk));
          }
          return fragments;
        };

        // generate uuid
        const generateUuid = async () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
        };

        const p2pStatusMessageChanged = async () => {
          isP2PStatusMsgChanged = true;
        };

        // validate clipboard size
        const validateClipboardSize = async (clipContent, type, direction) => {
          let clipContentByteLength = 0;
          if (type === 'text') {
            clipContentByteLength = Buffer.byteLength(clipContent, 'utf8');
          } else if (type === 'image') {
            if (
              direction.toLowerCase() === 'outbound' &&
              typeof clipContent === 'string'
            ) {
              clipContentByteLength = Number(
                await NativeBridgeModule.getFileSize(clipContent),
              );
            } else if (direction.toLowerCase() === 'inbound') {
              clipContentByteLength = await calculateBase64DecodedLength(
                clipContent,
              );
            }
          } else if (type === 'files') {
            if (
              direction.toLowerCase() === 'outbound' &&
              typeof clipContent === 'string'
            ) {
              const file_paths = clipContent
                .split(',')
                .filter(item => item.trim() !== '');
              for (const file_path of file_paths) {
                clipContentByteLength += Number(
                  await NativeBridgeModule.getFileSize(file_path),
                );
              }
            } else if (direction.toLowerCase() === 'inbound') {
              let files = JSON.parse(clipContent);
              for (const file in files) {
                clipContentByteLength += await calculateBase64DecodedLength(
                  files[file],
                );
              }
            }
          } else {
            return false;
          }

          if (server_mode === 'P2S') {
            if (
              clipContentByteLength <= maxsize &&
              clipContentByteLength <=
                runtimeSettings.max_clipboard_size_local_limit_bytes
            ) {
              return true;
            }
            await setDataInAsyncStorage(
              'wsStatusMessage',
              '⚠️ ' +
                direction +
                ' clipboard ignored: size (' +
                clipContentByteLength +
                ' bytes) exceeds limits; Server max size (' +
                maxsize +
                ' bytes) or Local max size (' +
                runtimeSettings.max_clipboard_size_local_limit_bytes +
                ' bytes)',
            );
          } else if (server_mode === 'P2P') {
            if (
              runtimeSettings.max_clipboard_size_local_limit_bytes < 0 ||
              clipContentByteLength <=
                runtimeSettings.max_clipboard_size_local_limit_bytes
            ) {
              return true;
            }

            p2pMsg =
              '⚠️ ' +
              direction +
              ' clipboard ignored: size (' +
              clipContentByteLength +
              ' bytes) exceeds limits; Local max size (' +
              runtimeSettings.max_clipboard_size_local_limit_bytes +
              ' bytes)';
            await p2pStatusMessageChanged();
          }

          await appendActivityEvent({
            direction,
            type,
            status: 'Ignored',
            content: clipContent,
            metadata: {
              sizeBytes: clipContentByteLength,
              statusDetail:
                'Size ' +
                clipContentByteLength +
                ' bytes exceeds configured limit',
            },
          });

          return false;
        };

        // Event triggered when text content is shared with the app. (or) when text selection popup menu action is invoked
        DeviceEventEmitter.addListener('SHARED_TEXT', async event => {
          try {
            const clipContent = event.text;
            if (clipContent) {
              await appendActivityEvent({
                direction: 'outbound',
                type: 'text',
                status: 'Detected',
                content: clipContent,
              });
              /**
               * Sometimes `Clipboard.setString` is invoked before the app is fully opened, leading to an unauthorized state.
               * To handle this, implement a fail-safe mechanism that retries sending clipboard content only when it hasn't been successfully sent yet.
               * If both events are triggered successfully, the content won't be sent twice because the same content is hashed, ensuring that identical data is only processed once.
               */
              Clipboard.setString(clipContent);
              await sendClipBoard(clipContent, 'text');
            }
          } catch (e) {
            await setDataInAsyncStorage(
              'wsStatusMessage',
              '❌ Outbound Error: ' + e,
            );
            await appendActivityError('outbound', 'text', e);
          }
        });

        // Event listener triggered when image is shared with the app.
        DeviceEventEmitter.addListener('SHARED_IMAGE', async event => {
          try {
            const clipContent = event.image;
            if (clipContent) {
              await appendActivityEvent({
                direction: 'outbound',
                type: 'image',
                status: 'Detected',
                metadata: await getOutboundClipboardMetadata(
                  clipContent,
                  'image',
                ),
              });
              await sendClipBoard(clipContent, 'image');
            }
          } catch (e) {
            await setDataInAsyncStorage(
              'wsStatusMessage',
              '❌ Outbound Error: ' + e,
            );
            await appendActivityError('outbound', 'image', e);
          }
        });

        // Event listener triggered when files are shared with the app.
        DeviceEventEmitter.addListener('SHARED_FILES', async event => {
          try {
            const clipContent = event.files;
            if (clipContent) {
              await appendActivityEvent({
                direction: 'outbound',
                type: 'files',
                status: 'Detected',
                metadata: await getOutboundClipboardMetadata(
                  clipContent,
                  'files',
                ),
              });
              await sendClipBoard(clipContent, 'files');
            }
          } catch (e) {
            await setDataInAsyncStorage(
              'wsStatusMessage',
              '❌ Outbound Error: ' + e,
            );
            await appendActivityError('outbound', 'files', e);
          }
        });

        let clipboardOnChange = null;
        let shizukuStatusOnChange = null;
        let activeClipboardModule = null;
        let activeClipboardBackend = 'legacy';

        const setClipboardCaptureStatus = async ({
          backend,
          shizukuStatus,
        }) => {
          await setDataInAsyncStorage('clipboard_capture_backend', backend);
          await setDataInAsyncStorage('shizuku_status', shizukuStatus);
        };

        const appendShizukuSystemEvent = async message => {
          await appendActivityEvent({
            direction: 'system',
            type: 'text',
            status: 'System',
            content: message,
          });
        };

        const showShizukuUnavailableNotification = async shizukuStatus => {
          await notifee.displayNotification({
            id: 'ClipCascade_Shizuku_Status_Notification_Id',
            title: 'ClipCascade: Shizuku clipboard backend unavailable',
            body: getClipboardCaptureUnavailableMessage(shizukuStatus),
            android: {
              channelId: 'ClipCascade_Connection_Status',
              smallIcon: 'ic_small_icon',
              color: 'gray',
              pressAction: {
                id: 'default',
                launchActivity: 'default',
              },
            },
          });
        };

        const getNativeShizukuStatus = async () => {
          if (!ShizukuClipboard?.getStatus) {
            return 'not_installed';
          }

          try {
            const status = await ShizukuClipboard.getStatus();
            return typeof status === 'string'
              ? status
              : status?.status || 'disconnected';
          } catch (error) {
            return 'disconnected';
          }
        };

        const handleShizukuUnavailable = async shizukuStatus => {
          const provider = resolveClipboardCaptureProvider({
            enableShizukuClipboardBackend: 'true',
            shizukuStatus,
          });
          activeClipboardBackend = provider.backend;
          await setClipboardCaptureStatus(provider);

          const message = getClipboardCaptureUnavailableMessage(
            provider.shizukuStatus,
          );
          await setDataInAsyncStorage('wsStatusMessage', `⚠️ ${message}`);
          await appendShizukuSystemEvent(message);
          await showShizukuUnavailableNotification(provider.shizukuStatus);
        };

        const stopActiveClipboardCapture = async () => {
          try {
            clipboardOnChange?.remove?.();
            shizukuStatusOnChange?.remove?.();
          } catch (error) {
            // no-op
          }
          clipboardOnChange = null;
          shizukuStatusOnChange = null;

          const modulesToStop = [
            activeClipboardModule,
            ClipboardListener,
            ShizukuClipboard,
          ].filter(Boolean);
          const uniqueModulesToStop = [...new Set(modulesToStop)];

          for (const clipboardModule of uniqueModulesToStop) {
            try {
              await clipboardModule?.stopListening?.();
            } catch (error) {
              // no-op
            }
          }
          activeClipboardModule = null;
        };

        const appendShizukuUriUnavailableEvent = async (
          type_,
          clipContent,
        ) => {
          await appendActivityEvent({
            direction: 'outbound',
            type: type_,
            status: 'Ignored',
            content: clipContent,
            metadata: {
              statusDetail: 'Shizuku URI access unavailable',
            },
          });
          await setDataInAsyncStorage(
            'wsStatusMessage',
            '⚠️ Shizuku URI access unavailable',
          );
        };

        const handleAutomaticClipboardChange = async params => {
          try {
            if (params && params.content && params.type) {
              const backend = params.backend || activeClipboardBackend;
              if (
                await shouldSuppressLocalClipboardEcho(
                  params.type,
                  params.content,
                )
              ) {
                return;
              }

              await appendActivityEvent({
                direction: 'outbound',
                type: params.type,
                status: 'Detected',
                content: params.content,
                metadata: await getOutboundClipboardMetadata(
                  params.content,
                  params.type,
                ),
              });
              await sendClipBoard(params.content, params.type, { backend });
            }
          } catch (e) {
            if (
              (params?.backend === 'shizuku' ||
                activeClipboardBackend === 'shizuku') &&
              params?.type !== 'text'
            ) {
              await appendShizukuUriUnavailableEvent(
                params?.type || 'files',
                params?.content,
              );
              return;
            }

            await setDataInAsyncStorage(
              'wsStatusMessage',
              '❌ Outbound Error: ' + e,
            );
            await appendActivityError('outbound', params?.type || 'text', e);
          }
        };

        const startAutomaticClipboardCapture = async () => {
          await stopActiveClipboardCapture();

          const shizukuStatus =
            runtimeSettings.enable_shizuku_clipboard_backend === 'true'
              ? await getNativeShizukuStatus()
              : 'disabled';
          const provider = resolveClipboardCaptureProvider({
            enableShizukuClipboardBackend:
              runtimeSettings.enable_shizuku_clipboard_backend,
            shizukuStatus,
          });

          activeClipboardBackend = provider.backend;
          await setClipboardCaptureStatus(provider);

          if (!provider.automaticCaptureEnabled) {
            await handleShizukuUnavailable(provider.shizukuStatus);
            return;
          }

          activeClipboardModule =
            provider.backend === 'shizuku'
              ? ShizukuClipboard
              : ClipboardListener;

          if (!activeClipboardModule?.startListening) {
            await handleShizukuUnavailable('not_installed');
            return;
          }

          const clipboardListener = new NativeEventEmitter(
            activeClipboardModule,
          );
          const startResult = await activeClipboardModule.startListening();
          const startStatus =
            typeof startResult === 'string'
              ? startResult
              : startResult?.status || provider.shizukuStatus;

          if (provider.backend === 'shizuku' && startStatus !== 'connected') {
            await stopActiveClipboardCapture();
            await handleShizukuUnavailable(startStatus);
            return;
          }

          clipboardOnChange = clipboardListener.addListener(
            'onClipboardChange',
            handleAutomaticClipboardChange,
          );

          if (provider.backend === 'shizuku') {
            await notifee.cancelNotification(
              'ClipCascade_Shizuku_Status_Notification_Id',
            );
            await appendShizukuSystemEvent('Shizuku connected');
            shizukuStatusOnChange = clipboardListener.addListener(
              'onShizukuStatusChange',
              async event => {
                const nextStatus = event?.status || 'disconnected';
                if (nextStatus !== 'connected') {
                  await stopActiveClipboardCapture();
                  await handleShizukuUnavailable(nextStatus);
                }
              },
            );
          }
        };

        const clearFiles = async (expensiveCall = false) => {
          files_in_memory = null;
          if (!expensiveCall) {
            await notifee.cancelNotification(
              'ClipCascade_Download_Files_Notification_Id',
            );
            await setDataInAsyncStorage('filesAvailableToDownload', 'false');
            await setDataInAsyncStorage('downloadFiles', 'false');
            await setDataInAsyncStorage('dirPath', '');
          }
        };

        const showFilesDownloadNotification = async msg => {
          // Display a silent notification
          await notifee.displayNotification({
            id: 'ClipCascade_Download_Files_Notification_Id',
            title: msg,
            android: {
              channelId: 'ClipCascade',
              smallIcon: 'ic_small_icon',
              color: 'gray',
              pressAction: {
                id: 'default',
                launchActivity: 'default',
              },
            },
          });
        };

        const showWebSocketStatusNotification = async (
          msg,
          timeout = 10000,
        ) => {
          await notifee.displayNotification({
            id: 'ClipCascade_WebSocket_Status_Notification_Id',
            title: msg,
            android: {
              channelId: 'ClipCascade_Connection_Status',
              smallIcon: 'ic_small_icon',
              pressAction: {
                id: 'default',
                launchActivity: 'default',
              },
              timeoutAfter: timeout === -1 ? undefined : timeout,
            },
          });
        };

        if (server_mode === 'P2S') {
          // websocket stomp client
          stompClient = new Client({
            brokerURL: websocket_url,
            reconnectDelay: RECONNECT_WS_TIMER,
            connectionTimeout: 5000,
            heartbeatIncoming: HEARTBEAT_INTERVAL,
            heartbeatOutgoing: 0,
            forceBinaryWSFrames: true, // https://stomp-js.github.io/api-docs/latest/classes/Client.html#forceBinaryWSFrames
            // appendMissingNULLonIncoming: true, // https://stomp-js.github.io/api-docs/latest/classes/Client.html#appendMissingNULLonIncoming
            onConnect: async () => {
              await setDataInAsyncStorage('wsStatusMessage', '✅ Connected');

              toggle = false;
              // Subscribe to a topic
              stompClient.subscribe(SUBSCRIPTION_DESTINATION, async message => {
                try {
                  await clearFiles();
                  toggle = false;
                  await setDataInAsyncStorage(
                    'wsStatusMessage',
                    '✅ Connected - Subscribed',
                  );

                  if (message && message.body) {
                    const body = JSON.parse(message.body);
                    let cb = String(body.payload);
                    const type_ = body.type ?? 'text';

                    //decrypt
                    if (cipher_enabled === 'true') {
                      try {
                        cb = await decrypt(JSON.parse(cb));
                      } catch (error) {
                        throw new Error(
                          `Encryption must be enabled on all devices if enabled. JSON parsing failed: ${error.message}`,
                        );
                      }
                    }

                    const inboundMetadata =
                      await getInboundClipboardMetadata(cb, type_);
                    // hash clipboard content
                    const hcb = await hashCB(cb);
                    const operationKey = `inbound:${type_}:${hcb}`;
                    if (!(await newCB(hcb))) {
                      return;
                    }

                    await appendActivityEvent({
                      direction: 'inbound',
                      type: type_,
                      status: 'Received',
                      content: cb,
                      metadata: inboundMetadata,
                      operationKey,
                    });

                    previous_clipboard_content_hash = hcb;

                    // validate clipboard size
                    if (await validateClipboardSize(cb, type_, 'Inbound')) {
                      // set clipboard content
                      if (type_ === 'text') {
                        await setLocalClipboardEchoSuppression(type_, hcb);
                        Clipboard.setString(cb);
                      } else if (type_ === 'image') {
                        await setLocalClipboardEchoSuppression(type_, hcb);
                        block_image_once = true;
                        await NativeBridgeModule.copyBase64ImageToClipboardUsingCache(
                          cb,
                        );
                      } else if (type_ === 'files') {
                        await showFilesDownloadNotification(
                          '📥 Download File(s)',
                        );

                        files_in_memory = cb;
                        await setDataInAsyncStorage(
                          'filesAvailableToDownload',
                          'true',
                        );
                      }
                      await appendActivityEvent({
                        direction: 'inbound',
                        type: type_,
                        status: 'Applied',
                        content: cb,
                        metadata: inboundMetadata,
                        operationKey,
                      });
                    }
                  }
                } catch (e) {
                  await resetLocalClipboardEchoGuards();
                  await setDataInAsyncStorage(
                    'wsStatusMessage',
                    '❌ Inbound Error: ' + e,
                  );
                  await appendActivityError('inbound', 'text', e);
                }
              });

              if (
                runtimeSettings.enable_websocket_status_notification === 'true'
              ) {
                if (websocket_status_notification_toggle == true) {
                  websocket_status_notification_toggle = false;
                  await showWebSocketStatusNotification(
                    'WebSocket Connection Restored 🔗',
                  );
                } else {
                  await notifee.cancelNotification(
                    'ClipCascade_WebSocket_Status_Notification_Id',
                  );
                }
              }
            },
            onDisconnect: async () => {
              await resetLocalClipboardEchoGuards();
              await setDataInAsyncStorage('wsStatusMessage', 'Disconnected');
            },
            onStompError: async frame => {
              await resetLocalClipboardEchoGuards();
              await setDataInAsyncStorage(
                'wsStatusMessage',
                '❌ STOMP Error: ' + JSON.stringify(frame, null, 2),
              );
            },
            onWebSocketError: async event => {
              await resetLocalClipboardEchoGuards();
              await setDataInAsyncStorage(
                'wsStatusMessage',
                '❌ WebSocket Error: ' + JSON.stringify(event, null, 2),
              );
            },
            onWebSocketClose: async event => {
              await resetLocalClipboardEchoGuards();
              const reason = event?.reason || 'closed by client';
              await setDataInAsyncStorage(
                'wsStatusMessage',
                `⚠️ WebSocket Close: ${reason}`,
              );
              if (
                runtimeSettings.enable_websocket_status_notification ===
                  'true' &&
                websocket_status_notification_toggle == false &&
                (await getDataFromAsyncStorage('wsIsRunning')) === 'true'
              ) {
                websocket_status_notification_toggle = true;
                await showWebSocketStatusNotification(
                  'WebSocket Connection Lost ⛓️‍💥',
                  -1,
                );
              }
            },
          });

          // start websocket stomp connection
          stompClient.activate();

          // send clipboard content P2S
          sendClipBoardP2S = async (
            clipContent,
            type_ = 'text',
            options = {},
          ) => {
            const originalClipContent = clipContent;
            let outboundMetadata = {};
            try {
              await clearFiles();
              if (
                await shouldSuppressLocalClipboardEcho(type_, clipContent)
              ) {
                return;
              }

              outboundMetadata = await getOutboundClipboardMetadata(
                originalClipContent,
                type_,
              );
              if (stompClient && stompClient.connected && !toggle) {
                if (
                  (type_ === 'image' &&
                    runtimeSettings.enable_image_sharing === 'false') ||
                  (type_ === 'files' &&
                    runtimeSettings.enable_file_sharing === 'false')
                ) {
                  await appendActivityEvent({
                    direction: 'outbound',
                    type: type_,
                    status: 'Ignored',
                    content: originalClipContent,
                    metadata: {
                      ...outboundMetadata,
                      statusDetail: 'Sharing disabled',
                    },
                  });
                  return;
                }

                if (
                  await validateClipboardSize(clipContent, type_, 'Outbound')
                ) {
                  // base64 encode
                  if (type_ === 'image') {
                    clipContent = await NativeBridgeModule.getFileAsBase64(
                      clipContent,
                    );
                  } else if (type_ === 'files') {
                    const temp = createSafeKeyStore();
                    const file_paths = clipContent
                      .split(',')
                      .filter(item => item.trim() !== '');

                    for (const file_path of file_paths) {
                      temp[await NativeBridgeModule.getFileName(file_path)] =
                        await NativeBridgeModule.getFileAsBase64(file_path);
                    }
                    clipContent = JSON.stringify(temp);
                  }

                  // clipboad content hash
                  const hcb = await hashCB(clipContent);
                  if (await newCB(hcb)) {
                    previous_clipboard_content_hash = hcb;

                    if (block_image_once) {
                      block_image_once = false;
                      await appendActivityEvent({
                        direction: 'outbound',
                        type: type_,
                        status: 'Ignored',
                        content: originalClipContent,
                        metadata: {
                          ...outboundMetadata,
                          statusDetail: 'Local image echo suppressed',
                        },
                      });
                    } else {
                      toggle = true;

                      if (cipher_enabled === 'true') {
                        //ecrypt
                        clipContent = await encrypt(clipContent);
                      }

                      await setDataInAsyncStorage(
                        'wsStatusMessage',
                        '✅ Connected - Broadcasting',
                      );

                      // send
                      stompClient.publish({
                        destination: SEND_DESTINATION,
                        body: JSON.stringify({
                          payload: String(clipContent),
                          type: type_,
                        }),
                      });
                      await appendActivityEvent({
                        direction: 'outbound',
                        type: type_,
                        status: 'Sent',
                        content: originalClipContent,
                        metadata: outboundMetadata,
                      });
                    }
                  } else {
                    await appendActivityEvent({
                      direction: 'outbound',
                      type: type_,
                      status: 'Ignored',
                      content: originalClipContent,
                      metadata: {
                        ...outboundMetadata,
                        statusDetail: 'Duplicate clipboard',
                      },
                    });
                  }
                }
              }
            } catch (e) {
              toggle = false;
              await resetLocalClipboardEchoGuards();
              if (
                options.backend === 'shizuku' &&
                (type_ === 'image' || type_ === 'files')
              ) {
                await appendShizukuUriUnavailableEvent(
                  type_,
                  originalClipContent,
                );
                return;
              }
              await appendActivityError('outbound', type_, e);
              throw e;
            }
          };

          // stop events and connection P2S
          stopServicesP2S = async () => {
            // 1) Stop clipboard listening
            await stopActiveClipboardCapture();

            // 2) Deactivate STOMP client safely
            if (stompClient) {
              // Remove stomp event handlers
              stompClient.onConnect = null;
              stompClient.onDisconnect = null;
              stompClient.onStompError = null;
              stompClient.onWebSocketError = null;
              stompClient.onWebSocketClose = () => {};

              // Deactivate the stomp connection
              try {
                await stompClient.deactivate();
              } catch (e) {
                // no-op
              }
            }
            stompClient = null;

            await setDataInAsyncStorage('wsStatusMessage', '✅ Disconnected');
            cleanupClipboardListeners();
            await notifee.stopForegroundService();
          };
        } else if (server_mode === 'P2P') {
          // p2p variables
          let myPeerId = null; // Your assigned peer ID from server
          let peers = new Set(); // Current set of known peer IDs in the "room"
          let peerConnections = createSafeKeyStore(); // Map: peerId -> RTCPeerConnection
          let dataChannels = createSafeKeyStore(); // Map: peerId -> RTCDataChannel
          let liveConnectionsCount = 0; // Track open DataChannels
          let pendingPeerList = null;
          let p2pShuttingDown = false;
          const peerOpChains = createSafeKeyStore();
          const dataChannelHeartbeatTimers = createSafeKeyStore();
          const P2P_DC_KEEPALIVE_JSON = JSON.stringify({ _cc_keepalive: true });

          // Fragment variables
          let sendingFragmentId = '';
          let receivingFragments = createSafeKeyStore(); // Map: fragmentId -> array of strings (ordered)
          let sendingFragmentStats = null;
          let receivingFragmentStats = null;

          getP2PStatusMessage = async () => {
            let msg = '📊';
            msg += ` Peers: ${liveConnectionsCount}`;
            if (sendingFragmentStats != null) {
              msg += ` | Sending: ${sendingFragmentStats}`;
            }
            if (receivingFragmentStats != null) {
              msg += ` | Receiving: ${receivingFragmentStats}`;
            }
            if (p2pMsg != null) {
              msg += ` | ${p2pMsg}`;
            }
            return msg;
          };

          const resetSendingFragmentId = async () => {
            sendingFragmentId = '';
            sendingFragmentStats = null;
            await resetP2PMsg();
          };

          const resetReceivingFragments = async () => {
            receivingFragments = createSafeKeyStore();
            receivingFragmentStats = null;
            await resetP2PMsg();
          };

          const resetP2PMsg = async () => {
            p2pMsg = null;
            await p2pStatusMessageChanged();
          };

          const syncLiveConnectionsCount = async () => {
            liveConnectionsCount = Object.values(dataChannels).filter(
              c => c && c.readyState === 'open',
            ).length;
            isP2PStatusMsgChanged = true;
            await p2pStatusMessageChanged();
          };

          const runSerializedPeerOp = (peerId, op) => {
            const prev =
              getSafeKeyStoreValue(peerOpChains, peerId) || Promise.resolve();
            const next = prev.then(() => op()).catch(() => {});
            setSafeKeyStoreValue(peerOpChains, peerId, next);
            return next;
          };

          const startDataChannelHeartbeat = (remotePeerId, channel) => {
            const existingTimer = getSafeKeyStoreValue(
              dataChannelHeartbeatTimers,
              remotePeerId,
            );
            if (existingTimer) {
              clearInterval(existingTimer);
            }
            setSafeKeyStoreValue(
              dataChannelHeartbeatTimers,
              remotePeerId,
              setInterval(() => {
                try {
                  if (channel.readyState === 'open') {
                    channel.send(P2P_DC_KEEPALIVE_JSON);
                  }
                } catch (e) {
                  // no-op
                }
              }, HEARTBEAT_INTERVAL),
            );
          };

          async function cleanupPeerConnections() {
            p2pShuttingDown = true;
            try {
              for (const id of Object.keys(dataChannelHeartbeatTimers)) {
                clearInterval(
                  getSafeKeyStoreValue(dataChannelHeartbeatTimers, id),
                );
                deleteSafeKeyStoreValue(dataChannelHeartbeatTimers, id);
              }
              for (const [, dc] of Object.entries(dataChannels)) {
                if (dc) {
                  try {
                    dc.onopen = null;
                    dc.onmessage = null;
                    dc.onclose = null;
                    dc.onerror = null;
                    dc.close();
                  } catch (e) {
                    // no-op
                  }
                }
              }
              dataChannels = createSafeKeyStore();

              for (const [, pc] of Object.entries(peerConnections)) {
                if (pc) {
                  try {
                    pc.onicecandidate = null;
                    pc.ondatachannel = null;
                    pc.onconnectionstatechange = null;
                    pc.close();
                  } catch (e) {
                    // no-op
                  }
                }
              }
              peerConnections = createSafeKeyStore();

              myPeerId = null;
              pendingPeerList = null;
              peers.clear();
              liveConnectionsCount = 0;
              for (const k of Object.keys(peerOpChains)) {
                deleteSafeKeyStoreValue(peerOpChains, k);
              }
              await resetReceivingFragments();
              await resetSendingFragmentId();
            } finally {
              p2pShuttingDown = false;
            }
          }

          const initializeWebSocketSignalingClient = async () => {
            if (wsSignalingClient == null) {
              wsSignalingClient = new WebSocket(websocket_url);

              wsSignalingClient.onopen = async () => {
                await cleanupPeerConnections();

                await setDataInAsyncStorage('wsStatusMessage', '✅ Connected');

                if (
                  runtimeSettings.enable_websocket_status_notification ===
                  'true'
                ) {
                  if (websocket_status_notification_toggle == true) {
                    websocket_status_notification_toggle = false;
                    await showWebSocketStatusNotification(
                      'WebSocket Connection Restored 🔗',
                    );
                  } else {
                    await notifee.cancelNotification(
                      'ClipCascade_WebSocket_Status_Notification_Id',
                    );
                  }
                }
              };

              wsSignalingClient.onmessage = async event => {
                try {
                  const data = JSON.parse(event.data);
                  switch (data.type) {
                    case 'ASSIGNED_ID':
                      if (myPeerId && myPeerId !== data.peerId) {
                        await cleanupPeerConnections();
                      }
                      myPeerId = data.peerId;
                      if (pendingPeerList != null) {
                        const pending = pendingPeerList;
                        pendingPeerList = null;
                        await handlePeerList(pending);
                      }
                      break;

                    case 'PEER_LIST':
                      await handlePeerList(data.peers);
                      break;

                    case 'OFFER':
                      await handleOffer(data.fromPeerId, data.offer);
                      break;

                    case 'ANSWER':
                      await handleAnswer(data.fromPeerId, data.answer);
                      break;

                    case 'ICE_CANDIDATE':
                      await handleIceCandidate(data.fromPeerId, data.candidate);
                      break;
                  }

                  await setDataInAsyncStorage(
                    'wsStatusMessage',
                    '✅ Connected',
                  );
                } catch (e) {
                  await setDataInAsyncStorage(
                    'wsStatusMessage',
                    '❌ Inbound Error: ' + e,
                  );
                }
              };

              wsSignalingClient.onerror = async event => {
                await resetLocalClipboardEchoGuards();
                await setDataInAsyncStorage(
                  'wsStatusMessage',
                  '❌ WebSocket Error: ' + JSON.stringify(event, null, 2),
                );
              };

              wsSignalingClient.onclose = async event => {
                await resetLocalClipboardEchoGuards();
                const reason = event?.reason || 'closed by client';
                await setDataInAsyncStorage(
                  'wsStatusMessage',
                  '⚠️ WebSocket Close: ' + reason,
                );
                if (
                  runtimeSettings.enable_websocket_status_notification ===
                    'true' &&
                  websocket_status_notification_toggle == false &&
                  (await getDataFromAsyncStorage('wsIsRunning')) === 'true'
                ) {
                  websocket_status_notification_toggle = true;
                  await showWebSocketStatusNotification(
                    'WebSocket Connection Lost ⛓️‍💥',
                    -1,
                  );
                }

                wsSignalingClient = null;
                setTimeout(async () => {
                  if (
                    wsSignalingClient == null &&
                    (await getDataFromAsyncStorage('wsIsRunning')) === 'true'
                  ) {
                    initializeWebSocketSignalingClient();
                  }
                }, RECONNECT_WS_TIMER);
              };
            }
          };

          // start websocket signaling connection
          initializeWebSocketSignalingClient();

          // send clipboard content P2P
          sendClipBoardP2P = async (
            clipContent,
            type_ = 'text',
            options = {},
          ) => {
            const originalClipContent = clipContent;
            let outboundMetadata = {};
            try {
              await clearFiles();
              if (
                await shouldSuppressLocalClipboardEcho(type_, clipContent)
              ) {
                return;
              }

              outboundMetadata = await getOutboundClipboardMetadata(
                originalClipContent,
                type_,
              );
              if (
                (type_ === 'image' &&
                  runtimeSettings.enable_image_sharing === 'false') ||
                (type_ === 'files' &&
                  runtimeSettings.enable_file_sharing === 'false')
              ) {
                await appendActivityEvent({
                  direction: 'outbound',
                  type: type_,
                  status: 'Ignored',
                  content: originalClipContent,
                  metadata: {
                    ...outboundMetadata,
                    statusDetail: 'Sharing disabled',
                  },
                });
                return;
              }

              if (await validateClipboardSize(clipContent, type_, 'Outbound')) {
                // base64 encode
                if (type_ === 'image') {
                  clipContent = await NativeBridgeModule.getFileAsBase64(
                    clipContent,
                  );
                } else if (type_ === 'files') {
                  const temp = createSafeKeyStore();
                  const file_paths = clipContent
                    .split(',')
                    .filter(item => item.trim() !== '');

                  for (const file_path of file_paths) {
                    temp[await NativeBridgeModule.getFileName(file_path)] =
                      await NativeBridgeModule.getFileAsBase64(file_path);
                  }
                  clipContent = JSON.stringify(temp);
                }

                // clipboad content hash
                const hcb = await hashCB(clipContent);
                if (await newCB(hcb)) {
                  previous_clipboard_content_hash = hcb;

                  if (block_image_once) {
                    block_image_once = false;
                    await appendActivityEvent({
                      direction: 'outbound',
                      type: type_,
                      status: 'Ignored',
                      content: originalClipContent,
                      metadata: {
                        ...outboundMetadata,
                        statusDetail: 'Local image echo suppressed',
                      },
                    });
                  } else {
                    await resetSendingFragmentId();
                    await resetReceivingFragments();

                    const rawPayloadSizeInBytes =
                      textEncoder.encode(clipContent).length;

                    if (cipher_enabled === 'true') {
                      //ecrypt
                      clipContent = await encrypt(clipContent);
                    }

                    // fragment payload
                    const fragments = await fragmentString(
                      clipContent,
                      FRAGMENT_SIZE,
                    );

                    const metadata = {
                      id: await generateUuid(),
                      isFragmented: fragments.length > 1,
                      index: 0,
                      totalFragments: fragments.length,
                      combinedRawPayloadSizeInBytes: rawPayloadSizeInBytes,
                    };

                    let loopBroken = false;
                    sendingFragmentId = metadata.id;
                    for (let i = 0; i < fragments.length; i++) {
                      if (sendingFragmentId != metadata.id) {
                        loopBroken = true;
                        return;
                      }

                      const fragment = fragments[i];

                      const messageJson = JSON.stringify({
                        payload: fragment,
                        type: type_,
                        metadata: metadata,
                      });
                      metadata.index += 1;

                      // send to all open DataChannels
                      Object.entries(dataChannels).forEach(
                        async ([peerId, channel]) => {
                          if (channel.readyState === 'open') {
                            await channel.send(messageJson);
                          }
                        },
                      );

                      // Update stats
                      if (metadata.isFragmented) {
                        sendingFragmentStats = `${metadata.index}/${metadata.totalFragments}`;
                        await p2pStatusMessageChanged();
                      }
                    }
                    if (!loopBroken) {
                      await resetSendingFragmentId();
                      await appendActivityEvent({
                        direction: 'outbound',
                        type: type_,
                        status: 'Sent',
                        content: originalClipContent,
                        metadata: {
                          ...outboundMetadata,
                          statusDetail:
                            fragments.length +
                            ' fragment(s), ' +
                            liveConnectionsCount +
                            ' peer(s)',
                        },
                      });
                    }
                  }
                } else {
                  await appendActivityEvent({
                    direction: 'outbound',
                    type: type_,
                    status: 'Ignored',
                    content: originalClipContent,
                    metadata: {
                      ...outboundMetadata,
                      statusDetail: 'Duplicate clipboard',
                    },
                  });
                }
              }
            } catch (e) {
              await resetLocalClipboardEchoGuards();
              if (
                options.backend === 'shizuku' &&
                (type_ === 'image' || type_ === 'files')
              ) {
                await appendShizukuUriUnavailableEvent(
                  type_,
                  originalClipContent,
                );
                return;
              }
              p2pMsg = '❌ P2P Outbound Error: ' + JSON.stringify(e, null, 2);
              await p2pStatusMessageChanged();
              await appendActivityError('outbound', type_, e);
            }
          };

          // stop events and connection P2P
          stopServicesP2P = async () => {
            // 1) Stop listening to clipboard events
            await stopActiveClipboardCapture();

            // 2) Clean up the WebSocket (signaling client)
            if (wsSignalingClient) {
              // Remove all listeners so it won't re-fire or reconnect
              wsSignalingClient.onopen = null;
              wsSignalingClient.onmessage = null;
              wsSignalingClient.onerror = null;
              wsSignalingClient.onclose = null;

              // Close it
              try {
                wsSignalingClient.close();
              } catch (e) {
                // no-op
              }
            }
            wsSignalingClient = null;

            // 3) Close all DataChannels and RTCPeerConnections
            await cleanupPeerConnections();

            // 4) Finally, stop the foreground service
            await setDataInAsyncStorage('wsStatusMessage', '✅ Disconnected');
            await setDataInAsyncStorage('p2pStatusMessage', '');
            cleanupClipboardListeners();
            await notifee.stopForegroundService();
          };

          // send message to websocket signaling server
          const signalingSend = async obj => {
            try {
              if (
                wsSignalingClient &&
                wsSignalingClient.readyState === WebSocket.OPEN
              ) {
                wsSignalingClient.send(JSON.stringify(obj));
                await setDataInAsyncStorage('wsStatusMessage', '✅ Connected');
              }
            } catch (e) {
              await setDataInAsyncStorage(
                'wsStatusMessage',
                '❌ Outbound Error: ' + e,
              );
            }
          };

          // receive clipboard content P2P
          const onDataChannelMessage = async messageJson => {
            try {
              const message = JSON.parse(messageJson);
              if (message && message._cc_keepalive === true) {
                return;
              }

              await clearFiles(true);
              await resetSendingFragmentId();

              let cb = String(message.payload);
              const type_ = message.type ?? 'text';
              const metadata = message.metadata;

              // Check if the payload exceeds the maximum size: first layer protection
              if (
                metadata != null &&
                runtimeSettings.max_clipboard_size_local_limit_bytes >= 0 &&
                metadata.combinedRawPayloadSizeInBytes >
                  runtimeSettings.max_clipboard_size_local_limit_bytes
              ) {
                await resetReceivingFragments();
                p2pMsg = `⚠️ Payload size limit exceeded: ${metadata['combinedRawPayloadSizeInBytes']} bytes exceeds ${runtimeSettings.max_clipboard_size_local_limit_bytes} bytes`;
                await p2pStatusMessageChanged();
                await appendActivityEvent({
                  direction: 'inbound',
                  type: type_,
                  status: 'Ignored',
                  metadata: {
                    sizeBytes: metadata.combinedRawPayloadSizeInBytes,
                    statusDetail:
                      'Size ' +
                      metadata.combinedRawPayloadSizeInBytes +
                      ' bytes exceeds configured limit',
                  },
                });
                return;
              }

              // Fragmented message handling
              if (metadata != null && metadata.isFragmented) {
                receivingFragmentStats = `${metadata.index + 1}/${
                  metadata.totalFragments
                }`;
                await p2pStatusMessageChanged();

                if (metadata.id in receivingFragments) {
                  receivingFragments[metadata.id][metadata.index] = cb;

                  // If this is the last fragment, try to combine
                  if (metadata.index === metadata.totalFragments - 1) {
                    // Check if all fragments are present (none is empty)
                    if (
                      receivingFragments[metadata.id].every(frag => frag !== '')
                    ) {
                      // Join them all together into one payload
                      cb = receivingFragments[metadata.id].join('');
                    } else {
                      // Missing fragment(s): error out
                      await resetReceivingFragments();
                      p2pMsg =
                        'Failed to receive: One or more fragments are missing or the clipboard changed before completion.';
                      await p2pStatusMessageChanged();
                      await appendActivityEvent({
                        direction: 'inbound',
                        type: type_,
                        status: 'Error',
                        metadata: {
                          statusDetail: 'Missing clipboard fragment',
                        },
                      });
                      return;
                    }
                  } else {
                    // Not the last fragment, so we don't proceed further
                    return;
                  }
                } else {
                  await resetReceivingFragments();
                  receivingFragments[metadata.id] = Array(
                    metadata.totalFragments,
                  ).fill('');
                  receivingFragments[metadata.id][metadata.index] = cb;
                  return;
                }
              }

              await clearFiles();

              // decrypt
              if (cipher_enabled === 'true') {
                try {
                  cb = await decrypt(JSON.parse(cb));
                } catch (error) {
                  throw new Error(
                    `Encryption must be enabled on all devices if enabled. JSON parsing failed: ${error.message}`,
                  );
                }
              }

              const inboundMetadata = await getInboundClipboardMetadata(
                cb,
                type_,
              );
              // hash clipboard content
              const hcb = await hashCB(cb);
              const operationKey = `inbound:${type_}:${hcb}`;
              if (!(await newCB(hcb))) {
                await resetReceivingFragments();
                return;
              }

              await appendActivityEvent({
                direction: 'inbound',
                type: type_,
                status: 'Received',
                content: cb,
                metadata: inboundMetadata,
                operationKey,
              });

              previous_clipboard_content_hash = hcb;

              await resetReceivingFragments();
              // validate clipboard size
              if (await validateClipboardSize(cb, type_, 'Inbound')) {
                // set clipboard content
                if (type_ === 'text') {
                  await setLocalClipboardEchoSuppression(type_, hcb);
                  Clipboard.setString(cb);
                } else if (type_ === 'image') {
                  await setLocalClipboardEchoSuppression(type_, hcb);
                  block_image_once = true;
                  await NativeBridgeModule.copyBase64ImageToClipboardUsingCache(
                    cb,
                  );
                } else if (type_ === 'files') {
                  await showFilesDownloadNotification('📥 Download File(s)');

                  files_in_memory = cb;
                  await setDataInAsyncStorage(
                    'filesAvailableToDownload',
                    'true',
                  );
                }
                await appendActivityEvent({
                  direction: 'inbound',
                  type: type_,
                  status: 'Applied',
                  content: cb,
                  metadata: inboundMetadata,
                  operationKey,
                });
              }
            } catch (e) {
              await resetLocalClipboardEchoGuards();
              p2pMsg = '❌ P2P Inbound Error: ' + e;
              await p2pStatusMessageChanged();
              await appendActivityError('inbound', 'text', e);
            }
          };

          /**
           * The server gave us the entire list of peers in the "room".
           * For each peer, create a PeerConnection if we don't have one yet.
           */
          const handlePeerList = async peerList => {
            if (!myPeerId) {
              pendingPeerList = Array.isArray(peerList) ? [...peerList] : [];
              return;
            }
            const updatedPeers = new Set(peerList);
            peers = updatedPeers;
            await removeStalePeers(updatedPeers);

            peers.forEach(async pid => {
              if (pid === myPeerId) return; // skip self
              if (!getSafeKeyStoreValue(peerConnections, pid)) {
                // Create new PeerConnection
                const pc = await createPeerConnection(pid);
                setSafeKeyStoreValue(peerConnections, pid, pc);

                // Tie-breaker: only the "lower" ID makes the offer to avoid collisions
                if (myPeerId < pid) {
                  const channel = await pc.createDataChannel('cliptext');
                  setSafeKeyStoreValue(dataChannels, pid, channel);
                  await setupDataChannel(pid, channel);
                  await createOffer(pid);
                }
              }
            });
          };

          /**
           * Close connections and data channels for peers that no longer exist in PEER_LIST.
           */
          const removeStalePeers = async updatedPeers => {
            // 1) Find which peer IDs are no longer present
            const stalePeerIds = Object.keys(peerConnections).filter(
              pid => !updatedPeers.has(pid),
            );
            // 2) For each stale peer, close data channel and peer connection
            for (const oldPid of stalePeerIds) {
              deleteSafeKeyStoreValue(peerOpChains, oldPid);
              const timer = getSafeKeyStoreValue(
                dataChannelHeartbeatTimers,
                oldPid,
              );
              if (timer) {
                clearInterval(timer);
                deleteSafeKeyStoreValue(dataChannelHeartbeatTimers, oldPid);
              }
              const dc = getSafeKeyStoreValue(dataChannels, oldPid);
              if (dc) {
                try {
                  dc.onopen = null;
                  dc.onmessage = null;
                  dc.onclose = null;
                  dc.onerror = null;
                  dc.close();
                } catch (err) {}
                deleteSafeKeyStoreValue(dataChannels, oldPid);
              }

              const pc = getSafeKeyStoreValue(peerConnections, oldPid);
              if (pc) {
                try {
                  pc.onicecandidate = null;
                  pc.ondatachannel = null;
                  pc.onconnectionstatechange = null;
                  pc.close();
                } catch (err) {}
                deleteSafeKeyStoreValue(peerConnections, oldPid);
              }
            }
            await syncLiveConnectionsCount();
          };

          const disposePeerConnection = async peerId => {
            const timer = getSafeKeyStoreValue(
              dataChannelHeartbeatTimers,
              peerId,
            );
            if (timer) {
              clearInterval(timer);
              deleteSafeKeyStoreValue(dataChannelHeartbeatTimers, peerId);
            }
            const dc = getSafeKeyStoreValue(dataChannels, peerId);
            if (dc) {
              try {
                dc.onopen = null;
                dc.onmessage = null;
                dc.onclose = null;
                dc.onerror = null;
                dc.close();
              } catch (e) {
                // no-op
              }
              deleteSafeKeyStoreValue(dataChannels, peerId);
            }
            const pc = getSafeKeyStoreValue(peerConnections, peerId);
            if (pc) {
              try {
                pc.onicecandidate = null;
                pc.ondatachannel = null;
                pc.onconnectionstatechange = null;
                pc.close();
              } catch (e) {
                // no-op
              }
              deleteSafeKeyStoreValue(peerConnections, peerId);
            }
            await syncLiveConnectionsCount();
          };

          /**
           * Create and return a RTCPeerConnection, set up listeners for ICE + DataChannel.
           */
          const createPeerConnection = async remotePeerId => {
            const pc = new RTCPeerConnection({
              iceServers: [
                {
                  urls: stun_url,
                },
              ],
            });

            pc.onicecandidate = async event => {
              if (event.candidate) {
                await signalingSend({
                  type: 'ICE_CANDIDATE',
                  fromPeerId: myPeerId,
                  toPeerId: remotePeerId,
                  candidate: event.candidate,
                });
              }
            };

            pc.ondatachannel = async event => {
              const channel = event.channel;
              setSafeKeyStoreValue(dataChannels, remotePeerId, channel);
              await setupDataChannel(remotePeerId, channel);
            };

            pc.onconnectionstatechange = () => {
              const st = pc.connectionState;
              if (st === 'failed' || st === 'closed') {
                recoverPeerTransport(remotePeerId, pc);
              }
            };

            return pc;
          };

          /**
           * Create an SDP offer for remotePeerId and send via signaling.
           */
          const createOffer = async remotePeerId => {
            const pc = getSafeKeyStoreValue(peerConnections, remotePeerId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            await signalingSend({
              type: 'OFFER',
              fromPeerId: myPeerId,
              toPeerId: remotePeerId,
              offer: pc.localDescription,
            });
          };

          const recoverPeerTransport = async (remotePeerId, deadPc) => {
            if (p2pShuttingDown || !myPeerId || !peers.has(remotePeerId)) {
              return;
            }
            if (
              deadPc != null &&
              getSafeKeyStoreValue(peerConnections, remotePeerId) !== deadPc
            ) {
              return;
            }
            await runSerializedPeerOp(remotePeerId, async () => {
              if (p2pShuttingDown || !myPeerId || !peers.has(remotePeerId)) {
                return;
              }
              if (
                deadPc != null &&
                getSafeKeyStoreValue(peerConnections, remotePeerId) !== deadPc
              ) {
                return;
              }
              if (deadPc == null) {
                const ch = getSafeKeyStoreValue(dataChannels, remotePeerId);
                if (ch && ch.readyState === 'open') {
                  return;
                }
              }
              await disposePeerConnection(remotePeerId);
              if (p2pShuttingDown || !myPeerId || !peers.has(remotePeerId)) {
                return;
              }
              const newPc = await createPeerConnection(remotePeerId);
              setSafeKeyStoreValue(peerConnections, remotePeerId, newPc);
              if (myPeerId < remotePeerId) {
                const channel = await newPc.createDataChannel('cliptext');
                setSafeKeyStoreValue(dataChannels, remotePeerId, channel);
                await setupDataChannel(remotePeerId, channel);
                await createOffer(remotePeerId);
              }
            });
          };

          /**
           * Handle incoming OFFER from remote, then respond with ANSWER.
           */
          const handleOffer = async (fromPeerId, offer) => {
            if (p2pShuttingDown) {
              return;
            }
            // Ignore delayed/stale OFFERs for peers removed from the latest PEER_LIST.
            // Startup guard: allow early signaling before ASSIGNED_ID/PEER_LIST is ready.
            if (myPeerId && peers.size > 0 && !peers.has(fromPeerId)) {
              return;
            }
            await runSerializedPeerOp(fromPeerId, async () => {
              if (p2pShuttingDown) {
                return;
              }
              // TOCTOU guard: PEER_LIST can change after the outer fast-path check.
              if (myPeerId && peers.size > 0 && !peers.has(fromPeerId)) {
                return;
              }
              // Full new offer (e.g. after peer recovery): must not apply on an
              // existing connected PC or datachannel counts diverge across devices.
              if (getSafeKeyStoreValue(peerConnections, fromPeerId)) {
                await disposePeerConnection(fromPeerId);
              }
              const pc = await createPeerConnection(fromPeerId);
              setSafeKeyStoreValue(peerConnections, fromPeerId, pc);

              await pc.setRemoteDescription(new RTCSessionDescription(offer));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              await signalingSend({
                type: 'ANSWER',
                fromPeerId: myPeerId,
                toPeerId: fromPeerId,
                answer: pc.localDescription,
              });
            });
          };

          /**
           * Handle incoming ANSWER from remote to our previously sent OFFER.
           */
          const handleAnswer = async (fromPeerId, answer) => {
            const pc = getSafeKeyStoreValue(peerConnections, fromPeerId);
            if (!pc) {
              return;
            }
            if (
              pc.connectionState === 'failed' ||
              pc.connectionState === 'closed'
            ) {
              return;
            }

            await pc.setRemoteDescription(new RTCSessionDescription(answer));
          };

          /**
           * Handle incoming ICE candidate from remote peer.
           */
          const handleIceCandidate = async (fromPeerId, candidateData) => {
            const pc = getSafeKeyStoreValue(peerConnections, fromPeerId);
            if (!pc) {
              return;
            }
            if (
              pc.connectionState === 'failed' ||
              pc.connectionState === 'closed'
            ) {
              return;
            }

            await pc.addIceCandidate(new RTCIceCandidate(candidateData));
          };

          /**
           * Set up DataChannel for remotePeerId.
           */
          const setupDataChannel = async (remotePeerId, channel) => {
            channel.onopen = async () => {
              startDataChannelHeartbeat(remotePeerId, channel);
              await syncLiveConnectionsCount();
            };

            channel.onmessage = async e => {
              await onDataChannelMessage(e.data);
            };

            channel.onclose = async () => {
              const timer = getSafeKeyStoreValue(
                dataChannelHeartbeatTimers,
                remotePeerId,
              );
              if (timer) {
                clearInterval(timer);
                deleteSafeKeyStoreValue(dataChannelHeartbeatTimers, remotePeerId);
              }
              await syncLiveConnectionsCount();
              await recoverPeerTransport(remotePeerId, null);
            };

            channel.onerror = async err => {
              p2pMsg = '❌ DataChannel error with ' + remotePeerId + ': ' + err;
              await p2pStatusMessageChanged();
            };

            if (channel.readyState === 'open') {
              startDataChannelHeartbeat(remotePeerId, channel);
              await syncLiveConnectionsCount();
            }
          };
        }

        // send clipboard content
        const sendClipBoard = async (
          clipContent,
          type_ = 'text',
          options = {},
        ) => {
          if (server_mode === 'P2S') {
            await sendClipBoardP2S(clipContent, type_, options);
          } else if (server_mode === 'P2P') {
            await sendClipBoardP2P(clipContent, type_, options);
          }
        };

        await startAutomaticClipboardCapture();

        // terminate service when wsIsRunning is false
        const stopServices = async () => {
          if (server_mode === 'P2S') {
            await stopServicesP2S();
          } else if (server_mode === 'P2P') {
            await stopServicesP2P();
          }

          cleanupClipboardListeners();
        };

        function sleep(ms) {
          return new Promise(res => setTimeout(res, ms));
        }

        async function pollFlagsLoop() {
          const POLL_KEYS = [
            'wsIsRunning',
            'echo',
            'downloadFiles',
            'filesAvailableToDownload',
            'enable_image_sharing',
            'enable_file_sharing',
            'enable_shizuku_clipboard_backend',
            'enable_websocket_status_notification',
            'max_clipboard_size_local_limit_bytes',
          ];

          while (true) {
            let latest;
            try {
              const json = NativeBridgeModule.getFlagsSync(POLL_KEYS);
              latest = JSON.parse(json);
            } catch (error) {
              await setDataInAsyncStorage(
                'wsStatusMessage',
                '⚠️ Service health polling delayed: ' + error,
              );
              await sleep(1000);
              continue;
            }

            const previousShizukuBackendSetting =
              runtimeSettings.enable_shizuku_clipboard_backend;
            runtimeSettings = normalizeRuntimeSettings(
              runtimeSettings,
              latest,
              maxsize,
            );
            if (
              runtimeSettings.enable_shizuku_clipboard_backend !==
              previousShizukuBackendSetting
            ) {
              await startAutomaticClipboardCapture();
            }
            if (
              runtimeSettings.enable_shizuku_clipboard_backend === 'true' &&
              activeClipboardBackend === 'paused' &&
              (await getNativeShizukuStatus()) === 'connected'
            ) {
              await startAutomaticClipboardCapture();
            }

            // check if wsIsRunning is true or else terminate the service
            if (latest.wsIsRunning !== 'true') {
              await stopServices();
              await setDataInAsyncStorage(
                'wsForegroundServiceTerminated',
                'true',
              );
              break;
            }

            if (isP2PStatusMsgChanged) {
              isP2PStatusMsgChanged = false;
              await setDataInAsyncStorage(
                'p2pStatusMessage',
                await getP2PStatusMessage(),
              );
            }

            // check if ping initiated
            if (latest.echo === 'ping') {
              await setDataInAsyncStorage('echo', 'pong');
              try {
                NativeBridgeModule.clearInactiveServiceNotification();
              } catch (error) {
                // Clearing a stale watchdog notification must not stop syncing.
              }
            }

            // check if user wants to download files
            if (
              latest.downloadFiles === 'true' &&
              latest.filesAvailableToDownload === 'true'
            ) {
              try {
                await setDataInAsyncStorage('downloadFiles', 'false');
                const dirPath = await getDataFromAsyncStorage('dirPath');

                // display progress notification
                await notifee.displayNotification({
                  id: 'ClipCascade_Download_Files_Progress_Notification_Id',
                  title: 'Downloading File(s)...',
                  android: {
                    channelId: 'ClipCascade_Progress',
                    smallIcon: 'ic_small_icon',
                    progress: {
                      indeterminate: true,
                    },
                  },
                });

                if (files_in_memory != null) {
                  // save files
                  await NativeBridgeModule.saveBase64Files(
                    dirPath,
                    files_in_memory,
                  );
                }
              } catch (e) {
                // Alert is displayed only when the app is open because this is called from foreground service
                Alert.alert('Error', 'Failed to download files: ' + e);
              } finally {
                await notifee.cancelNotification(
                  'ClipCascade_Download_Files_Progress_Notification_Id',
                );
              }
            }
            await sleep(1000);
          }
        }

        await pollFlagsLoop();
      } catch (error) {
        await setDataInAsyncStorage('wsStatusMessage', '❌ Error:' + error);
        await setDataInAsyncStorage('wsIsRunning', 'false');
        await setDataInAsyncStorage('wsForegroundServiceTerminated', 'true');
        cleanupClipboardListeners();
        await notifee.stopForegroundService();
      }
    });
  });

  try {
    // Create a notification channel for the foreground service
    const channelId = await notifee.createChannel({
      id: 'ClipCascade',
      name: 'ClipCascade Monitor',
      importance: AndroidImportance.LOW,
      sound: '',
    });

    // Display a notification to start the foreground service
    await notifee.displayNotification({
      title: 'ClipCascade',
      android: {
        channelId,
        asForegroundService: true,
        smallIcon: 'ic_small_icon',
        color: 'gray',
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
      },
    });

    // Create a notification channel for download progress
    await notifee.createChannel({
      id: 'ClipCascade_Progress',
      name: 'ClipCascade Download Progress',
      importance: AndroidImportance.DEFAULT,
    });

    // Create a notification channel for connection status
    await notifee.createChannel({
      id: 'ClipCascade_Connection_Status',
      name: 'ClipCascade Connection Status',
      importance: AndroidImportance.HIGH,
    });

    return [true, 'Foreground service is running'];
  } catch (error) {
    return [false, error];
  }
};
