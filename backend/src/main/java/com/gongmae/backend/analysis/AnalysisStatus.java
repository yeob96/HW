package com.gongmae.backend.analysis;

/** 분석 요청의 생명주기. 설계 문서 §4.2 */
public enum AnalysisStatus {
	/** 접수됨, 아직 시작 전 */
	READY,
	/** 작업자가 집어서 진행 중 */
	PROCESSING,
	/** 결과 저장까지 끝남 */
	COMPLETED,
	/** 수집·파싱·분석 중 실패 */
	FAILED;

	public boolean isTerminal() {
		return this == COMPLETED || this == FAILED;
	}
}
