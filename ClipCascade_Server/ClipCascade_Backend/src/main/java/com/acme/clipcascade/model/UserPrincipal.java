package com.acme.clipcascade.model;

import java.io.Serial;
import java.util.Collection;
import java.util.Collections;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import com.acme.clipcascade.constants.RoleConstants;
import com.acme.clipcascade.service.BruteForceProtectionService;

public class UserPrincipal implements UserDetails {

    @Serial
    private static final long serialVersionUID = 1L;

    private Users user;

    private final transient BruteForceProtectionService bruteForceProtectionService;
    private final String clientId;
    private final String clientName;

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

        this.user = user;
        this.bruteForceProtectionService = bruteForceProtectionService;
        this.clientId = clientId;
        this.clientName = clientName;
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
