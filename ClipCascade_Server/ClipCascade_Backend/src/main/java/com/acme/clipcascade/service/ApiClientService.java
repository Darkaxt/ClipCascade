package com.acme.clipcascade.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.acme.clipcascade.model.ApiClient;
import com.acme.clipcascade.model.Users;
import com.acme.clipcascade.repo.ApiClientRepo;
import com.acme.clipcascade.repo.UserRepo;

import jakarta.transaction.Transactional;

@Service
public class ApiClientService {

    public static final String API_KEY_HEADER = "X-ClipCascade-Api-Key";
    public static final String STOMP_API_KEY_HEADER = "x-clipcascade-api-key";

    private static final String API_KEY_PREFIX = "cck_";
    private static final int API_KEY_RANDOM_BYTES = 32;
    private static final int MAX_CLIENT_NAME_LENGTH = 100;

    private final ApiClientRepo apiClientRepo;
    private final UserRepo userRepo;
    private final SecureRandom secureRandom;

    @Autowired
    public ApiClientService(ApiClientRepo apiClientRepo, UserRepo userRepo) {
        this(apiClientRepo, userRepo, new SecureRandom());
    }

    ApiClientService(ApiClientRepo apiClientRepo, UserRepo userRepo, SecureRandom secureRandom) {
        this.apiClientRepo = apiClientRepo;
        this.userRepo = userRepo;
        this.secureRandom = secureRandom;
    }

    @Transactional
    public CreatedApiClient createClientKey(String username, String clientName) {
        Users user = userRepo.findById(username)
                .filter(Users::getEnabled)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or disabled user"));
        String apiKey = generateApiKey();
        long now = System.currentTimeMillis();
        ApiClient client = new ApiClient(
                UUID.randomUUID().toString(),
                user.getUsername(),
                cleanClientName(clientName),
                sha256Hex(apiKey),
                now,
                0,
                true);

        return new CreatedApiClient(apiClientRepo.save(client), apiKey);
    }

    @Transactional
    public Optional<AuthenticatedApiClient> authenticate(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) {
            return Optional.empty();
        }

        return apiClientRepo.findByKeyHash(sha256Hex(apiKey.trim()))
                .filter(ApiClient::getEnabled)
                .flatMap(client -> userRepo.findById(client.getUsername())
                        .filter(Users::getEnabled)
                        .map(user -> {
                            client.setLastUsedAt(System.currentTimeMillis());
                            apiClientRepo.save(client);
                            return new AuthenticatedApiClient(client, user);
                        }));
    }

    public List<ApiClient> listClients(String username) {
        return apiClientRepo.findByUsernameOrderByCreatedAtDesc(username);
    }

    @Transactional
    public boolean revokeClient(String username, String clientId) {
        return apiClientRepo.findById(clientId)
                .filter(client -> client.getUsername().equals(username))
                .map(client -> {
                    client.setEnabled(false);
                    apiClientRepo.save(client);
                    return true;
                })
                .orElse(false);
    }

    public String extractApiKey(String apiKeyHeader, String authorizationHeader) {
        if (apiKeyHeader != null && !apiKeyHeader.isBlank()) {
            return apiKeyHeader.trim();
        }
        if (authorizationHeader != null && authorizationHeader.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return authorizationHeader.substring(7).trim();
        }
        return null;
    }

    private String generateApiKey() {
        byte[] bytes = new byte[API_KEY_RANDOM_BYTES];
        secureRandom.nextBytes(bytes);
        return API_KEY_PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String cleanClientName(String clientName) {
        String cleaned = clientName == null ? "" : clientName.trim();
        if (cleaned.isBlank()) {
            cleaned = "ClipCascade client";
        }
        if (cleaned.length() > MAX_CLIENT_NAME_LENGTH) {
            return cleaned.substring(0, MAX_CLIENT_NAME_LENGTH);
        }
        return cleaned;
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    public record CreatedApiClient(ApiClient client, String apiKey) {
    }

    public record AuthenticatedApiClient(ApiClient client, Users user) {
    }
}
