package com.gongmae.backend.analysis;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

/**
 * 분석 결과. 설계 문서 §9·§10.1
 *
 * <p>24시간 캐시가 여기에 걸린다. 같은 {@code targetKey} 와 {@code analysisVersion} 에 대해
 * {@code expiresAt} 이 아직 지나지 않은 결과가 있으면 다른 사용자가 분석을 눌러도 이 결과를 돌려준다.
 * 만료 뒤에 누르면 수집부터 다시 시작한다.
 *
 * <p>본문은 JSON 문자열로 둔다. H2·PostgreSQL 어느 쪽에서도 같은 방식으로 저장된다.
 */
@Entity
@Table(name = "analysis_result", indexes = {
		@Index(name = "idx_result_cache", columnList = "target_key, analysis_version, expires_at"),
})
public class AnalysisResultEntity {

	/** analysisId 와 동일하게 둔다 */
	@Id
	private UUID id;

	@Column(name = "target_key", nullable = false, length = 100)
	private String targetKey;

	@Column(name = "document_id")
	private UUID documentId;

	@Column(name = "analysis_version", nullable = false, length = 20)
	private String analysisVersion;

	/** 종합 위험 수준 — LOW / MEDIUM / HIGH / UNKNOWN */
	@Column(name = "risk_level", nullable = false, length = 20)
	private String riskLevel;

	/** 한 줄 요약 */
	@Column(name = "headline", length = 500)
	private String headline;

	/** 결과 본문 JSON (권리 목록, 말소기준권리, 인수·소멸, 판단 보류, 근거) */
	@Lob
	@Column(nullable = false)
	private String payloadJson;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	/** 이 시각이 지나면 캐시로 쓰지 않는다 */
	@Column(name = "expires_at", nullable = false)
	private Instant expiresAt;

	protected AnalysisResultEntity() {
		// JPA
	}

	public AnalysisResultEntity(UUID analysisId, String targetKey, UUID documentId, String analysisVersion,
			String riskLevel, String headline, String payloadJson, Instant expiresAt) {
		this.id = analysisId;
		this.targetKey = targetKey;
		this.documentId = documentId;
		this.analysisVersion = analysisVersion;
		this.riskLevel = riskLevel;
		this.headline = headline;
		this.payloadJson = payloadJson;
		this.createdAt = Instant.now();
		this.expiresAt = expiresAt;
	}

	public boolean isFresh(Instant now) {
		return expiresAt.isAfter(now);
	}

	public UUID getId() {
		return id;
	}

	public String getTargetKey() {
		return targetKey;
	}

	public UUID getDocumentId() {
		return documentId;
	}

	public String getAnalysisVersion() {
		return analysisVersion;
	}

	public String getRiskLevel() {
		return riskLevel;
	}

	public String getHeadline() {
		return headline;
	}

	public String getPayloadJson() {
		return payloadJson;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}
}
