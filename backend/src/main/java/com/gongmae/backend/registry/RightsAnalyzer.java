package com.gongmae.backend.registry;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Component;

import com.gongmae.backend.registry.AnalysisPayload.Assumed;
import com.gongmae.backend.registry.AnalysisPayload.BaseRight;
import com.gongmae.backend.registry.AnalysisPayload.DocumentInfo;
import com.gongmae.backend.registry.AnalysisPayload.RightVerdict;
import com.gongmae.backend.registry.AnalysisPayload.TenancyReview;
import com.gongmae.backend.registry.AnalysisPayload.Verdict;

/**
 * 말소기준권리와 권리별 인수·소멸을 판정하는 규칙 엔진. 설계 문서 §6.3·§6.5
 *
 * <p>여기서 하는 일은 날짜·순위·권리종류 비교뿐이다. LLM 이 끼어들지 않는다.
 * 뒤에 LLM 설명 생성을 붙이더라도, 이 판정 결과를 근거 없이 뒤집지 못하게 한다(§6.5).
 *
 * <p>핵심 규칙: 말소기준권리는 "가장 먼저 접수된 권리"가 아니라
 * <b>말소기준이 될 수 있는 권리(근저당·저당·압류·가압류·담보가등기·경매개시결정) 중
 * 가장 먼저 접수된 것</b>이다. 날짜만 보고 정하지 않는다.
 */
@Component
public class RightsAnalyzer {

	/** 규칙 버전. 바뀌면 캐시된 결과를 재사용하지 않는다 */
	public static final String ANALYSIS_VERSION = "1.0";

	/** 이 값 미만이면 자동 확정하지 않고 판단 보류로 돌린다 */
	private static final double MIN_CONFIDENCE = 0.5;

	private static final String DISCLAIMER = """
			이 결과는 업로드된 등기부등본만을 근거로 한 기계적 권리분석이며, 법률적 확정 판단이나 투자 권유가 아닙니다. \
			임차인 대항력은 등기부만으로 확정할 수 없고, 유치권·법정지상권처럼 등기되지 않는 권리는 문서에 나타나지 않습니다. \
			입찰 전에 매각물건명세서·현황조사서·감정평가서를 직접 확인하고, 필요하면 전문가 상담을 받으세요.""";

	public record Analysis(AnalysisPayload payload, String riskLevel, String headline) {
	}

	public Analysis analyze(List<RegistryRight> rights, String propertyDescription, List<String> parseWarnings,
			DocumentInfo document) {
		List<String> warnings = new ArrayList<>(parseWarnings);

		List<RegistryRight> active = rights.stream().filter(r -> !r.isCancelled()).toList();

		RegistryRight base = active.stream()
				.filter(r -> r.getKind().isBaseCandidate())
				.filter(r -> r.getReceivedOn() != null)
				.filter(r -> r.getConfidence() >= MIN_CONFIDENCE)
				.min(Comparator.comparing(RegistryRight::getReceivedOn)
						.thenComparingInt(RegistryRight::getOrderIndex))
				.orElse(null);

		BaseRight baseRight = base == null
				? new BaseRight(false, null, null, null, null,
						"말소기준이 될 수 있는 권리(근저당권·저당권·압류·가압류·담보가등기·경매개시결정)를 찾지 못했습니다. "
								+ "등기부가 일부만 제출되었거나 해당 권리가 모두 말소된 상태일 수 있습니다.")
				: new BaseRight(true, base.getRankNo(), base.getSection().name(), base.getKind().label(),
						base.getReceivedOn(),
						"말소기준 후보 중 접수일이 가장 빠른 권리입니다. 이보다 늦게 접수된 권리는 원칙적으로 매각으로 소멸하고, "
								+ "앞선 권리는 낙찰자에게 인수될 수 있습니다.");

		List<RightVerdict> verdicts = new ArrayList<>();
		for (RegistryRight right : active) {
			verdicts.add(judge(right, base));
		}
		// 말소된 항목도 결과에 남겨 둔다 — 왜 제외했는지 보이게 하기 위해서다
		for (RegistryRight right : rights) {
			if (right.isCancelled()) {
				verdicts.add(new RightVerdict(right.getRankNo(), right.getSection().name(), right.getKind().label(),
						right.getPurpose(), right.getReceivedOn(), right.getHolder(), right.getAmount(), true,
						right.getConfidence(), Verdict.해당없음, "이미 말소된 등기입니다."));
			}
		}

		TenancyReview tenancy = reviewTenancy(active, base);
		Assumed assumed = summarizeAssumed(verdicts);
		List<String> openQuestions = openQuestions(verdicts, base, document);

		String riskLevel = riskLevel(verdicts, base);
		String headline = headline(riskLevel, baseRight, assumed, verdicts);

		AnalysisPayload payload = new AnalysisPayload(propertyDescription, document, baseRight, verdicts, tenancy,
				assumed, openQuestions, warnings, DISCLAIMER);
		return new Analysis(payload, riskLevel, headline);
	}

	private RightVerdict judge(RegistryRight right, RegistryRight base) {
		String rank = right.getRankNo();
		String section = right.getSection().name();
		String kind = right.getKind().label();

		Verdict verdict;
		String reason;

		if (right.getKind() == RightKind.소유권이전) {
			verdict = Verdict.해당없음;
			reason = "소유권 연혁입니다. 매각으로 낙찰자에게 소유권이 이전되므로 인수·소멸 판단 대상이 아닙니다.";
		} else if (right.getConfidence() < MIN_CONFIDENCE) {
			verdict = Verdict.판단보류;
			reason = "원문에서 핵심 항목을 충분히 읽지 못했습니다(신뢰도 %.2f). 원문 대조가 필요합니다.".formatted(right.getConfidence());
		} else if (right.getKind().alwaysSurvives()) {
			verdict = Verdict.인수;
			reason = "%s은(는) 순위와 무관하게 낙찰자에게 인수될 수 있는 권리입니다.".formatted(kind);
		} else if (base == null) {
			verdict = Verdict.판단보류;
			reason = "말소기준권리를 특정하지 못해 선후관계를 판단할 수 없습니다.";
		} else if (right.getReceivedOn() == null) {
			verdict = Verdict.판단보류;
			reason = "접수일을 읽지 못해 말소기준권리와의 선후를 비교할 수 없습니다.";
		} else if (right.getId().equals(base.getId())) {
			verdict = Verdict.소멸;
			reason = "이 등기가 말소기준권리입니다. 말소기준권리 자신도 매각으로 소멸합니다.";
		} else if (right.getReceivedOn().isAfter(base.getReceivedOn())
				|| (right.getReceivedOn().isEqual(base.getReceivedOn())
						&& right.getOrderIndex() > base.getOrderIndex())) {
			verdict = Verdict.소멸;
			reason = "말소기준권리(%s 접수)보다 후순위이므로 원칙적으로 매각으로 소멸합니다."
					.formatted(base.getReceivedOn());
		} else {
			verdict = Verdict.인수;
			reason = "말소기준권리(%s 접수)보다 선순위입니다. 낙찰자에게 인수될 수 있으므로 입찰가에 반영해야 합니다."
					.formatted(base.getReceivedOn());
		}

		return new RightVerdict(rank, section, kind, right.getPurpose(), right.getReceivedOn(), right.getHolder(),
				right.getAmount(), false, right.getConfidence(), verdict, reason);
	}

	/**
	 * 임차인 검토. 등기된 임차권·전세권은 보이지만, 대항력의 핵심인 전입신고일·확정일자·점유는
	 * 등기부에 나오지 않는다. 그래서 여기서 결론을 내지 않는다(§6.4).
	 */
	private TenancyReview reviewTenancy(List<RegistryRight> active, RegistryRight base) {
		List<String> registered = active.stream()
				.filter(r -> r.getKind() == RightKind.임차권 || r.getKind() == RightKind.전세권)
				.map(r -> "%s %s번 %s%s".formatted(r.getSection().name(), r.getRankNo(), r.getKind().label(),
						r.getReceivedOn() != null ? " (" + r.getReceivedOn() + " 접수)" : ""))
				.toList();

		String reason = registered.isEmpty()
				? "등기된 임차권·전세권은 없습니다. 다만 대항력 있는 임차인은 등기 없이도 존재할 수 있어, 등기부만으로는 없다고 단정할 수 없습니다."
				: "등기된 임차권·전세권이 %d건 있습니다. 말소기준권리와의 선후만으로 보증금 인수 여부를 확정할 수 없고, 배당요구 여부까지 확인해야 합니다."
						.formatted(registered.size());
		if (base == null) {
			reason += " 말소기준권리를 특정하지 못해 선후 비교 자체가 불가능합니다.";
		}

		return new TenancyReview(Verdict.판단보류, registered, reason,
				List.of("매각물건명세서 — 임차인 현황과 배당요구 여부",
						"현황조사서 — 점유자와 점유 관계",
						"전입세대 열람내역 — 전입신고일",
						"확정일자 부여현황 — 우선변제권 성립 여부"));
	}

	private Assumed summarizeAssumed(List<RightVerdict> verdicts) {
		List<RightVerdict> assumedRights = verdicts.stream().filter(v -> v.verdict() == Verdict.인수).toList();
		long known = assumedRights.stream().filter(v -> v.amount() != null).mapToLong(RightVerdict::amount).sum();
		boolean hasUnknown = assumedRights.stream().anyMatch(v -> v.amount() == null);

		String note;
		if (assumedRights.isEmpty()) {
			note = "현재 확인된 범위에서 인수 대상으로 판정된 권리는 없습니다. 다만 판단 보류 항목과 등기되지 않는 권리가 남아 있을 수 있습니다.";
		} else if (hasUnknown) {
			note = "인수 대상 권리 중 금액이 적히지 않은 항목이 있어 합계는 하한입니다. 실제 부담은 더 클 수 있습니다.";
		} else {
			note = "등기부에 적힌 금액의 합계입니다. 명도비·체납관리비·세금은 포함되어 있지 않습니다.";
		}
		return new Assumed(known, hasUnknown, assumedRights.size(), note);
	}

	private List<String> openQuestions(List<RightVerdict> verdicts, RegistryRight base, DocumentInfo document) {
		List<String> questions = new ArrayList<>();
		if (!document.textExtracted()) {
			questions.add("업로드한 PDF에서 텍스트를 추출하지 못했습니다(스캔본으로 보입니다). OCR 없이는 권리 항목을 읽을 수 없습니다.");
		}
		if (base == null) {
			questions.add("말소기준권리를 특정하지 못했습니다. 등기부 전부증명서(말소사항 포함)인지 확인하세요.");
		}
		long pending = verdicts.stream().filter(v -> v.verdict() == Verdict.판단보류).count();
		if (pending > 0) {
			questions.add("판단을 보류한 권리가 %d건 있습니다. 해당 항목은 원문에서 직접 확인하세요.".formatted(pending));
		}
		questions.add("유치권·법정지상권·분묘기지권은 등기되지 않아 이 분석에 나타나지 않습니다. 현장 확인이 필요합니다.");
		questions.add("체납관리비, 명도 난이도, 세금은 등기부로 알 수 없습니다. 별도로 확인하세요.");
		return questions;
	}

	private String riskLevel(List<RightVerdict> verdicts, RegistryRight base) {
		if (base == null) {
			return "UNKNOWN";
		}
		boolean hasAssumed = verdicts.stream().anyMatch(v -> v.verdict() == Verdict.인수);
		boolean hasPending = verdicts.stream().anyMatch(v -> v.verdict() == Verdict.판단보류);
		if (hasAssumed) {
			return "HIGH";
		}
		if (hasPending) {
			return "MEDIUM";
		}
		return "LOW";
	}

	private String headline(String riskLevel, BaseRight baseRight, Assumed assumed, List<RightVerdict> verdicts) {
		if ("UNKNOWN".equals(riskLevel)) {
			return "말소기준권리를 특정하지 못해 권리분석을 확정하지 못했습니다.";
		}
		long extinguished = verdicts.stream().filter(v -> v.verdict() == AnalysisPayload.Verdict.소멸).count();
		if (assumed.assumedRightCount() > 0) {
			return "인수 가능 권리 %d건이 확인됐습니다. 말소기준권리는 %s %s번(%s)입니다."
					.formatted(assumed.assumedRightCount(), baseRight.section(), baseRight.rankNo(), baseRight.kind());
		}
		return "인수 대상으로 판정된 권리는 없고 %d건이 소멸 대상입니다. 말소기준권리는 %s %s번(%s)입니다."
				.formatted(extinguished, baseRight.section(), baseRight.rankNo(), baseRight.kind());
	}
}
