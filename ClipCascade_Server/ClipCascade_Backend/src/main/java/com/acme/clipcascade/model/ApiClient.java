package com.acme.clipcascade.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;

@Entity
@Table(name = "api_clients")
public class ApiClient {

    @Id
    @Column(name = "client_id", nullable = false)
    private String clientId;

    @NotNull
    @Column(nullable = false)
    private String username;

    @NotNull
    @Column(name = "client_name", nullable = false)
    private String clientName;

    @NotNull
    @Column(name = "key_hash", nullable = false, unique = true)
    private String keyHash;

    @Column(name = "created_at", nullable = false)
    private long createdAt;

    @Column(name = "last_used_at", nullable = false)
    private long lastUsedAt;

    @Column(nullable = false)
    private boolean enabled;

    public ApiClient() {
        this.enabled = true;
    }

    public ApiClient(
            String clientId,
            String username,
            String clientName,
            String keyHash,
            long createdAt,
            long lastUsedAt,
            boolean enabled) {

        this.clientId = clientId;
        this.username = username;
        this.clientName = clientName;
        this.keyHash = keyHash;
        this.createdAt = createdAt;
        this.lastUsedAt = lastUsedAt;
        this.enabled = enabled;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getClientName() {
        return clientName;
    }

    public void setClientName(String clientName) {
        this.clientName = clientName;
    }

    public String getKeyHash() {
        return keyHash;
    }

    public void setKeyHash(String keyHash) {
        this.keyHash = keyHash;
    }

    public long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(long createdAt) {
        this.createdAt = createdAt;
    }

    public long getLastUsedAt() {
        return lastUsedAt;
    }

    public void setLastUsedAt(long lastUsedAt) {
        this.lastUsedAt = lastUsedAt;
    }

    public boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
}
