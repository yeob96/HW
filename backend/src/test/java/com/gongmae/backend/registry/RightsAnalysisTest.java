package com.gongmae.backend.registry;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.gongmae.backend.registry.AnalysisPayload.RightVerdict;
import com.gongmae.backend.registry.AnalysisPayload.Verdict;

/**
 * 파서 + 규칙 엔진을 실제 등본과 같은 레이아웃의 텍스트로 검증한다.
 *
 * <p>핵심은 말소기준권리를 "가장 빠른 권리"가 아니라
 * "말소기준이 될 수 있는 권리 중 가장 빠른 것"으로 고르는지다.
 * 아래 표본에서 가장 빠른 등기는 2015년 소유권보존이지만, 말소기준권리는 2019년 근저당권이어야 한다.
 */
class RightsAnalysisTest {

	private final RegistryParser parser = new RegistryParser();
	private final RightsAnalyzer analyzer = new RightsAnalyzer();

	/** 한 행의 칸들이 한 줄로 이어져 나오는, 실제 PDF 추출과 같은 모양 */
	private static final String SAMPLE = """
			【 표 제 부 】 ( 1동의 건물의 표시 )
			서울특별시 강남구 역삼동 123-45 래미안아파트 제101동 제12층 제1201호
			【 갑    구 】 ( 소유권에 관한 사항 )
			순위번호 등 기 목 적 접 수 등 기 원 인 권리자 및 기타사항
			1 소유권보존 2015년3월2일 제12345호 소유자 홍길동 서울특별시 강남구
			2 소유권이전 2018년5월7일 제23456호 매매 소유자 김철수 서울특별시 서초구
			3 가압류 2022년8월1일 제34567호 청구금액 금50,000,000원 채권자 주식회사 한빛
			4 임의경매개시결정 2024년2월3일 제45678호 채권자 우리은행
			【 을    구 】 ( 소유권 이외의 권리에 관한 사항 )
			순위번호 등 기 목 적 접 수 등 기 원 인 권리자 및 기타사항
			1 전세권설정 2017년1월5일 제20001호 전세금 금150,000,000원 전세권자 박영희
			2 근저당권설정 2019년6월10일 제30001호 채권최고액 금240,000,000원 근저당권자 국민은행
			3 근저당권설정 2023년3월9일 제40001호 채권최고액 금100,000,000원 근저당권자 하나캐피탈
			""";

	private AnalysisPayload analyze(String text) {
		UUID documentId = UUID.randomUUID();
		RegistryParser.ParseResult parsed = parser.parse(documentId, text);
		AnalysisPayload.DocumentInfo info = new AnalysisPayload.DocumentInfo("sample.pdf", 2, true,
				RegistryParser.PARSE_VERSION, parsed.rights().size());
		return analyzer.analyze(parsed.rights(), parsed.propertyDescription(), parsed.warnings(), info).payload();
	}

	private RightVerdict find(AnalysisPayload payload, String section, String rankNo) {
		return payload.rights().stream()
				.filter(r -> r.section().equals(section) && r.rankNo().equals(rankNo))
				.findFirst()
				.orElseThrow(() -> new AssertionError("%s %s번 권리를 찾지 못했습니다".formatted(section, rankNo)));
	}

	@Test
	@DisplayName("표제부에서 부동산 표시를 읽는다")
	void readsPropertyDescription() {
		AnalysisPayload payload = analyze(SAMPLE);
		assertThat(payload.propertyDescription()).contains("강남구 역삼동");
	}

	@Test
	@DisplayName("갑구·을구의 등기 항목을 빠짐없이 뽑는다 (표 머리글은 제외)")
	void parsesAllEntries() {
		AnalysisPayload payload = analyze(SAMPLE);
		assertThat(payload.rights()).hasSize(7);
		assertThat(payload.document().rightCount()).isEqualTo(7);
	}

	@Test
	@DisplayName("말소기준권리는 가장 빠른 등기가 아니라 말소기준 후보 중 가장 빠른 것이다")
	void picksEarliestBaseCandidateNotEarliestEntry() {
		AnalysisPayload payload = analyze(SAMPLE);

		assertThat(payload.baseRight().found()).isTrue();
		// 2015년 소유권보존이 더 빠르지만 말소기준권리가 될 수 없다
		assertThat(payload.baseRight().receivedOn()).isEqualTo(LocalDate.of(2019, 6, 10));
		assertThat(payload.baseRight().section()).isEqualTo("을구");
		assertThat(payload.baseRight().rankNo()).isEqualTo("2");
		assertThat(payload.baseRight().kind()).isEqualTo("근저당권");
	}

	@Test
	@DisplayName("선순위 전세권은 인수, 후순위 권리는 소멸로 판정한다")
	void judgesSeniorityAgainstBaseRight() {
		AnalysisPayload payload = analyze(SAMPLE);

		// 2017년 전세권 — 말소기준권리(2019)보다 선순위라 인수
		assertThat(find(payload, "을구", "1").verdict()).isEqualTo(Verdict.인수);
		// 말소기준권리 자신도 소멸
		assertThat(find(payload, "을구", "2").verdict()).isEqualTo(Verdict.소멸);
		// 후순위 근저당·가압류·경매개시결정은 소멸
		assertThat(find(payload, "을구", "3").verdict()).isEqualTo(Verdict.소멸);
		assertThat(find(payload, "갑구", "3").verdict()).isEqualTo(Verdict.소멸);
		assertThat(find(payload, "갑구", "4").verdict()).isEqualTo(Verdict.소멸);
		// 소유권 연혁은 인수·소멸 대상이 아니다
		assertThat(find(payload, "갑구", "1").verdict()).isEqualTo(Verdict.해당없음);
		assertThat(find(payload, "갑구", "2").verdict()).isEqualTo(Verdict.해당없음);
	}

	@Test
	@DisplayName("금액과 권리자를 읽어 인수 부담을 합산한다")
	void extractsAmountsAndSumsAssumedBurden() {
		AnalysisPayload payload = analyze(SAMPLE);

		RightVerdict jeonse = find(payload, "을구", "1");
		assertThat(jeonse.amount()).isEqualTo(150_000_000L);
		assertThat(jeonse.holder()).contains("박영희");

		assertThat(find(payload, "을구", "2").amount()).isEqualTo(240_000_000L);
		assertThat(find(payload, "갑구", "3").amount()).isEqualTo(50_000_000L);

		// 인수 대상은 전세권 하나뿐이다
		assertThat(payload.assumed().assumedRightCount()).isEqualTo(1);
		assertThat(payload.assumed().knownAmount()).isEqualTo(150_000_000L);
		assertThat(payload.assumed().hasUnknownAmount()).isFalse();
	}

	@Test
	@DisplayName("임차인 판단은 등기부만으로 확정하지 않는다")
	void neverConcludesTenancyFromRegistryAlone() {
		AnalysisPayload payload = analyze(SAMPLE);

		assertThat(payload.tenancy().verdict()).isEqualTo(Verdict.판단보류);
		assertThat(payload.tenancy().registeredLeases()).hasSize(1); // 전세권
		assertThat(payload.tenancy().requiredDocuments()).isNotEmpty();
	}

	@Test
	@DisplayName("말소된 등기는 선후관계 판단에서 빼고, 이유를 남긴다")
	void excludesCancelledEntries() {
		String withCancellation = SAMPLE + "4 3번근저당권설정등기말소 2024년5월1일 제50001호 해지\n";
		AnalysisPayload payload = analyze(withCancellation);

		RightVerdict cancelled = find(payload, "을구", "3");
		assertThat(cancelled.cancelled()).isTrue();
		assertThat(cancelled.verdict()).isEqualTo(Verdict.해당없음);
		assertThat(cancelled.reason()).contains("말소");
	}

	@Test
	@DisplayName("말소기준권리를 못 찾으면 확정하지 않고 보류한다")
	void holdsJudgementWhenNoBaseRight() {
		String onlyOwnership = """
				【 표 제 부 】 ( 건물의 표시 )
				서울특별시 마포구 합정동 10-1
				【 갑    구 】 ( 소유권에 관한 사항 )
				1 소유권보존 2015년3월2일 제12345호 소유자 홍길동
				""";
		AnalysisPayload payload = analyze(onlyOwnership);

		assertThat(payload.baseRight().found()).isFalse();
		assertThat(payload.openQuestions()).anyMatch(q -> q.contains("말소기준권리를 특정하지 못했습니다"));
	}

	@Test
	@DisplayName("등기 항목을 못 찾으면 경고를 남긴다")
	void warnsWhenNothingParsed() {
		List<String> warnings = parser.parse(UUID.randomUUID(), "내용 없음").warnings();
		assertThat(warnings).anyMatch(w -> w.contains("등기 항목을 하나도 찾지 못했습니다"));
	}
}
