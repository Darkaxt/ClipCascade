package com.acme.ClipCascade;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import com.acme.clipcascade.config.ApiKeyStompAuthenticationInterceptor;
import com.acme.clipcascade.service.ApiClientAuthenticationFactory;
import com.acme.clipcascade.service.ApiClientService;

class ApiKeyStompAuthenticationInterceptorTests {
    @Test
    void applicationDeliveryStateCanOnlyComeFromTheServerAndUsePrivateSubscriptions() {
        var interceptor = new ApiKeyStompAuthenticationInterceptor(mock(ApiClientService.class),
                new ApiClientAuthenticationFactory());
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(
                frame(StompCommand.SEND, "/user/admin/queue/clipboard-delivery"), null));
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(
                frame(StompCommand.SUBSCRIBE, "/queue/clipboard-delivery"), null));
        assertNotNull(interceptor.preSend(frame(StompCommand.SUBSCRIBE,
                "/user/queue/clipboard-delivery"), null));
    }

    private Message<byte[]> frame(StompCommand command, String destination) {
        StompHeaderAccessor headers = StompHeaderAccessor.create(command);
        headers.setUser(UsernamePasswordAuthenticationToken.authenticated("admin", null, List.of()));
        headers.setDestination(destination);
        headers.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
    }
}
