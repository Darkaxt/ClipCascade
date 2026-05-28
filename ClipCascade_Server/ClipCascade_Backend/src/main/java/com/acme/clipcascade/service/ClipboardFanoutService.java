package com.acme.clipcascade.service;

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

    public ClipboardFanoutService(
            SimpMessagingTemplate messagingTemplate,
            SimpUserRegistry userRegistry,
            WebSocketClientSessionRegistry clientSessionRegistry) {

        this.messagingTemplate = messagingTemplate;
        this.userRegistry = userRegistry;
        this.clientSessionRegistry = clientSessionRegistry;
    }

    public void sendToOtherClientSessions(
            String username,
            String sourceSessionId,
            String sourceClientId,
            ClipboardData clipboardData) {

        SimpUser user = userRegistry.getUser(username);
        if (user == null) {
            return;
        }

        for (SimpSession session : user.getSessions()) {
            String targetSessionId = session.getId();
            if (targetSessionId == null || targetSessionId.equals(sourceSessionId)) {
                continue;
            }

            String targetClientId = clientSessionRegistry.getClientId(targetSessionId);
            if (sourceClientId != null && sourceClientId.equals(targetClientId)) {
                continue;
            }

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
}
