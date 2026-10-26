import { useEffect, useState } from 'react';
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Activity,
  Download,
  History,
  LockKeyhole,
  LogOut,
  Play,
  Radio,
  RotateCw,
  Settings2,
  Square,
} from 'lucide-react-native';
import ClipboardActivityLog from './ClipboardActivityLog';
import {
  isClipboardResendAvailable,
  subscribeClipboardResendState,
} from './ClipboardResend';
import { buildHealthSummary, UI_COLORS as C } from './UiPresentation';

const statusRow = (Icon, title, status, detail) => (
  <View style={styles.healthRow} key={title}>
    <Icon color={C.accent} size={23} />
    <View style={styles.healthBody}>
      <Text style={styles.healthTitle}>{title}</Text>
      {detail ? <Text style={styles.muted}>{detail}</Text> : null}
    </View>
    <Text style={[styles.healthValue, { color: C[status.tone] }]}>
      {status.label}
    </Text>
  </View>
);

export default function ConnectedWorkspace({
  initialView = 'history',
  running,
  data,
  captureState,
  message,
  peerMessage,
  onSettings,
  onToggleService,
  onRestart,
  onLogout,
  filesAvailable,
  onDownload,
  updateVersion,
  onUpdate,
  appVersion,
  helpUrl,
  githubUrl,
  donateUrl,
}) {
  const [view, setView] = useState(initialView);
  const [connected, setConnected] = useState(isClipboardResendAvailable());
  useEffect(() => subscribeClipboardResendState(setConnected), []);
  const health = buildHealthSummary({
    running,
    connected,
    captureBackend: captureState.backend,
    shizukuStatus: captureState.shizukuStatus,
    cipherEnabled: data.cipher_enabled,
  });
  return (
    <View style={styles.container} testID="connected-workspace">
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image
            source={require('./assets/brand.png')}
            style={styles.brandImage}
          />
          <Text style={styles.brandTitle}>ClipCascade</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={onSettings}
          style={styles.iconButton}
        >
          <Settings2 color={C.muted} size={23} />
        </TouchableOpacity>
      </View>
      {view === 'history' ? (
        <>
          <View style={styles.titleRow}>
            <Text style={styles.title}>History</Text>
            <Text style={[styles.status, { color: C[health.connection.tone] }]}>
              {health.connection.label}
            </Text>
          </View>
          <View style={styles.summary}>
            <View style={styles.inline}>
              <Radio size={15} color={C.muted} />
              <Text style={styles.caption}>{health.capture.label}</Text>
            </View>
            <View style={styles.inline}>
              <LockKeyhole size={15} color={C.muted} />
              <Text style={styles.caption}>
                {health.encryption.label === 'Enabled'
                  ? 'Encrypted'
                  : 'Encryption off'}
              </Text>
            </View>
          </View>
          {filesAvailable ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onDownload}
              style={styles.fileButton}
            >
              <Download size={18} color={C.accent} />
              <Text style={styles.link}>Download available files</Text>
            </TouchableOpacity>
          ) : null}
          <ClipboardActivityLog />
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.healthContent}>
          <Text style={styles.title}>Connection health</Text>
          {statusRow(Activity, 'Service', health.service)}
          {statusRow(
            Radio,
            'Clipboard capture',
            health.capture,
            captureState.backend === 'shizuku'
              ? 'Shizuku'
              : captureState.backend === 'legacy'
              ? 'Android system backend'
              : null,
          )}
          {statusRow(
            Activity,
            'Server connection',
            health.connection,
            data.server_url,
          )}
          {statusRow(LockKeyhole, 'Encryption', health.encryption)}
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {peerMessage ? (
            <Text style={styles.message}>{peerMessage}</Text>
          ) : null}
          <View style={styles.actions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={running ? 'Stop service' : 'Start service'}
              onPress={onToggleService}
              style={styles.actionButton}
            >
              {running ? (
                <Square color={C.text} size={18} />
              ) : (
                <Play color={C.text} size={18} />
              )}
              <Text style={styles.actionText}>
                {running ? 'Stop service' : 'Start service'}
              </Text>
            </TouchableOpacity>
            {running ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Restart service"
                onPress={onRestart}
                style={styles.actionButton}
              >
                <RotateCw color={C.text} size={18} />
                <Text style={styles.actionText}>Restart service</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {updateVersion ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onUpdate}
              style={styles.accountButton}
            >
              <Text style={styles.link}>
                Update {appVersion} to {updateVersion}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Logout"
            onPress={onLogout}
            style={styles.accountButton}
          >
            <LogOut size={19} color={C.muted} />
            <Text style={styles.muted}>Sign out</Text>
          </TouchableOpacity>
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => Linking.openURL(helpUrl)}
              style={styles.footerLink}
            >
              <Text style={styles.caption}>Help</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Linking.openURL(githubUrl)}
              style={styles.footerLink}
            >
              <Text style={styles.caption}>GitHub</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Linking.openURL(data.server_url)}
              style={styles.footerLink}
            >
              <Text style={styles.caption}>Server</Text>
            </TouchableOpacity>
            {donateUrl ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(donateUrl)}
                style={styles.footerLink}
              >
                <Text style={styles.caption}>Donate</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.caption}>{appVersion}</Text>
          </View>
        </ScrollView>
      )}
      <View style={styles.navigation} accessibilityRole="tablist">
        {[
          [History, 'History', 'history'],
          [Activity, 'Health', 'health'],
          [Settings2, 'Settings', 'settings'],
        ].map(([Icon, label, id]) => (
          <TouchableOpacity
            key={id}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: view === id }}
            onPress={() => (id === 'settings' ? onSettings() : setView(id))}
            style={styles.navItem}
          >
            <Icon color={view === id ? C.accent : C.muted} size={21} />
            <Text
              style={[
                styles.caption,
                { color: view === id ? C.accent : C.muted },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandImage: { width: 30, height: 30, resizeMode: 'contain' },
  brandTitle: { color: C.text, fontSize: 20, fontWeight: '600' },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderRadius: 5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
  },
  title: { color: C.text, fontSize: 26, fontWeight: '600', flexShrink: 1 },
  status: { fontSize: 12, flexShrink: 1, textAlign: 'right' },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 16,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  caption: { color: C.muted, fontSize: 12, lineHeight: 18 },
  muted: { color: C.muted, fontSize: 14, lineHeight: 21 },
  navigation: {
    flexDirection: 'row',
    borderTopColor: C.line,
    borderTopWidth: 1,
    backgroundColor: C.surface,
    paddingVertical: 5,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    gap: 5,
  },
  healthContent: { padding: 20, paddingTop: 12 },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 22,
    borderBottomColor: C.line,
    borderBottomWidth: 1,
  },
  healthBody: { flex: 1, gap: 5 },
  healthTitle: { color: C.text, fontSize: 16, fontWeight: '500' },
  healthValue: {
    fontSize: 12,
    maxWidth: 130,
    flexShrink: 1,
    textAlign: 'right',
    lineHeight: 19,
  },
  message: { color: C.muted, fontSize: 14, lineHeight: 23, marginTop: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24 },
  actionButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 5,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.line,
  },
  actionText: { color: C.text, fontSize: 14, flexShrink: 1 },
  accountButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  link: { color: C.accent, fontSize: 14 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 28,
    flexWrap: 'wrap',
  },
  footerLink: { minHeight: 44, justifyContent: 'center' },
  fileButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
});
