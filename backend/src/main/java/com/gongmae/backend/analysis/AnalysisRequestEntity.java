package com.gongmae.backend.analysis;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * 분석 요청 1건의 실행 이력. 설계 문서 §4.2
 *
 * <p>{@code analysisId} 가 전체 처리 과정의 공통 추적 키다(§14.4).
 * 같은 물건에 대해 여러 번 분석할 수 있으므로 물건 식별자와 분리해서 관리한다.
 *
 * <p>동시 요청이 들어와도 한 건만 진행되도록 낙관적 잠금({@code @Version})을 걸어 두었다.
 * 조회 후 변경만으로는 막을 수 없다(§4.2).
 */
@Entity
@Table(name = "analysis_request", indexes = {
		@Index(name = "idx_analysis_target", columnList = "target_key"),
		@Index(name = "idx_analysis_status", columnList = "status"),
})
public class AnalysisRequestEntity {

	@Id
	private UUID id;

	/** 경매 물건 식별자. 24시간 캐시의 기준이 된다 */
	@Column(name = "target_key", nullable = false, length = 100)
	private String targetKey;

	@Column(name = "document_id")
	private UUID documentId;

	@Column(name = "requested_by", length = 100)
	private String requestedBy;

	@Column(name = "analysis_type", nullable = false, length = 40)
	private String analysisType;

	/** 규칙·프롬프트 버전. 버전이 다르면 캐시를 재사용하지 않는다 */
	@Column(name = "analysis_version", nullable = false, length = 20)
	private String analysisVersion;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private AnalysisStatus status;

	@Column(name = "requested_at", nullable = false)
	private Instant requestedAt;

	@Column(name = "started_at")
	private Instant startedAt;

	@Column(name = "completed_at")
	private Instant completedAt;

	@Column(name = "error_code", length = 60)
	private String errorCode;

	@Column(name = "error_summary", length = 1000)
	private String errorSummary;

	@Column(name = "retry_count", nullable = false)
	private int retryCount;

	@Version
	private long lockVersion;

	protected AnalysisRequestEntity() {
		// JPA
	}

	public AnalysisRequestEntity(String targetKey, UUID documentId, String requestedBy, String analysisType,
			String analysisVersion) {
		this.id = UUID.randomUUID();
		this.targetKey = targetKey;
		this.documentId = documentId;
		this.requestedBy = requestedBy;
		this.analysisType = analysisType;
		this.analysisVersion = analysisVersion;
		this.status = AnalysisStatus.READY;
		this.requestedAt = Instant.now();
		this.retryCount = 0;
	}

	public void markProcessing() {
		this.status = AnalysisStatus.PROCESSING;
		this.startedAt = Instant.now();
	}

	public void markCompleted() {
		this.status = AnalysisStatus.COMPLETED;
		this.completedAt = Instant.now();
		this.errorCode = null;
		this.errorSummary = null;
	}

	public void markFailed(String errorCode, String errorSummary) {
		this.status = AnalysisStatus.FAILED;
		this.completedAt = Instant.now();
		this.errorCode = errorCode;
		this.errorSummary = errorSummary != null && errorSummary.length() > 1000
				? errorSummary.substring(0, 1000)
				: errorSummary;
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

	public String getRequestedBy() {
		return requestedBy;
	}

	public String getAnalysisType() {
		return analysisType;
	}

	public String getAnalysisVersion() {
		return analysisVersion;
	}

	public AnalysisStatus getStatus() {
		return status;
	}

	public Instant getRequestedAt() {
		return requestedAt;
	}

	public Instant getStartedAt() {
		return startedAt;
	}

	public Instant getCompletedAt() {
		return completedAt;
	}

	public String getErrorCode() {
		return errorCode;
	}

	public String getErrorSummary() {
		return errorSummary;
	}

	public int getRetryCount() {
		return retryCount;
	}
}
