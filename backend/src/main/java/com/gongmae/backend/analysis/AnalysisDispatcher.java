package com.gongmae.backend.analysis;

import java.util.UUID;

/**
 * 분석 작업을 작업자에게 넘기는 자리. 설계 문서 §4.3
 *
 * <p>지금은 같은 프로세스의 스레드 풀로 처리한다. MQ 를 붙일 때는 이 인터페이스의 구현만
 * 교체하면 되고, 호출하는 쪽(API 계층)은 바뀌지 않는다.
 *
 * <p>메시지에는 analysisId 만 싣는다. 원문이나 대용량 결과를 메시지에 넣지 않는다(§4.3).
 */
public interface AnalysisDispatcher {

	void enqueue(UUID analysisId);
}
