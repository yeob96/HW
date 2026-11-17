package com.gongmae.backend.analysis;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AnalysisRequestRepository extends JpaRepository<AnalysisRequestEntity, UUID> {

	/** 같은 물건에 대해 아직 끝나지 않은 분석이 있는지 — 중복 실행 방지용 (§4.2) */
	List<AnalysisRequestEntity> findByTargetKeyAndStatusIn(String targetKey, List<AnalysisStatus> statuses);

	Optional<AnalysisRequestEntity> findFirstByTargetKeyOrderByRequestedAtDesc(String targetKey);
}
