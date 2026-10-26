package com.acme.clipcascade.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

import org.springframework.context.event.EventListener;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.user.SimpSession;
import org.springframework.messaging.simp.user.SimpUser;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.stereotype.Service;

import com.acme.clipcascade.model.ClipboardData;

@Service
public class ClipboardFanoutService {

    private final SimpMessagingTemplate messagingTemplate;
    private final SimpUserRegistry userRegistry;
    private final WebSocketClientSessionRegistry clientSessionRegistry;
    private final Map<String, LinkedHashMap<String, Delivery>> deliveries = new HashMap<>();
    private static final int MAX_DELIVERIES_PER_USER = 128;

    private record Delivery(String origin, Set<String> expected, Set<String> applied, String fingerprint) {}

    public ClipboardFanoutService(
            SimpMessagingTemplate messagingTemplate,
            SimpUserRegistry userRegistry,
            WebSocketClientSessionRegistry clientSessionRegistry) {

        this.messagingTemplate = messagingTemplate;
        this.userRegistry = userRegistry;
        this.clientSessionRegistry = clientSessionRegistry;
    }

    public synchronized void sendToOtherClientSessions(
            String username,
            String sourceSessionId,
            String sourceClientId,
            ClipboardData clipboardData) {

        SimpUser user = userRegistry.getUser(username);
        if (user == null) {
            return;
        }

        ArrayList<String> targets = new ArrayList<>();
        for (SimpSession session : user.getSessions()) {
            String targetSessionId = session.getId();
            if (targetSessionId == null || targetSessionId.equals(sourceSessionId)) {
                continue;
            }

            String targetClientId = clientSessionRegistry.getClientId(targetSessionId);
            if (sourceClientId != null && sourceClientId.equals(targetClientId)) {
                continue;
            }
            targets.add(targetSessionId);
        }

        Object deliveryId = clipboardData.getMetadata() == null ? null
                : clipboardData.getMetadata().get("deliveryId");
        if (deliveryId instanceof String id && id.matches("[A-Za-z0-9-]{1,64}")
                && sourceSessionId != null && user.getSessions().stream()
                        .anyMatch(session -> sourceSessionId.equals(session.getId()))) {
            Map<String, Object> metadata = new HashMap<>(clipboardData.getMetadata());
            metadata.put("sourceSessionId", sourceSessionId);
            clipboardData.setMetadata(metadata);
            LinkedHashMap<String, Delivery> pending = deliveries.computeIfAbsent(username,
                    ignored -> new LinkedHashMap<>());
            // IDs are bound to a source session. Never let another client replace an entry.
            String key = sourceSessionId + ":" + id;
            Delivery delivery = pending.get(key);
            String fingerprint = fingerprint(clipboardData);
            if (delivery == null) {
                delivery = new Delivery(sourceSessionId, new HashSet<>(targets), new HashSet<>(), fingerprint);
                pending.put(key, delivery);
                while (pending.size() > MAX_DELIVERIES_PER_USER) {
                    pending.remove(pending.keySet().iterator().next());
                }
            } else {
                if (!delivery.fingerprint().equals(fingerprint)) {
                    return;
                }
                targets.retainAll(delivery.expected());
            }
            report(username, id, delivery);
        } else if (clipboardData.getMetadata() != null) {
            Map<String, Object> metadata = new HashMap<>(clipboardData.getMetadata());
            metadata.remove("deliveryId");
            metadata.remove("sourceSessionId");
            clipboardData.setMetadata(metadata);
        }

        for (String targetSessionId : targets) {

            SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
            headers.setSessionId(targetSessionId);
            headers.setLeaveMutable(true);
            messagingTemplate.convertAndSendToUser(
                    username,
                    "/queue/cliptext",
                    clipboardData,
                    headers.getMessageHeaders());
        }
    }

    public synchronized void acknowledge(String username, String sessionId, Map<String, Object> message) {
        if (!Integer.valueOf(1).equals(message.get("protocol"))
                || !"clipboard_applied".equals(message.get("ackType"))) {
            return;
        }
        SimpUser user = userRegistry.getUser(username);
        if (sessionId == null || user == null || user.getSessions().stream()
                .noneMatch(session -> sessionId.equals(session.getId()))) {
            return;
        }
        Object origin = message.get("sourceSessionId");
        Object id = message.get("deliveryId");
        if (!(origin instanceof String) || !(id instanceof String)) {
            return;
        }
        Map<String, Delivery> pending = deliveries.get(username);
        Delivery delivery = pending == null ? null : pending.get(origin + ":" + id);
        if (delivery == null || !delivery.expected().contains(sessionId)) {
            return;
        }
        delivery.applied().add(sessionId);
        report(username, (String) id, delivery);
    }

    private void report(String username, String id, Delivery delivery) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        headers.setSessionId(delivery.origin());
        headers.setLeaveMutable(true);
        messagingTemplate.convertAndSendToUser(username, "/queue/clipboard-delivery", Map.of(
                "protocol", 1, "kind", "clipboard_delivery", "deliveryId", id,
                "expected", delivery.expected().size(), "applied", delivery.applied().size(),
                "complete", !delivery.expected().isEmpty()
                        && delivery.applied().containsAll(delivery.expected())), headers.getMessageHeaders());
    }

    @EventListener
    public synchronized void disconnect(SessionDisconnectEvent event) {
        deliveries.values().forEach(pending -> pending.values().removeIf(
                delivery -> delivery.origin().equals(event.getSessionId())));
        deliveries.values().removeIf(Map::isEmpty);
        // A departed recipient is not an application ACK. Its delivery stays unconfirmed.
        if (event.getUser() != null) {
            invalidateSenderCaches(event.getUser().getName(), event.getSessionId());
        }
    }

    @EventListener
    public synchronized void subscribe(SessionSubscribeEvent event) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.wrap(event.getMessage());
        if (event.getUser() != null && "/user/queue/cliptext".equals(headers.getDestination())) {
            invalidateSenderCaches(event.getUser().getName(), headers.getSessionId());
        }
    }

    private void invalidateSenderCaches(String username, String changedSession) {
        SimpUser user = userRegistry.getUser(username);
        if (user == null) { return; }
        for (SimpSession session : user.getSessions()) {
            if (session.getId().equals(changedSession)) { continue; }
            SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
            headers.setSessionId(session.getId());
            headers.setLeaveMutable(true);
            messagingTemplate.convertAndSendToUser(username, "/queue/clipboard-delivery",
                    Map.of("protocol", 1, "kind", "clipboard_delivery_reset"), headers.getMessageHeaders());
        }
    }

    private static String fingerprint(ClipboardData data) {
        try {
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(
                    (data.getType() + "\0" + data.getPayload()).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
