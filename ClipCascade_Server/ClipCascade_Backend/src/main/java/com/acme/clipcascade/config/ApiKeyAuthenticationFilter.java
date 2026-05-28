package com.acme.clipcascade.config;

import java.io.IOException;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.acme.clipcascade.service.ApiClientAuthenticationFactory;
import com.acme.clipcascade.service.ApiClientService;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class ApiKeyAuthenticationFilter extends OncePerRequestFilter {

    private final ApiClientService apiClientService;
    private final ApiClientAuthenticationFactory authenticationFactory;

    public ApiKeyAuthenticationFilter(
            ApiClientService apiClientService,
            ApiClientAuthenticationFactory authenticationFactory) {

        this.apiClientService = apiClientService;
        this.authenticationFactory = authenticationFactory;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String apiKey = apiClientService.extractApiKey(
                request.getHeader(ApiClientService.API_KEY_HEADER),
                request.getHeader("Authorization"));

        if (apiKey != null && !apiKey.isBlank()) {
            apiClientService.authenticate(apiKey)
                    .map(authenticated -> authenticationFactory.createAuthentication(
                            authenticated.user(),
                            authenticated.client()))
                    .ifPresentOrElse(
                            authentication -> SecurityContextHolder.getContext().setAuthentication(authentication),
                            SecurityContextHolder::clearContext);
        }

        filterChain.doFilter(request, response);
    }
}
