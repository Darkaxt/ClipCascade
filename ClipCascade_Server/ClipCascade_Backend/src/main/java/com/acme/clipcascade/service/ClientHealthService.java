package com.acme.clipcascade.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.user.SimpSession;
import org.springframework.messaging.simp.user.SimpUser;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Service
@ConditionalOnProperty(prefix = "app.p2p", name = "enabled", havingValue = "false")
public class ClientHealthService {
    private final SimpMessagingTemplate messaging;
    private final SimpUserRegistry users;
    private final WebSocketClientSessionRegistry clients;
    private final Map<String, State> states = new HashMap<>();

    private static class State {
        String platform;
        String version;
        String probeId;
        Instant probedAt;
        Instant acknowledgedAt;
        Instant clipboardDetectedAt;
        String clipboardType;
    }

    public record Connection(String sessionId, String clientId, String clientName,
            String platform, String version, String status, String probeId,
            String probedAt, String acknowledgedAt, String clipboardDetectedAt,
            String clipboardType) {}

    public ClientHealthService(SimpMessagingTemplate messaging, SimpUserRegistry users,
            WebSocketClientSessionRegistry clients) {
        this.messaging = messaging;
        this.users = users;
        this.clients = clients;
    }

    public synchronized void receive(String username, String sessionId, Map<String, Object> message) {
        SimpUser user = users.getUser(username);
        if (sessionId == null || user == null || user.getSession(sessionId) == null
                || !Integer.valueOf(1).equals(message.get("protocol"))) {
            return;
        }
        if ("hello".equals(message.get("kind"))) {
            Object platform = message.get("platform");
            Object version = message.get("version");
            if (!("windows".equals(platform) || "android".equals(platform))
                    || !(version instanceof String value) || !value.matches("[A-Za-z0-9._-]{1,40}")) {
                return;
            }
            State state = states.computeIfAbsent(sessionId, ignored -> new State());
            state.platform = (String) platform;
            state.version = value;
        } else if ("ack".equals(message.get("kind"))) {
            State state = states.get(sessionId);
            if (state == null) {
                return;
            }
            if ("client_alive".equals(message.get("ackType")) && state.probeId != null
                    && state.acknowledgedAt == null && state.probeId.equals(message.get("probeId"))) {
                state.acknowledgedAt = Instant.now();
            } else if ("clipboard_detected".equals(message.get("ackType"))
                    && message.get("clipboardType") instanceof String type
                    && Set.of("text", "image", "files").contains(type)) {
                state.clipboardDetectedAt = Instant.now();
                state.clipboardType = (String) message.get("clipboardType");
            }
        }
    }

    public synchronized List<Connection> list(String username) {
        SimpUser user = users.getUser(username);
        List<Connection> result = new ArrayList<>();
        if (user == null) {
            return result;
        }
        for (SimpSession session : user.getSessions()) {
            State state = states.get(session.getId());
            result.add(new Connection(session.getId(), clients.getClientId(session.getId()),
                    clients.getClientName(session.getId()), state == null ? null : state.platform,
                    state == null ? null : state.version,
                    state == null ? "unsupported" : state.probeId == null ? "ready"
                            : state.acknowledgedAt == null ? "pending" : "acknowledged",
                    state == null ? null : state.probeId, state == null ? null : utc(state.probedAt),
                    state == null ? null : utc(state.acknowledgedAt),
                    state == null ? null : utc(state.clipboardDetectedAt),
                    state == null ? null : state.clipboardType));
        }
        result.sort(java.util.Comparator.comparing(Connection::sessionId));
        return result;
    }

    public synchronized List<Connection> probe(String username) {
        for (Connection connection : list(username)) {
            State state = states.get(connection.sessionId());
            if (state == null || (state.probeId != null && state.acknowledgedAt == null)) {
                continue;
            }
            state.probeId = UUID.randomUUID().toString();
            state.probedAt = Instant.now();
            state.acknowledgedAt = null;
            SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
            headers.setSessionId(connection.sessionId());
            headers.setLeaveMutable(true);
            try {
                messaging.convertAndSendToUser(username, "/queue/client-health", Map.of(
                        "protocol", 1, "kind", "probe", "probeId", state.probeId), headers.getMessageHeaders());
            } catch (RuntimeException failure) {
                state.probeId = null;
                state.probedAt = null;
                throw failure;
            }
        }
        return list(username);
    }

    @EventListener
    public synchronized void disconnect(SessionDisconnectEvent event) {
        states.remove(event.getSessionId());
    }

    private static String utc(Instant instant) {
        return instant == null ? null : instant.toString();
    }
}
