package com.gongmae.backend.registry;

/**
 * 등기 권리의 종류.
 *
 * <p>{@code baseCandidate} 는 말소기준권리가 될 수 있는 권리인지를 뜻한다.
 * 말소기준권리는 "가장 먼저 접수된 권리"가 아니라 "말소기준이 될 수 있는 권리 중 가장 먼저 접수된 것"이므로,
 * 날짜 비교 전에 이 구분이 먼저 적용되어야 한다. 설계 문서 §6.3
 *
 * <p>{@code alwaysSurvives} 는 순위와 무관하게 낙찰자에게 인수될 수 있는 권리다.
 */
public enum RightKind {
	근저당권("근저당권", true, false),
	저당권("저당권", true, false),
	압류("압류", true, false),
	가압류("가압류", true, false),
	담보가등기("담보가등기", true, false),
	경매개시결정("경매개시결정등기", true, false),

	전세권("전세권", false, false),
	지상권("지상권", false, false),
	지역권("지역권", false, false),
	임차권("주택·상가 임차권등기", false, false),
	소유권이전가등기("소유권이전청구권 가등기", false, false),
	가처분("가처분", false, false),
	환매특약("환매특약", false, false),
	소유권이전("소유권이전", false, false),

	유치권("유치권", false, true),
	법정지상권("법정지상권", false, true),
	예고등기("예고등기", false, true),

	기타("기타", false, false);

	private final String label;
	private final boolean baseCandidate;
	private final boolean alwaysSurvives;

	RightKind(String label, boolean baseCandidate, boolean alwaysSurvives) {
		this.label = label;
		this.baseCandidate = baseCandidate;
		this.alwaysSurvives = alwaysSurvives;
	}

	public String label() {
		return label;
	}

	/** 말소기준권리 후보가 될 수 있는가 */
	public boolean isBaseCandidate() {
		return baseCandidate;
	}

	/** 순위와 무관하게 인수될 수 있는가 */
	public boolean alwaysSurvives() {
		return alwaysSurvives;
	}
}
