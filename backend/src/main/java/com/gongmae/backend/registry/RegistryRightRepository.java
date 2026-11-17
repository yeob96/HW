package com.gongmae.backend.registry;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RegistryRightRepository extends JpaRepository<RegistryRight, UUID> {

	List<RegistryRight> findByDocumentIdOrderByOrderIndexAsc(UUID documentId);

	void deleteByDocumentId(UUID documentId);
}
