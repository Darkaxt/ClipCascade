package com.acme.ClipCascade;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import com.acme.clipcascade.config.ApiKeyAuthenticationFilter;
import com.acme.clipcascade.constants.RoleConstants;
import com.acme.clipcascade.model.ApiClient;
import com.acme.clipcascade.model.UserPrincipal;
import com.acme.clipcascade.model.Users;
import com.acme.clipcascade.service.ApiClientAuthenticationFactory;
import com.acme.clipcascade.service.ApiClientService;

class ApiKeyAuthenticationFilterTests {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void apiKeyHeaderOverridesExistingSessionAuthentication() throws Exception {
        ApiClientService apiClientService = mock(ApiClientService.class);
        ApiKeyAuthenticationFilter filter = new ApiKeyAuthenticationFilter(
                apiClientService,
                new ApiClientAuthenticationFactory());

        Users sessionUser = new Users("admin", "session-password", RoleConstants.ADMIN, true);
        UserPrincipal sessionPrincipal = new UserPrincipal(sessionUser, null);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                sessionPrincipal,
                null,
                sessionPrincipal.getAuthorities()));

        Users apiUser = new Users("admin", "api-password", RoleConstants.ADMIN, true);
        ApiClient apiClient = new ApiClient(
                "manager-client",
                "admin",
                "Browser key manager",
                "hash",
                ApiClientService.SCOPE_MANAGE_KEYS,
                1L,
                1L,
                true);
        when(apiClientService.extractApiKey("cck_valid", null)).thenReturn("cck_valid");
        when(apiClientService.authenticate("cck_valid"))
                .thenReturn(Optional.of(new ApiClientService.AuthenticatedApiClient(apiClient, apiUser)));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(ApiClientService.API_KEY_HEADER, "cck_valid");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        assertThat(principal.getClientId()).isEqualTo("manager-client");
        assertThat(principal.getClientScopes()).isEqualTo(Set.of(ApiClientService.SCOPE_MANAGE_KEYS));
    }

    @Test
    void invalidApiKeyHeaderDoesNotFallBackToExistingSessionAuthentication() throws Exception {
        ApiClientService apiClientService = mock(ApiClientService.class);
        ApiKeyAuthenticationFilter filter = new ApiKeyAuthenticationFilter(
                apiClientService,
                new ApiClientAuthenticationFactory());

        Users sessionUser = new Users("admin", "session-password", RoleConstants.ADMIN, true);
        UserPrincipal sessionPrincipal = new UserPrincipal(sessionUser, null);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                sessionPrincipal,
                null,
                sessionPrincipal.getAuthorities()));

        when(apiClientService.extractApiKey("cck_invalid", null)).thenReturn("cck_invalid");
        when(apiClientService.authenticate("cck_invalid")).thenReturn(Optional.empty());

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(ApiClientService.API_KEY_HEADER, "cck_invalid");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }
}
