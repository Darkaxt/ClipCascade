package com.acme.clipcascade.service;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import org.springframework.stereotype.Service;

import com.acme.clipcascade.model.SyncKeyEscrow;
import com.acme.clipcascade.repo.SyncKeyEscrowRepo;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.transaction.Transactional;

@Service
public class ClientEnrollmentService {

    public static final String WRAP_VERSION = "pbkdf2-sha256-aes-gcm-v1";

    private static final List<String> REQUIRED_WRAP_FIELDS = List.of(
            "version",
            "rounds",
            "salt",
            "nonce",
            "ciphertext",
            "tag");

    private final ApiClientService apiClientService;
    private final SyncKeyEscrowRepo syncKeyEscrowRepo;
    private final ObjectMapper objectMapper;

    public ClientEnrollmentService(
            ApiClientService apiClientService,
            SyncKeyEscrowRepo syncKeyEscrowRepo,
            ObjectMapper objectMapper) {

        this.apiClientService = apiClientService;
        this.syncKeyEscrowRepo = syncKeyEscrowRepo;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public EnrollmentResult enroll(
            String username,
            String passwordHash,
            String clientName,
            Map<String, ?> keyWrap) {

        apiClientService.validateUserPasswordHash(username, passwordHash);

        ApiClientService.CreatedApiClient created = apiClientService.createClientKey(
                username,
                clientName,
                List.of(ApiClientService.SCOPE_SYNC));

        return syncKeyEscrowRepo.findById(username)
                .map(existing -> new EnrollmentResult(created, readWrappedKey(existing.getWrappedKey()), "existing"))
                .orElseGet(() -> {
                    Map<String, String> normalizedWrap = normalizeWrappedKey(keyWrap);
                    long now = System.currentTimeMillis();
                    SyncKeyEscrow escrow = new SyncKeyEscrow(
                            username,
                            writeWrappedKey(normalizedWrap),
                            now,
                            now);
                    syncKeyEscrowRepo.save(escrow);
                    return new EnrollmentResult(created, normalizedWrap, "created");
                });
    }

    private Map<String, String> normalizeWrappedKey(Map<String, ?> rawWrap) {
        if (rawWrap == null || rawWrap.isEmpty()) {
            throw new IllegalArgumentException("Missing wrapped sync key");
        }

        Map<String, String> normalized = new TreeMap<>();
        for (Map.Entry<String, ?> entry : rawWrap.entrySet()) {
            if (entry.getKey() != null && entry.getValue() != null) {
                normalized.put(entry.getKey(), String.valueOf(entry.getValue()));
            }
        }

        for (String field : REQUIRED_WRAP_FIELDS) {
            String value = normalized.get(field);
            if (value == null || value.isBlank()) {
                throw new IllegalArgumentException("Invalid wrapped sync key");
            }
        }
        if (!WRAP_VERSION.equals(normalized.get("version"))) {
            throw new IllegalArgumentException("Unsupported wrapped sync key version");
        }
        if (!isInteger(normalized.get("rounds"))) {
            throw new IllegalArgumentException("Invalid wrapped sync key rounds");
        }

        return normalized;
    }

    private Map<String, String> readWrappedKey(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, String>>() {
            });
        } catch (Exception e) {
            throw new IllegalStateException("Stored sync key escrow is unreadable", e);
        }
    }

    private String writeWrappedKey(Map<String, String> keyWrap) {
        try {
            return objectMapper.writeValueAsString(keyWrap);
        } catch (Exception e) {
            throw new IllegalStateException("Wrapped sync key cannot be serialized", e);
        }
    }

    private boolean isInteger(String value) {
        try {
            Integer.parseInt(value);
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    public record EnrollmentResult(
            ApiClientService.CreatedApiClient created,
            Map<String, String> keyWrap,
            String syncKeyStatus) {
    }
}
