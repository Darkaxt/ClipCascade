package com.acme.clipcascade.service;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;

import com.acme.clipcascade.model.ApiClient;
import com.acme.clipcascade.model.UserPrincipal;
import com.acme.clipcascade.model.Users;

@Service
public class ApiClientAuthenticationFactory {

    public UsernamePasswordAuthenticationToken createAuthentication(Users user, ApiClient client) {
        UserPrincipal principal = new UserPrincipal(
                user,
                null,
                client.getClientId(),
                client.getClientName());

        return new UsernamePasswordAuthenticationToken(
                principal,
                null,
                principal.getAuthorities());
    }
}
