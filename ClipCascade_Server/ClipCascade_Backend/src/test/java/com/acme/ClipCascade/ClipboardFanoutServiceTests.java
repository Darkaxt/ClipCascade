package com.acme.ClipCascade;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.times;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.user.SimpSession;
import org.springframework.messaging.simp.user.SimpUser;
import org.springframework.messaging.simp.user.SimpUserRegistry;

import com.acme.clipcascade.model.ClipboardData;
import com.acme.clipcascade.service.ClipboardFanoutService;
import com.acme.clipcascade.service.WebSocketClientSessionRegistry;

class ClipboardFanoutServiceTests {

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void deliveryRequiresAppliedAckFromEveryActualRecipientForTheSameUserAndMessage() {
        SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
        SimpUserRegistry registry = mock(SimpUserRegistry.class);
        ClipboardFanoutService fanout = new ClipboardFanoutService(messaging, registry,
                mock(WebSocketClientSessionRegistry.class));
        SimpUser user = userWithSessions("admin", "sender", "phone", "laptop");
        when(registry.getUser("admin")).thenReturn(user);
        ClipboardData data = new ClipboardData("encrypted", "text",
                Map.of("deliveryId", "id-1", "sourceSessionId", "forged"));
        fanout.sendToOtherClientSessions("admin", "sender", null, data);
        assertEquals("sender", data.getMetadata().get("sourceSessionId"));
        Map<String, Object> ack = Map.of("protocol", 1, "ackType", "clipboard_applied",
                "sourceSessionId", "sender", "deliveryId", "id-1");
        fanout.acknowledge("admin", "sender", ack);
        fanout.acknowledge("different-user", "phone", ack);
        fanout.acknowledge("admin", "not-a-recipient", ack);
        fanout.acknowledge("admin", "phone", ack);
        fanout.acknowledge("admin", "laptop", ack);
        ArgumentCaptor<Map> states = ArgumentCaptor.forClass(Map.class);
        verify(messaging, times(3)).convertAndSendToUser(eq("admin"), eq("/queue/clipboard-delivery"),
                states.capture(), headersForSession("sender"));
        assertFalse((Boolean) states.getAllValues().get(0).get("complete"));
        assertFalse((Boolean) states.getAllValues().get(1).get("complete"));
        assertTrue((Boolean) states.getAllValues().get(2).get("complete"));
        assertEquals(2, states.getValue().get("expected"));

        // Reusing a delivered ID for different ciphertext cannot inherit its ACK.
        fanout.sendToOtherClientSessions("admin", "sender", null,
                new ClipboardData("different", "text", Map.of("deliveryId", "id-1")));
        verify(messaging, times(3)).convertAndSendToUser(eq("admin"), eq("/queue/clipboard-delivery"),
                org.mockito.ArgumentMatchers.any(), headersForSession("sender"));
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void noRecipientsNeverMeansDelivered() {
        SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
        SimpUserRegistry registry = mock(SimpUserRegistry.class);
        ClipboardFanoutService fanout = new ClipboardFanoutService(messaging, registry,
                mock(WebSocketClientSessionRegistry.class));
        SimpUser user = userWithSessions("admin", "sender");
        when(registry.getUser("admin")).thenReturn(user);
        fanout.sendToOtherClientSessions("admin", "sender", null,
                new ClipboardData("encrypted", "text", Map.of("deliveryId", "id-1")));
        ArgumentCaptor<Map> state = ArgumentCaptor.forClass(Map.class);
        verify(messaging).convertAndSendToUser(eq("admin"), eq("/queue/clipboard-delivery"),
                state.capture(), headersForSession("sender"));
        assertEquals(0, state.getValue().get("expected"));
        assertFalse((Boolean) state.getValue().get("complete"));
    }

    @Test
    void sendsToOtherSessionsButNotTheOriginSession() {
        SimpMessagingTemplate messagingTemplate = mock(SimpMessagingTemplate.class);
        SimpUserRegistry userRegistry = mock(SimpUserRegistry.class);
        WebSocketClientSessionRegistry clientSessionRegistry = mock(WebSocketClientSessionRegistry.class);
        ClipboardFanoutService fanoutService = new ClipboardFanoutService(
                messagingTemplate,
                userRegistry,
                clientSessionRegistry);
        ClipboardData clipboardData = new ClipboardData("payload", "text", null);
        SimpUser user = userWithSessions("admin", "windows-session", "android-session");

        when(userRegistry.getUser("admin")).thenReturn(user);

        fanoutService.sendToOtherClientSessions("admin", "windows-session", null, clipboardData);

        verify(messagingTemplate, never()).convertAndSendToUser(
                eq("admin"),
                eq("/queue/cliptext"),
                eq(clipboardData),
                headersForSession("windows-session"));
        verify(messagingTemplate).convertAndSendToUser(
                eq("admin"),
                eq("/queue/cliptext"),
                eq(clipboardData),
                headersForSession("android-session"));
    }

    @Test
    void skipsAllSessionsForTheSourceApiClientId() {
        SimpMessagingTemplate messagingTemplate = mock(SimpMessagingTemplate.class);
        SimpUserRegistry userRegistry = mock(SimpUserRegistry.class);
        WebSocketClientSessionRegistry clientSessionRegistry = mock(WebSocketClientSessionRegistry.class);
        ClipboardFanoutService fanoutService = new ClipboardFanoutService(
                messagingTemplate,
                userRegistry,
                clientSessionRegistry);
        ClipboardData clipboardData = new ClipboardData("payload", "text", null);
        SimpUser user = userWithSessions(
                "admin",
                "windows-primary",
                "windows-duplicate",
                "android-session");

        when(userRegistry.getUser("admin")).thenReturn(user);
        when(clientSessionRegistry.getClientId("windows-primary")).thenReturn("windows-client");
        when(clientSessionRegistry.getClientId("windows-duplicate")).thenReturn("windows-client");
        when(clientSessionRegistry.getClientId("android-session")).thenReturn("android-client");

        fanoutService.sendToOtherClientSessions("admin", "windows-primary", "windows-client", clipboardData);

        verify(messagingTemplate, never()).convertAndSendToUser(
                eq("admin"),
                eq("/queue/cliptext"),
                eq(clipboardData),
                headersForSession("windows-primary"));
        verify(messagingTemplate, never()).convertAndSendToUser(
                eq("admin"),
                eq("/queue/cliptext"),
                eq(clipboardData),
                headersForSession("windows-duplicate"));
        verify(messagingTemplate).convertAndSendToUser(
                eq("admin"),
                eq("/queue/cliptext"),
                eq(clipboardData),
                headersForSession("android-session"));
    }

    private static SimpUser userWithSessions(String username, String... sessionIds) {
        SimpUser user = mock(SimpUser.class);
        Set<SimpSession> sessions = new java.util.LinkedHashSet<>();
        for (String sessionId : sessionIds) {
            SimpSession session = mock(SimpSession.class);
            when(session.getId()).thenReturn(sessionId);
            sessions.add(session);
        }
        when(user.getName()).thenReturn(username);
        when(user.getSessions()).thenReturn(sessions);
        return user;
    }

    private static Map<String, Object> headersForSession(String sessionId) {
        return org.mockito.ArgumentMatchers.argThat(headers ->
                headers != null && sessionId.equals(headers.get(SimpMessageHeaderAccessor.SESSION_ID_HEADER)));
    }
}
