"""Presentation-only filtering; delivery and replay remain owned by their controllers."""


def status_tone(status):
    value = (status or '').lower()
    if value in {'applied', 'delivered'}:
        return 'good'
    if value == 'sent':
        return 'pending'
    if value in {'error', 'rejected', 'failed'}:
        return 'error'
    return 'muted'


def filter_activity_events(events, query='', mode='All'):
    query = query.strip().casefold()
    return [event for event in events
            if (mode != 'Text' or event.payload_type.lower() == 'text')
            and (mode != 'Needs attention' or event.status.lower() in {'sent', 'error', 'rejected', 'failed'})
            and (not query or query in ' '.join((event.preview, event.detail, event.status,
                                                event.direction, event.payload_type)).casefold())]
