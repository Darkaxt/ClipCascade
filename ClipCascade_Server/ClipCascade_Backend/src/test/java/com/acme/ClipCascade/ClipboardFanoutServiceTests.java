package com.acme.ClipCascade;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
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
