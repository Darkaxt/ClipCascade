package com.acme.clipcascade.config;

import java.security.Principal;

import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import com.acme.clipcascade.service.ApiClientAuthenticationFactory;
import com.acme.clipcascade.service.ApiClientService;

@Component
public class ApiKeyStompAuthenticationInterceptor implements ChannelInterceptor {

    private final ApiClientService apiClientService;
    private final ApiClientAuthenticationFactory authenticationFactory;

    public ApiKeyStompAuthenticationInterceptor(
            ApiClientService apiClientService,
            ApiClientAuthenticationFactory authenticationFactory) {

        this.apiClientService = apiClientService;
        this.authenticationFactory = authenticationFactory;
    }

    @Override
    public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            authenticateConnect(accessor);
        }

        if (requiresAuthenticatedUser(accessor.getCommand()) && !hasAuthenticatedUser(accessor.getUser())) {
            throw new AccessDeniedException("WebSocket authentication required");
        }

        return message;
    }

    private void authenticateConnect(StompHeaderAccessor accessor) {
        if (hasAuthenticatedUser(accessor.getUser())) {
            return;
        }

        String apiKey = apiClientService.extractApiKey(
                accessor.getFirstNativeHeader(ApiClientService.STOMP_API_KEY_HEADER),
                accessor.getFirstNativeHeader("authorization"));

        apiClientService.authenticate(apiKey)
                .map(authenticated -> authenticationFactory.createAuthentication(
                        authenticated.user(),
                        authenticated.client()))
                .ifPresent(accessor::setUser);
    }

    private static boolean requiresAuthenticatedUser(StompCommand command) {
        return StompCommand.CONNECT.equals(command)
                || StompCommand.SEND.equals(command)
                || StompCommand.SUBSCRIBE.equals(command);
    }

    private static boolean hasAuthenticatedUser(Principal principal) {
        return principal instanceof Authentication authentication && authentication.isAuthenticated();
    }
}
