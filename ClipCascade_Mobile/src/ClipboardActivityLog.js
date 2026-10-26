import { useEffect, useState } from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  CircleAlert,
  Clock3,
  Copy,
  Search,
  Send,
  Trash2,
} from 'lucide-react-native';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  clearClipboardEvents,
  getClipboardEvents,
  getReplayableText,
  subscribeClipboardEvents,
} from './ClipboardEventLog';
import { setDataInAsyncStorage } from './AsyncStorageManagement';
import { copyReplayTextLocally } from './LocalClipboardReplay';
import {
  isClipboardResendAvailable,
  resendClipboardText,
  subscribeClipboardResendState,
} from './ClipboardResend';
import {
  eventTone,
  filterClipboardEvents,
  UI_COLORS as C,
} from './UiPresentation';

const formatTime = value =>
  new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
const title = value =>
  String(value || '').replace(/^./, character => character.toUpperCase());

export default function ClipboardActivityLog() {
  const [events, setEvents] = useState(getClipboardEvents());
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [canResend, setCanResend] = useState(isClipboardResendAvailable());
  const [resending, setResending] = useState(false);
  useEffect(() => subscribeClipboardEvents(setEvents), []);
  useEffect(() => subscribeClipboardResendState(setCanResend), []);
  useEffect(() => {
    setSelectedId(current =>
      events.some(event => event.id === current)
        ? current
        : events[0]?.id || null,
    );
  }, [events]);
  const filtered = filterClipboardEvents(events, query, filter);
  const selected = filtered.find(event => event.id === selectedId);
  const available = Boolean(selected?.replayable && selected.type === 'text');

  const resend = async () => {
    if (!available || resending) {
      return;
    }
    setResending(true);
    try {
      const result = await resendClipboardText(selected.id, getReplayableText);
      ToastAndroid.show(
        {
          sent: 'Sent to transport - delivery not yet confirmed',
          disconnected: 'Reconnect before resending',
          unavailable: 'Clipboard entry is no longer available',
          failed: 'Unable to resend - check connection and size limit',
        }[result],
        ToastAndroid.SHORT,
      );
    } finally {
      setResending(false);
    }
  };
  const copy = async () => {
    if (!available) {
      return;
    }
    const result = await copyReplayTextLocally({
      eventId: selected.id,
      getReplayableText,
      setValue: setDataInAsyncStorage,
      setClipboardText: Clipboard.setString,
    });
    ToastAndroid.show(
      result.copied
        ? 'Copied locally - not synced'
        : result.reason === 'unavailable'
        ? 'Clipboard entry is no longer available'
        : 'Unable to copy clipboard entry',
      ToastAndroid.SHORT,
    );
  };
  const clear = () =>
    Alert.alert(
      'Clear clipboard history?',
      'Remove entries stored on this device. Other devices are unchanged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear history',
          style: 'destructive',
          onPress: clearClipboardEvents,
        },
      ],
    );
  const renderRow = ({ item: event }) => {
    const active = event.id === selected?.id;
    const color = C[eventTone(event.status)];
    const status = String(event.status).toLowerCase();
    const StatusIcon =
      status === 'delivered'
        ? CheckCheck
        : status === 'applied'
        ? Check
        : status === 'sent'
        ? Clock3
        : ['error', 'failed', 'rejected'].includes(status)
        ? CircleAlert
        : null;
    const DirectionIcon =
      event.direction === 'outbound' ? ArrowUpRight : ArrowDownLeft;
    const content =
      active && event.replayable ? getReplayableText(event.id) : event.preview;
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${title(event.type)} ${title(
          event.status,
        )} ${formatTime(event.timestamp)}`}
        accessibilityState={{ selected: active }}
        onPress={() => setSelectedId(event.id)}
        style={[styles.row, active && styles.selected]}
      >
        <Text
          selectable={active}
          style={styles.preview}
          numberOfLines={active ? undefined : 2}
        >
          {content || event.metadataText || title(event.type)}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.meta}>
            <DirectionIcon size={14} color={C.muted} />
            <Text style={styles.caption}>{formatTime(event.timestamp)}</Text>
            <Text style={styles.caption}>{title(event.type)}</Text>
          </View>
          <View style={styles.meta}>
            {StatusIcon ? <StatusIcon size={15} color={color} /> : null}
            <Text style={[styles.caption, { color }]}>
              {title(event.status)}
            </Text>
          </View>
        </View>
        {active && event.metadataText ? (
          <Text style={styles.detail}>{event.metadataText}</Text>
        ) : null}
      </TouchableOpacity>
    );
  };
  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.search}>
          <Search size={18} color={C.muted} />
          <TextInput
            accessibilityLabel="Search clipboard history"
            placeholder="Search clipboard history"
            placeholderTextColor={C.muted}
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Clear history"
          onPress={clear}
          style={styles.iconButton}
        >
          <Trash2 size={21} color={C.muted} />
        </TouchableOpacity>
      </View>
      <View style={styles.filters} accessibilityRole="tablist">
        {['All', 'Text', 'Needs attention'].map(mode => (
          <TouchableOpacity
            key={mode}
            accessibilityRole="tab"
            accessibilityLabel={mode}
            accessibilityState={{ selected: filter === mode }}
            onPress={() => setFilter(mode)}
            style={[styles.filter, filter === mode && styles.activeFilter]}
          >
            <Text
              style={[
                styles.filterText,
                filter === mode && styles.activeFilterText,
              ]}
            >
              {mode}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        testID="clipboard-history-list"
        data={filtered}
        extraData={selected?.id}
        keyExtractor={event => event.id}
        renderItem={renderRow}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {events.length
              ? 'No matching clipboard entries'
              : 'No clipboard activity yet'}
          </Text>
        }
      />
      <View style={styles.actions}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Copy locally without syncing"
          accessibilityState={{ disabled: !available }}
          disabled={!available}
          onPress={copy}
          style={[styles.copyButton, !available && styles.disabled]}
        >
          <Copy size={19} color={C.buttonInk} />
          <Text style={styles.copyText}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Resend text to connected devices"
          accessibilityState={{
            disabled: !available || !canResend || resending,
          }}
          disabled={!available || !canResend || resending}
          onPress={resend}
          style={[
            styles.resendButton,
            (!available || !canResend || resending) && styles.disabled,
          ]}
        >
          <Send size={19} color={C.text} />
          <Text style={styles.resendText}>Resend</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  search: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingLeft: 12,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.field,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    color: C.text,
    fontSize: 16,
    paddingHorizontal: 0,
    paddingVertical: 9,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 5,
  },
  filters: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    flexWrap: 'wrap',
  },
  filter: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeFilter: { borderBottomColor: C.accent },
  filterText: { color: C.muted, fontSize: 14 },
  activeFilterText: { color: C.accent },
  list: { paddingHorizontal: 20, paddingBottom: 12 },
  row: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: C.line },
  selected: {
    backgroundColor: C.selection,
    marginHorizontal: -12,
    paddingHorizontal: 12,
  },
  preview: { color: C.text, fontSize: 16, lineHeight: 25, marginBottom: 9 },
  caption: { fontSize: 12, color: C.muted, lineHeight: 18 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  detail: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 12 },
  empty: { color: C.muted, fontSize: 16, lineHeight: 25, paddingVertical: 30 },
  actions: {
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: C.surface,
  },
  copyButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 5,
    paddingVertical: 10,
  },
  copyText: { color: C.buttonInk, fontSize: 16 },
  resendButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.raised,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 10,
  },
  resendText: { color: C.text, fontSize: 16 },
  disabled: { opacity: 0.45 },
});
