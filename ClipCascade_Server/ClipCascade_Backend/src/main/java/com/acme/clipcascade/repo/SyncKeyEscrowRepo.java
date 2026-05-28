package com.acme.clipcascade.repo;

import org.springframework.data.jpa.repository.JpaRepository;

import com.acme.clipcascade.model.SyncKeyEscrow;

public interface SyncKeyEscrowRepo extends JpaRepository<SyncKeyEscrow, String> {
}
