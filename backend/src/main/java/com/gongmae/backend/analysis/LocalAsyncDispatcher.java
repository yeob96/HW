package com.gongmae.backend.analysis;

import java.util.UUID;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * MQ 가 들어오기 전까지 쓰는 같은 프로세스 디스패처.
 *
 * <p>트랜잭션이 커밋된 뒤에 작업이 시작되도록 호출 쪽에서 순서를 맞춘다.
 * MQ 로 바꿀 때는 이 클래스만 교체하면 된다.
 */
@Component
public class LocalAsyncDispatcher implements AnalysisDispatcher {

	private final AnalysisWorker worker;

	public LocalAsyncDispatcher(AnalysisWorker worker) {
		this.worker = worker;
	}

	@Override
	@Async("analysisExecutor")
	public void enqueue(UUID analysisId) {
		worker.run(analysisId);
	}
}
