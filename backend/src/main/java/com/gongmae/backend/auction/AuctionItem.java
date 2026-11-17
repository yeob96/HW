package com.gongmae.backend.auction;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * 온비드 공매 물건. 부동산 물건목록 API 응답에서 알림·검색에 쓰는 항목만 추렸다.
 *
 * <p>{@code onbidCltrno}(온비드 물건번호)를 그대로 PK 로 쓴다. 수집 때마다 같은 물건이 다시 오므로
 * 이 값으로 upsert 한다. {@code firstSeenAt} 이 "우리가 처음 본 시각"이고, 알림의 기준이 된다.
 */
@Entity
@Table(name = "auction_item", indexes = {
		@Index(name = "idx_item_first_seen", columnList = "first_seen_at"),
		@Index(name = "idx_item_region", columnList = "sd_nm, sgg_nm"),
		@Index(name = "idx_item_usage", columnList = "usg_mcls_id"),
})
public class AuctionItem {

	@Id
	@Column(name = "onbid_cltrno")
	private Long onbidCltrno;

	/** 물건관리번호 — 상세·입찰정보 API 의 키 */
	@Column(name = "cltr_mng_no", length = 40)
	private String cltrMngNo;

	@Column(name = "pbct_cdtn_no", length = 40)
	private String pbctCdtnNo;

	@Column(name = "cltr_nm", length = 500)
	private String cltrNm;

	/** 재산유형 (0007 압류재산 등) */
	@Column(name = "prpt_div_cd", length = 10)
	private String prptDivCd;

	@Column(name = "prpt_div_nm", length = 40)
	private String prptDivNm;

	/** 처분방식 (0001 매각 등) */
	@Column(name = "dsps_mthod_cd", length = 10)
	private String dspsMthodCd;

	@Column(name = "dsps_mthod_nm", length = 40)
	private String dspsMthodNm;

	/** 용도 중분류 ID (10200 주거용건물 등) — 관심조건 매칭의 기준 */
	@Column(name = "usg_mcls_id", length = 10)
	private String usgMclsId;

	@Column(name = "usg_mcls_nm", length = 60)
	private String usgMclsNm;

	@Column(name = "usg_scls_nm", length = 60)
	private String usgSclsNm;

	@Column(name = "sd_nm", length = 40)
	private String sdNm;

	@Column(name = "sgg_nm", length = 40)
	private String sggNm;

	@Column(name = "emd_nm", length = 40)
	private String emdNm;

	/** 필지 PNU. 앞 10자리가 법정동코드다 */
	@Column(name = "ltno_pnu", length = 40)
	private String ltnoPnu;

	/** 감정평가금액(원) */
	@Column(name = "apsl_evl_amt")
	private Long apslEvlAmt;

	/** 최저입찰가(원) */
	@Column(name = "lowst_bid_prc")
	private Long lowstBidPrc;

	/** 감정가 대비 최저가율(%). 낮을수록 싸다 */
	@Column(name = "lowst_ratio")
	private Double lowstRatio;

	/** 유찰 횟수 */
	@Column(name = "usbd_nft")
	private Integer usbdNft;

	@Column(name = "pbct_stat_cd", length = 10)
	private String pbctStatCd;

	@Column(name = "pbct_stat_nm", length = 40)
	private String pbctStatNm;

	/** 입찰 시작·마감 일시 (yyyyMMddHHmm, KST) */
	@Column(name = "bid_bgng_dt", length = 14)
	private String bidBgngDt;

	@Column(name = "bid_end_dt", length = 14)
	private String bidEndDt;

	/** 온비드 기준 최종수정일시 — 증분 수집의 기준 */
	@Column(name = "mdfcn_dt", length = 14)
	private String mdfcnDt;

	/** 우리가 이 물건을 처음 본 시각. 알림은 이 값을 기준으로 보낸다 */
	@Column(name = "first_seen_at", nullable = false)
	private Instant firstSeenAt;

	@Column(name = "last_seen_at", nullable = false)
	private Instant lastSeenAt;

	/** 신규 알림을 이미 내보냈는지 — 중복 발송을 막는다 */
	@Column(name = "alerted", nullable = false)
	private boolean alerted;

	protected AuctionItem() {
		// JPA
	}

	public AuctionItem(Long onbidCltrno) {
		this.onbidCltrno = onbidCltrno;
		this.firstSeenAt = Instant.now();
		this.lastSeenAt = this.firstSeenAt;
		this.alerted = false;
	}

	/** 수집한 값으로 갱신한다. 처음 본 시각과 알림 여부는 건드리지 않는다 */
	public void apply(OnbidListItem source) {
		this.cltrMngNo = source.cltrMngNo();
		this.pbctCdtnNo = source.pbctCdtnNo();
		this.cltrNm = source.cltrNm();
		this.prptDivCd = source.prptDivCd();
		this.prptDivNm = source.prptDivNm();
		this.dspsMthodCd = source.dspsMthodCd();
		this.dspsMthodNm = source.dspsMthodNm();
		this.usgMclsId = source.usgMclsId();
		this.usgMclsNm = source.usgMclsNm();
		this.usgSclsNm = source.usgSclsNm();
		this.sdNm = source.sdNm();
		this.sggNm = source.sggNm();
		this.emdNm = source.emdNm();
		this.ltnoPnu = source.ltnoPnu();
		this.apslEvlAmt = source.apslEvlAmt();
		this.lowstBidPrc = source.lowstBidPrc();
		this.lowstRatio = (source.apslEvlAmt() != null && source.apslEvlAmt() > 0 && source.lowstBidPrc() != null)
				? Math.round(source.lowstBidPrc() * 1000.0 / source.apslEvlAmt()) / 10.0
				: null;
		this.usbdNft = source.usbdNft();
		this.pbctStatCd = source.pbctStatCd();
		this.pbctStatNm = source.pbctStatNm();
		this.bidBgngDt = source.bidBgngDt();
		this.bidEndDt = source.bidEndDt();
		this.mdfcnDt = source.mdfcnDt();
		this.lastSeenAt = Instant.now();
	}

	public void markAlerted() {
		this.alerted = true;
	}

	public Long getOnbidCltrno() {
		return onbidCltrno;
	}

	public String getCltrMngNo() {
		return cltrMngNo;
	}

	public String getPbctCdtnNo() {
		return pbctCdtnNo;
	}

	public String getCltrNm() {
		return cltrNm;
	}

	public String getPrptDivCd() {
		return prptDivCd;
	}

	public String getPrptDivNm() {
		return prptDivNm;
	}

	public String getDspsMthodNm() {
		return dspsMthodNm;
	}

	public String getUsgMclsId() {
		return usgMclsId;
	}

	public String getUsgMclsNm() {
		return usgMclsNm;
	}

	public String getUsgSclsNm() {
		return usgSclsNm;
	}

	public String getSdNm() {
		return sdNm;
	}

	public String getSggNm() {
		return sggNm;
	}

	public String getEmdNm() {
		return emdNm;
	}

	public String getLtnoPnu() {
		return ltnoPnu;
	}

	public Long getApslEvlAmt() {
		return apslEvlAmt;
	}

	public Long getLowstBidPrc() {
		return lowstBidPrc;
	}

	public Double getLowstRatio() {
		return lowstRatio;
	}

	public Integer getUsbdNft() {
		return usbdNft;
	}

	public String getPbctStatNm() {
		return pbctStatNm;
	}

	public String getBidEndDt() {
		return bidEndDt;
	}

	public String getMdfcnDt() {
		return mdfcnDt;
	}

	public Instant getFirstSeenAt() {
		return firstSeenAt;
	}

	public boolean isAlerted() {
		return alerted;
	}
}
