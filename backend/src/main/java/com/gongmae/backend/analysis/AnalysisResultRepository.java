package com.gongmae.backend.analysis;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AnalysisResultRepository extends JpaRepository<AnalysisResultEntity, UUID> {

	/**
	 * 24시간 캐시 조회. 같은 물건·같은 분석버전이면서 아직 만료되지 않은 결과 중 가장 최근 것.
	 * 다른 사용자가 분석을 눌러도 이 결과가 돌아간다.
	 */
	Optional<AnalysisResultEntity> findFirstByTargetKeyAndAnalysisVersionAndExpiresAtAfterOrderByCreatedAtDesc(
			String targetKey, String analysisVersion, Instant now);
}
