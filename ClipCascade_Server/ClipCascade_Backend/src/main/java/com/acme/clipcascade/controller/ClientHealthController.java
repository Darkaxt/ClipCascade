package com.acme.clipcascade.controller;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;

import com.acme.clipcascade.model.UserPrincipal;
import com.acme.clipcascade.service.ApiClientService;
import com.acme.clipcascade.service.ClientHealthService;

@Controller
public class ClientHealthController {
    private final ClientHealthService health;
    private final ApiClientService clients;

    public ClientHealthController(@Nullable ClientHealthService health, ApiClientService clients) {
        this.health = health;
        this.clients = clients;
    }

    @GetMapping("/api/client-health")
    public ResponseEntity<?> list(@AuthenticationPrincipal UserPrincipal user) {
        return response(user, false);
    }

    @PostMapping("/api/client-health/probes")
    public ResponseEntity<?> probe(@AuthenticationPrincipal UserPrincipal user) {
        return response(user, true);
    }

    private ResponseEntity<?> response(UserPrincipal user, boolean probe) {
        if (!clients.hasScope(user, ApiClientService.SCOPE_MANAGE_KEYS)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Forbidden");
        }
        return ResponseEntity.ok(Map.of("mode", health == null ? "P2P" : "P2S",
                "supported", health != null, "connections", health == null ? List.of()
                        : probe ? health.probe(user.getUsername()) : health.list(user.getUsername())));
    }

    @MessageMapping("/client-health")
    public void receive(Principal principal, SimpMessageHeaderAccessor headers, Map<String, Object> message) {
        UserPrincipal user = UserPrincipal.fromAuthenticationPrincipal(principal);
        if (health != null && user != null && (user.getClientId() == null
                || clients.hasScope(user, ApiClientService.SCOPE_SYNC))) {
            health.receive(user.getUsername(), headers.getSessionId(), message);
        }
    }
}
