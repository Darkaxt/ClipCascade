package com.acme.ClipCascade;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.lang.reflect.Type;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import com.acme.clipcascade.service.ApiClientService;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:clipcascade-health-test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=validate", "app.p2p.enabled=false"
})
class ClientHealthIntegrationTests {
    @LocalServerPort int port;
    @Autowired ApiClientService keys;
    @Autowired TestRestTemplate rest;

    @Test
    @SuppressWarnings("unchecked")
    void realAuthenticatedWebSocketProbeAndCaptureAckWithScopedRestVisibility() throws Exception {
        var device = keys.createClientKey("admin", "Protocol test device", Set.of("sync"));
        var manager = keys.createClientKey("admin", "Protocol test manager", Set.of("manage_keys"));
        HttpHeaders auth = new HttpHeaders();
        auth.set(ApiClientService.API_KEY_HEADER, manager.apiKey());
        HttpHeaders syncAuth = new HttpHeaders();
        syncAuth.set(ApiClientService.API_KEY_HEADER, device.apiKey());
        assertThat(rest.exchange("/api/client-health", HttpMethod.GET, new HttpEntity<>(syncAuth), String.class).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setMessageConverter(new MappingJackson2MessageConverter());
        StompHeaders connect = new StompHeaders();
        connect.add(ApiClientService.STOMP_API_KEY_HEADER, device.apiKey());
        StompSession session = null;
        try {
            session = client.connectAsync("ws://127.0.0.1:" + port + "/clipsocket", new org.springframework.web.socket.WebSocketHttpHeaders(), connect,
                    new StompSessionHandlerAdapter() {}).get(10, TimeUnit.SECONDS);
            StompSession ownedSession = session;
            session.subscribe("/user/queue/client-health", new StompFrameHandler() {
                public Type getPayloadType(StompHeaders headers) { return Map.class; }
                public void handleFrame(StompHeaders headers, Object payload) {
                    Map<String, Object> probe = (Map<String, Object>) payload;
                    ownedSession.send("/app/client-health", Map.of("protocol", 1, "kind", "ack",
                            "ackType", "client_alive", "probeId", probe.get("probeId")));
                }
            });
            session.send("/app/client-health", Map.of("protocol", 1, "kind", "hello", "platform", "windows", "version", "test"));
            await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(rows(auth)).anyMatch(row -> "ready".equals(row.get("status"))));
            assertThat(rest.exchange("/api/client-health/probes", HttpMethod.POST, new HttpEntity<>(auth), Map.class).getStatusCode()).isEqualTo(HttpStatus.OK);
            await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(rows(auth)).anyMatch(row -> "acknowledged".equals(row.get("status"))));
            session.send("/app/client-health", Map.of("protocol", 1, "kind", "ack", "ackType", "clipboard_detected", "clipboardType", "text"));
            await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(rows(auth)).anyMatch(row -> row.get("clipboardDetectedAt") != null && "text".equals(row.get("clipboardType"))));
            assertThat(rows(auth).toString()).doesNotContain(device.apiKey()).doesNotContain("payload");
            session.disconnect();
            session = null;
            await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(rows(auth)).isEmpty());
        } finally {
            if (session != null && session.isConnected()) session.disconnect();
            client.stop();
            keys.revokeClient("admin", device.client().getClientId());
            keys.revokeClient("admin", manager.client().getClientId());
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> rows(HttpHeaders auth) {
        var response = rest.exchange("/api/client-health", HttpMethod.GET, new HttpEntity<>(auth), Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return (List<Map<String, Object>>) response.getBody().get("connections");
    }
}
