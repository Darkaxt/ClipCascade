package com.acme.ClipCascade;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;

import java.io.ByteArrayOutputStream;
import java.io.ObjectOutputStream;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextImpl;

import com.acme.clipcascade.config.ClipCascadeProperties;
import com.acme.clipcascade.constants.RoleConstants;
import com.acme.clipcascade.model.UserPrincipal;
import com.acme.clipcascade.model.Users;
import com.acme.clipcascade.service.BruteForceProtectionService;
import com.fasterxml.jackson.databind.ObjectMapper;

class SecurityContextSerializationTests {

    @Test
    void authenticatedSecurityContextCanBeSerializedForJdbcSessionStorage() {
        BruteForceProtectionService bruteForceProtectionService = new BruteForceProtectionService(
                null,
                mock(ClipCascadeProperties.class),
                new ObjectMapper());
        UserPrincipal principal = new UserPrincipal(
                new Users("admin", "encoded-password", RoleConstants.ADMIN, true),
                bruteForceProtectionService);
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                List.of(new SimpleGrantedAuthority(RoleConstants.ADMIN)));
        SecurityContextImpl securityContext = new SecurityContextImpl(authentication);

        assertThatCode(() -> serialize(securityContext)).doesNotThrowAnyException();
    }

    private static byte[] serialize(Object object) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ObjectOutputStream objectOutputStream = new ObjectOutputStream(out)) {
            objectOutputStream.writeObject(object);
        }
        return out.toByteArray();
    }
}
