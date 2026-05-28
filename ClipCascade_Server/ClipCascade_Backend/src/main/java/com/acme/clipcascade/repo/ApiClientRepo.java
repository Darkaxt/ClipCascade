package com.acme.clipcascade.repo;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.acme.clipcascade.model.ApiClient;

public interface ApiClientRepo extends JpaRepository<ApiClient, String> {

    Optional<ApiClient> findByKeyHash(String keyHash);

    List<ApiClient> findByUsernameOrderByCreatedAtDesc(String username);
}
