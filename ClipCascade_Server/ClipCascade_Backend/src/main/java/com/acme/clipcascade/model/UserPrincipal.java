package com.acme.clipcascade.model;

import java.io.Serial;
import java.util.Collection;
import java.util.Collections;
import java.util.Set;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import com.acme.clipcascade.constants.RoleConstants;
import com.acme.clipcascade.service.BruteForceProtectionService;
import com.acme.clipcascade.service.ApiClientService;

public class UserPrincipal implements UserDetails {

    @Serial
    private static final long serialVersionUID = 1L;

    private Users user;

    private final transient BruteForceProtectionService bruteForceProtectionService;
    private final String clientId;
    private final String clientName;
    private final Set<String> clientScopes;

    public UserPrincipal(
            Users user,
            BruteForceProtectionService bruteForceProtectionService) {

        this(user, bruteForceProtectionService, null, null);
    }

    public UserPrincipal(
            Users user,
            BruteForceProtectionService bruteForceProtectionService,
            String clientId,
            String clientName) {

        this(user, bruteForceProtectionService, clientId, clientName, Collections.emptySet());
    }

    public UserPrincipal(
            Users user,
            BruteForceProtectionService bruteForceProtectionService,
            String clientId,
            String clientName,
            Collection<String> clientScopes) {

        this.user = user;
        this.bruteForceProtectionService = bruteForceProtectionService;
        this.clientId = clientId;
        this.clientName = clientName;
        this.clientScopes = Set.copyOf(clientScopes == null
                ? Collections.emptySet()
                : clientScopes);
    }

    @Override
    public boolean isAccountNonLocked() {

        if (bruteForceProtectionService == null) {
            return true;
        }

        // validate attempt using brute force protection
        return bruteForceProtectionService.recordAndValidateAttempt(user.getUsername());
    }

    @Override
    public boolean isEnabled() {
        return user.getEnabled();
    }

    @Override
    public String getPassword() {
        return user.getPassword();
    }

    @Override
    public String getUsername() {
        return user.getUsername();
    }

    public String getClientId() {
        return clientId;
    }

    public String getClientName() {
        return clientName;
    }

    public Set<String> getClientScopes() {
        if (clientId == null && clientScopes.isEmpty()) {
            return Collections.emptySet();
        }
        if (clientScopes.isEmpty()) {
            return ApiClientService.scopesFromString(null);
        }
        return clientScopes;
    }

    public static UserPrincipal fromAuthenticationPrincipal(Object principal) {
        if (principal instanceof UserPrincipal userPrincipal) {
            return userPrincipal;
        }
        if (principal instanceof UsernamePasswordAuthenticationToken authentication
                && authentication.getPrincipal() instanceof UserPrincipal userPrincipal) {
            return userPrincipal;
        }
        return null;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        // Return a collection of roles
        return Collections.singleton(new SimpleGrantedAuthority(user.getRole()));
    }

    public boolean isAdmin() {
        return this.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority()
                        .strip()
                        .equalsIgnoreCase(RoleConstants.ADMIN));
    }

    public boolean isUser() {
        return this.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority()
                        .strip()
                        .equalsIgnoreCase(RoleConstants.USER));
    }
}
