package com.gongmae.backend.alert;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * 사용자가 등록한 관심조건. 새 물건이 이 조건에 맞으면 알림이 간다.
 *
 * <p>비어 있는 항목은 "제한 없음"으로 본다. 조건을 하나도 넣지 않으면 모든 신규 물건에 알림이 가므로,
 * 등록할 때 최소 한 가지는 받도록 서비스에서 막는다.
 */
@Entity
@Table(name = "alert_subscription", indexes = @Index(name = "idx_sub_user", columnList = "user_id"))
public class AlertSubscription {

	@Id
	private UUID id;

	@Column(name = "user_id", nullable = false, length = 100)
	private String userId;

	/** 사용자가 붙인 이름 (예: "강남 아파트 5억 이하") */
	@Column(nullable = false, length = 100)
	private String name;

	@Column(nullable = false)
	private boolean enabled;

	@Column(name = "sd_nm", length = 40)
	private String sdNm;

	@Column(name = "sgg_nm", length = 40)
	private String sggNm;

	/** 용도 중분류 ID 목록 (쉼표 구분). 예: "10200,10300" */
	@Column(name = "usg_mcls_ids", length = 200)
	private String usgMclsIds;

	/** 재산유형 코드 목록 (쉼표 구분). 예: "0007" */
	@Column(name = "prpt_div_cds", length = 200)
	private String prptDivCds;

	/** 최저입찰가 범위(원) */
	@Column(name = "min_price")
	private Long minPrice;

	@Column(name = "max_price")
	private Long maxPrice;

	/** 감정가 대비 최저가율 상한(%). 70이면 "감정가의 70% 이하인 것만" */
	@Column(name = "max_lowst_ratio")
	private Double maxLowstRatio;

	/** 유찰 횟수 하한 */
	@Column(name = "min_usbd_nft")
	private Integer minUsbdNft;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected AlertSubscription() {
		// JPA
	}

	public AlertSubscription(String userId, String name) {
		this.id = UUID.randomUUID();
		this.userId = userId;
		this.name = name;
		this.enabled = true;
		this.createdAt = Instant.now();
	}

	public void update(String sdNm, String sggNm, String usgMclsIds, String prptDivCds, Long minPrice, Long maxPrice,
			Double maxLowstRatio, Integer minUsbdNft) {
		this.sdNm = blankToNull(sdNm);
		this.sggNm = blankToNull(sggNm);
		this.usgMclsIds = blankToNull(usgMclsIds);
		this.prptDivCds = blankToNull(prptDivCds);
		this.minPrice = minPrice;
		this.maxPrice = maxPrice;
		this.maxLowstRatio = maxLowstRatio;
		this.minUsbdNft = minUsbdNft;
	}

	public void rename(String name) {
		this.name = name;
	}

	public void setEnabled(boolean enabled) {
		this.enabled = enabled;
	}

	/** 조건이 하나라도 걸려 있는지 — 전부 비면 모든 물건에 알림이 가 버린다 */
	public boolean hasAnyCondition() {
		return sdNm != null || sggNm != null || usgMclsIds != null || prptDivCds != null || minPrice != null
				|| maxPrice != null || maxLowstRatio != null || minUsbdNft != null;
	}

	public List<String> usgMclsIdList() {
		return split(usgMclsIds);
	}

	public List<String> prptDivCdList() {
		return split(prptDivCds);
	}

	private static List<String> split(String csv) {
		if (csv == null || csv.isBlank()) {
			return List.of();
		}
		return Arrays.stream(csv.split(",")).map(String::strip).filter(s -> !s.isEmpty()).toList();
	}

	private static String blankToNull(String value) {
		return (value == null || value.isBlank()) ? null : value.strip();
	}

	public UUID getId() {
		return id;
	}

	public String getUserId() {
		return userId;
	}

	public String getName() {
		return name;
	}

	public boolean isEnabled() {
		return enabled;
	}

	public String getSdNm() {
		return sdNm;
	}

	public String getSggNm() {
		return sggNm;
	}

	public String getUsgMclsIds() {
		return usgMclsIds;
	}

	public String getPrptDivCds() {
		return prptDivCds;
	}

	public Long getMinPrice() {
		return minPrice;
	}

	public Long getMaxPrice() {
		return maxPrice;
	}

	public Double getMaxLowstRatio() {
		return maxLowstRatio;
	}

	public Integer getMinUsbdNft() {
		return minUsbdNft;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
