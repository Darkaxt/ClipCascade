import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  getClipboardEvents,
  subscribeClipboardEvents,
} from './ClipboardEventLog';

const directionLabels = {
  inbound: 'Inbound',
  outbound: 'Outbound',
  system: 'System',
};

const typeLabels = {
  files: 'Files',
  image: 'Image',
  text: 'Text',
};

const formatTime = timestamp => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '--:--:--';
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export default function ClipboardActivityLog() {
  const [events, setEvents] = useState(getClipboardEvents());

  useEffect(() => subscribeClipboardEvents(setEvents), []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recent Clipboard Activity</Text>
      {events.length === 0 ? (
        <Text style={styles.emptyState}>No clipboard activity yet</Text>
      ) : (
        <View style={styles.table}>
          {events.map(event => (
            <View key={event.id} style={styles.row}>
              <View style={styles.metaColumn}>
                <Text style={styles.timeText}>{formatTime(event.timestamp)}</Text>
                <Text style={styles.metaText}>
                  {directionLabels[event.direction] || event.direction} ·{' '}
                  {typeLabels[event.type] || event.type}
                </Text>
              </View>
              <View style={styles.previewColumn}>
                <Text style={styles.previewText} numberOfLines={2}>
                  {event.preview}
                </Text>
                {event.metadataText ? (
                  <Text style={styles.metadataText} numberOfLines={1}>
                    {event.metadataText}
                  </Text>
                ) : null}
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{event.status}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 22,
    width: '100%',
  },
  title: {
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyState: {
    color: '#bfc2c7',
    fontSize: 14,
    paddingVertical: 14,
    textAlign: 'center',
  },
  table: {
    borderColor: '#555a60',
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    borderBottomColor: '#45494e',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 62,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  metaColumn: {
    width: 82,
  },
  timeText: {
    color: '#f4f4f5',
    fontSize: 12,
    fontWeight: 'bold',
  },
  metaText: {
    color: '#bfc2c7',
    fontSize: 11,
    marginTop: 2,
  },
  previewColumn: {
    flex: 1,
    minWidth: 0,
  },
  previewText: {
    color: '#f4f4f5',
    fontSize: 14,
  },
  metadataText: {
    color: '#bfc2c7',
    fontSize: 12,
    marginTop: 3,
  },
  statusPill: {
    alignItems: 'center',
    borderColor: '#4f6875',
    borderRadius: 5,
    borderWidth: 1,
    minWidth: 72,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusText: {
    color: '#78c7dd',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
