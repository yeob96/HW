package com.gongmae.backend.registry;

import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * 등기부등본에서 뽑아낸 권리 한 건. 갑구·을구의 각 등기 항목이 하나씩 대응된다.
 *
 * <p>문서에 적혀 있지 않은 값은 추정하지 않고 null 로 둔다. 설계 문서 §6.2
 * {@code confidence} 가 낮은 항목은 규칙 엔진이 자동 확정하지 않고 판단 보류로 넘긴다.
 *
 * <p>{@code holder}(권리자)는 개인정보가 포함될 수 있는 항목이다. 노출 범위를 따로 검토할 것.
 */
@Entity
@Table(name = "registry_right", indexes = @Index(name = "idx_right_document", columnList = "document_id"))
public class RegistryRight {

	@Id
	private UUID id;

	@Column(name = "document_id", nullable = false)
	private UUID documentId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private RegistrySection section;

	/** 문서상 등장 순서. 접수일이 같을 때 선후를 가리는 보조 기준 */
	@Column(name = "order_index", nullable = false)
	private int orderIndex;

	/** 순위번호. "1", "2-1" 처럼 가지번호가 붙을 수 있어 문자열로 둔다 */
	@Column(name = "rank_no", length = 20)
	private String rankNo;

	@Column(name = "received_on")
	private LocalDate receivedOn;

	@Column(name = "receipt_no", length = 60)
	private String receiptNo;

	/** 등기목적 원문 (예: "근저당권설정") */
	@Column(length = 200)
	private String purpose;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 30)
	private RightKind kind;

	/** 권리자·채권자 */
	@Column(length = 200)
	private String holder;

	/** 채권최고액 등 금액(원). 없으면 null */
	private Long amount;

	/** 말소선(취소선)이 그어진 항목인지 */
	@Column(nullable = false)
	private boolean cancelled;

	/** 원문 대조용. 어느 줄에서 뽑았는지 남긴다 */
	@Column(name = "source_text", length = 1000)
	private String sourceText;

	/** 0.0~1.0. 핵심 항목이 비어 있을수록 낮아진다 */
	@Column(nullable = false)
	private double confidence;

	protected RegistryRight() {
		// JPA
	}

	public RegistryRight(UUID documentId, RegistrySection section, int orderIndex, String rankNo, LocalDate receivedOn,
			String receiptNo, String purpose, RightKind kind, String holder, Long amount, boolean cancelled,
			String sourceText, double confidence) {
		this.id = UUID.randomUUID();
		this.documentId = documentId;
		this.section = section;
		this.orderIndex = orderIndex;
		this.rankNo = rankNo;
		this.receivedOn = receivedOn;
		this.receiptNo = receiptNo;
		this.purpose = purpose;
		this.kind = kind;
		this.holder = holder;
		this.amount = amount;
		this.cancelled = cancelled;
		this.sourceText = sourceText;
		this.confidence = confidence;
	}

	public UUID getId() {
		return id;
	}

	public UUID getDocumentId() {
		return documentId;
	}

	public RegistrySection getSection() {
		return section;
	}

	public int getOrderIndex() {
		return orderIndex;
	}

	public String getRankNo() {
		return rankNo;
	}

	public LocalDate getReceivedOn() {
		return receivedOn;
	}

	public String getReceiptNo() {
		return receiptNo;
	}

	public String getPurpose() {
		return purpose;
	}

	public RightKind getKind() {
		return kind;
	}

	public String getHolder() {
		return holder;
	}

	public Long getAmount() {
		return amount;
	}

	public boolean isCancelled() {
		return cancelled;
	}

	public String getSourceText() {
		return sourceText;
	}

	public double getConfidence() {
		return confidence;
	}
}
