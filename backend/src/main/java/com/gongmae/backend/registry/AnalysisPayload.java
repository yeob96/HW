package com.gongmae.backend.registry;

import java.time.LocalDate;
import java.util.List;

/**
 * 분석 결과 본문. 설계 문서 §9의 항목 구성을 따른다.
 *
 * <p>모든 판단에는 근거({@code reason})가 붙는다. 근거를 댈 수 없는 항목은
 * 확정하지 않고 {@link Verdict#판단보류} 로 내려간다(§9 말미).
 */
public record AnalysisPayload(
		String propertyDescription,
		DocumentInfo document,
		BaseRight baseRight,
		List<RightVerdict> rights,
		TenancyReview tenancy,
		Assumed assumed,
		List<String> openQuestions,
		List<String> warnings,
		String disclaimer) {

	public enum Verdict {
		/** 말소기준권리보다 후순위 — 매각으로 소멸 */
		소멸,
		/** 낙찰자가 떠안을 가능성 */
		인수,
		/** 자료 부족·신뢰도 부족으로 확정 불가 */
		판단보류,
		/** 권리 인수·소멸 판단 대상이 아님 (소유권 연혁 등) */
		해당없음
	}

	public record DocumentInfo(
			String originalFilename,
			Integer pageCount,
			boolean textExtracted,
			String parseVersion,
			int rightCount) {
	}

	/** 말소기준권리. 특정하지 못하면 {@code found=false} */
	public record BaseRight(
			boolean found,
			String rankNo,
			String section,
			String kind,
			LocalDate receivedOn,
			String reason) {
	}

	public record RightVerdict(
			String rankNo,
			String section,
			String kind,
			String purpose,
			LocalDate receivedOn,
			String holder,
			Long amount,
			boolean cancelled,
			double confidence,
			Verdict verdict,
			String reason) {
	}

	/** 임차인 검토. 등기부만으로는 끝낼 수 없는 영역이다(§6.4) */
	public record TenancyReview(
			Verdict verdict,
			List<String> registeredLeases,
			String reason,
			List<String> requiredDocuments) {
	}

	/** 인수 예상 부담 */
	public record Assumed(
			long knownAmount,
			boolean hasUnknownAmount,
			int assumedRightCount,
			String note) {
	}
}
