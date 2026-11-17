package com.gongmae.backend.registry;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 업로드된 등기부등본 원본에 대한 기록.
 *
 * <p>원문 바이트는 DB가 아니라 {@code DocumentStorage} 에 두고 여기에는 참조만 남긴다.
 * {@code contentHash} 가 유일키라, 같은 등본을 여러 번 올려도 레코드는 하나다.
 * 설계 문서 §5 "수집 데이터 메타데이터"
 */
@Entity
@Table(name = "registry_document")
public class RegistryDocument {

	@Id
	private UUID id;

	/** 원문 바이트의 SHA-256. 같은 문서인지 판별하는 기준 */
	@Column(name = "content_hash", nullable = false, unique = true, length = 64)
	private String contentHash;

	@Column(name = "original_filename", length = 300)
	private String originalFilename;

	@Column(name = "byte_size", nullable = false)
	private long byteSize;

	/** DocumentStorage 안에서의 위치 (로컬 경로 또는 S3 키) */
	@Column(name = "storage_key", nullable = false, length = 500)
	private String storageKey;

	@Column(name = "page_count")
	private Integer pageCount;

	/** 파서 버전 — 파싱 규칙이 바뀌면 올린다. 결과 재현성을 위해 기록한다 */
	@Column(name = "parse_version", nullable = false, length = 20)
	private String parseVersion;

	/** 텍스트가 실제로 추출됐는지. false 면 스캔 PDF 라 OCR 이 필요하다 */
	@Column(name = "text_extracted", nullable = false)
	private boolean textExtracted;

	@Column(name = "uploaded_at", nullable = false)
	private Instant uploadedAt;

	@Column(name = "uploaded_by", length = 100)
	private String uploadedBy;

	protected RegistryDocument() {
		// JPA
	}

	public RegistryDocument(String contentHash, String originalFilename, long byteSize, String storageKey,
			Integer pageCount, String parseVersion, boolean textExtracted, String uploadedBy) {
		this.id = UUID.randomUUID();
		this.contentHash = contentHash;
		this.originalFilename = originalFilename;
		this.byteSize = byteSize;
		this.storageKey = storageKey;
		this.pageCount = pageCount;
		this.parseVersion = parseVersion;
		this.textExtracted = textExtracted;
		this.uploadedAt = Instant.now();
		this.uploadedBy = uploadedBy;
	}

	public UUID getId() {
		return id;
	}

	public String getContentHash() {
		return contentHash;
	}

	public String getOriginalFilename() {
		return originalFilename;
	}

	public long getByteSize() {
		return byteSize;
	}

	public String getStorageKey() {
		return storageKey;
	}

	public Integer getPageCount() {
		return pageCount;
	}

	public String getParseVersion() {
		return parseVersion;
	}

	public boolean isTextExtracted() {
		return textExtracted;
	}

	public Instant getUploadedAt() {
		return uploadedAt;
	}

	public String getUploadedBy() {
		return uploadedBy;
	}
}
