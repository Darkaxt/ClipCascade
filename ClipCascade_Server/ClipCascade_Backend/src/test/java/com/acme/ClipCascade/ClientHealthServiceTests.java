package com.acme.ClipCascade;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.user.SimpSession;
import org.springframework.messaging.simp.user.SimpUser;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.messaging.support.GenericMessage;

import com.acme.clipcascade.service.ClientHealthService;
import com.acme.clipcascade.service.WebSocketClientSessionRegistry;

class ClientHealthServiceTests {
    @Test
    void privateSessionNonceTypedAcksAndDisconnectLifecycle() {
        SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
        SimpUserRegistry users = mock(SimpUserRegistry.class);
        WebSocketClientSessionRegistry clients = mock(WebSocketClientSessionRegistry.class);
        SimpUser user = mock(SimpUser.class);
        SimpSession phone = mock(SimpSession.class);
        SimpSession laptop = mock(SimpSession.class);
        when(phone.getId()).thenReturn("phone");
        when(laptop.getId()).thenReturn("laptop");
        when(user.getSessions()).thenReturn(Set.of(phone, laptop));
        when(user.getSession("phone")).thenReturn(phone);
        when(user.getSession("laptop")).thenReturn(laptop);
        when(users.getUser("admin")).thenReturn(user);
        when(clients.getClientName("phone")).thenReturn("Registered phone");
        ClientHealthService health = new ClientHealthService(messaging, users, clients);
        assertThat(health.list("other-user")).isEmpty();
        assertThat(health.list("admin")).allMatch(row -> row.status().equals("unsupported"));
        health.receive("admin", "phone", Map.of("protocol", 1, "kind", "hello", "platform", "android", "version", "3.2.0.29"));
        health.receive("admin", "laptop", Map.of("protocol", 1, "kind", "hello", "platform", "windows", "version", "3.2.0.29"));
        var first = health.probe("admin");
        var phoneProbe = first.stream().filter(row -> row.sessionId().equals("phone")).findFirst().orElseThrow();
        assertThat(phoneProbe.clientName()).isEqualTo("Registered phone");
        assertThat(phoneProbe.status()).isEqualTo("pending");
        assertThat(health.probe("admin")).isEqualTo(first);
        verify(messaging, times(2)).convertAndSendToUser(eq("admin"), eq("/queue/client-health"), any(), any(Map.class));
        Map<String, Object> ack = Map.of("protocol", 1, "kind", "ack", "ackType", "client_alive", "probeId", phoneProbe.probeId());
        health.receive("other-user", "phone", ack);
        health.receive("admin", "laptop", ack);
        assertThat(health.list("admin")).allMatch(row -> row.status().equals("pending"));
        health.receive("admin", "phone", ack);
        var acknowledged = health.list("admin").stream().filter(row -> row.sessionId().equals("phone")).findFirst().orElseThrow();
        assertThat(acknowledged.status()).isEqualTo("acknowledged");
        health.receive("admin", "phone", ack);
        assertThat(health.list("admin")).contains(acknowledged);
        health.receive("admin", "phone", Map.of("protocol", 1, "kind", "ack", "ackType", "clipboard_detected", "clipboardType", "image"));
        var detected = health.list("admin").stream().filter(row -> row.sessionId().equals("phone")).findFirst().orElseThrow();
        assertThat(detected.clipboardDetectedAt()).isNotNull();
        assertThat(detected.clipboardType()).isEqualTo("image");
        health.disconnect(new SessionDisconnectEvent(this, new GenericMessage<>(new byte[0]), "phone", CloseStatus.NORMAL));
        assertThat(health.list("admin").stream().filter(row -> row.sessionId().equals("phone")).findFirst().orElseThrow().status()).isEqualTo("unsupported");
        health.receive("admin", "phone", ack);
        assertThat(health.list("admin").stream().filter(row -> row.sessionId().equals("phone")).findFirst().orElseThrow().acknowledgedAt()).isNull();
    }
}
