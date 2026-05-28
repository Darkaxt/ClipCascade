package com.acme.ClipCascade;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import com.acme.clipcascade.config.HashConfig;
import com.acme.clipcascade.constants.RoleConstants;
import com.acme.clipcascade.model.ApiClient;
import com.acme.clipcascade.model.Users;
import com.acme.clipcascade.repo.ApiClientRepo;
import com.acme.clipcascade.repo.UserRepo;
import com.acme.clipcascade.service.ApiClientService;
import com.acme.clipcascade.utils.HashingUtility;

class ApiClientServiceTests {

    @Test
    void createClientKeyReturnsOneTimeTokenAndStoresOnlyHash() {
        ApiClientRepo apiClientRepo = mock(ApiClientRepo.class);
        UserRepo userRepo = mock(UserRepo.class);
        ApiClientService service = new ApiClientService(apiClientRepo, userRepo);
        Users admin = new Users("admin", "encoded-password", RoleConstants.ADMIN, true);
        when(userRepo.findById("admin")).thenReturn(Optional.of(admin));
        when(apiClientRepo.save(any(ApiClient.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ApiClientService.CreatedApiClient created = service.createClientKey("admin", "Windows laptop");

        assertThat(created.apiKey()).startsWith("cck_");
        assertThat(created.client().getClientId()).isNotBlank();
        assertThat(created.client().getClientName()).isEqualTo("Windows laptop");
        assertThat(created.client().getScopes()).isEqualTo("manage_keys,sync");
        assertThat(created.client().getKeyHash()).hasSize(64);
        assertThat(created.client().getKeyHash()).doesNotContain(created.apiKey());
        verify(apiClientRepo).save(created.client());
    }

    @Test
    void createClientKeyCanRestrictScopesForSyncOnlyDevices() {
        ApiClientRepo apiClientRepo = mock(ApiClientRepo.class);
        UserRepo userRepo = mock(UserRepo.class);
        ApiClientService service = new ApiClientService(apiClientRepo, userRepo);
        Users admin = new Users("admin", "encoded-password", RoleConstants.ADMIN, true);
        when(userRepo.findById("admin")).thenReturn(Optional.of(admin));
        when(apiClientRepo.save(any(ApiClient.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ApiClientService.CreatedApiClient created = service.createClientKey(
                "admin",
                "Android phone",
                Set.of(ApiClientService.SCOPE_SYNC));

        assertThat(created.client().getScopes()).isEqualTo("sync");
    }

    @Test
    void createManagementKeyValidatesPasswordHashAndStoresManageScopeOnly() throws Exception {
        ApiClientRepo apiClientRepo = mock(ApiClientRepo.class);
        UserRepo userRepo = mock(UserRepo.class);
        BCryptPasswordEncoder encoder = new HashConfig().passwordEncoder();
        ApiClientService service = new ApiClientService(apiClientRepo, userRepo, encoder);
        String passwordHash = sha3Hex("admin123");
        Users admin = new Users("admin", encoder.encode(passwordHash), RoleConstants.ADMIN, true);
        when(userRepo.findById("admin")).thenReturn(Optional.of(admin));
        when(apiClientRepo.save(any(ApiClient.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ApiClientService.CreatedApiClient created = service.createManagementKey(
                "admin",
                passwordHash,
                "Browser key manager");

        assertThat(created.apiKey()).startsWith("cck_");
        assertThat(created.client().getClientName()).isEqualTo("Browser key manager");
        assertThat(created.client().getScopes()).isEqualTo("manage_keys");
    }

    @Test
    void authenticateApiKeyReturnsTheEnabledClientAndOwningUser() {
        ApiClientRepo apiClientRepo = mock(ApiClientRepo.class);
        UserRepo userRepo = mock(UserRepo.class);
        ApiClientService service = new ApiClientService(apiClientRepo, userRepo);
        Users admin = new Users("admin", "encoded-password", RoleConstants.ADMIN, true);
        when(userRepo.findById("admin")).thenReturn(Optional.of(admin));
        when(apiClientRepo.save(any(ApiClient.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ApiClientService.CreatedApiClient created = service.createClientKey("admin", "Android phone");
        when(apiClientRepo.findByKeyHash(created.client().getKeyHash())).thenReturn(Optional.of(created.client()));

        Optional<ApiClientService.AuthenticatedApiClient> authenticated = service.authenticate(created.apiKey());

        assertThat(authenticated).isPresent();
        assertThat(authenticated.get().user()).isSameAs(admin);
        assertThat(authenticated.get().client().getClientId()).isEqualTo(created.client().getClientId());
        assertThat(authenticated.get().client().getClientName()).isEqualTo("Android phone");
        assertThat(authenticated.get().client().getLastUsedAt()).isGreaterThan(0);
    }

    private static String sha3Hex(String input) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA3-512");
        return HashingUtility.convertBytesToLowercaseHex(
                digest.digest(input.getBytes(StandardCharsets.UTF_8)));
    }
}
