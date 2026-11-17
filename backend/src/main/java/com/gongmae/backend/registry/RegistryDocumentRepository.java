package com.gongmae.backend.registry;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RegistryDocumentRepository extends JpaRepository<RegistryDocument, UUID> {

	/** 같은 등본을 다시 올렸는지 — 원문 해시로 판별한다 */
	Optional<RegistryDocument> findByContentHash(String contentHash);
}
