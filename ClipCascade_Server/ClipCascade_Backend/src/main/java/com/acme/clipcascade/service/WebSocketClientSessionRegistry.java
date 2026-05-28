package com.acme.clipcascade.service;

import java.security.Principal;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import com.acme.clipcascade.model.UserPrincipal;

@Service
public class WebSocketClientSessionRegistry {

    private final Map<String, String> clientIdsBySessionId = new ConcurrentHashMap<>();

    @EventListener
    public void onSessionConnect(SessionConnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        if (sessionId == null) {
            return;
        }

        Principal user = accessor.getUser();
        if (user == null) {
            return;
        }

        UserPrincipal userPrincipal = UserPrincipal.fromAuthenticationPrincipal(user);
        if (userPrincipal == null || userPrincipal.getClientId() == null) {
            return;
        }

        clientIdsBySessionId.put(sessionId, userPrincipal.getClientId());
    }

    @EventListener
    public void onSessionDisconnect(SessionDisconnectEvent event) {
        clientIdsBySessionId.remove(event.getSessionId());
    }

    public String getClientId(String sessionId) {
        if (sessionId == null) {
            return null;
        }
        return clientIdsBySessionId.get(sessionId);
    }
}
