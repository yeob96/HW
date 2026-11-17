package com.gongmae.backend.analysis;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 분석 상태 변경을 SSE 로 알린다. 설계 문서 §10.2
 *
 * <p>결과 본문은 보내지 않는다. 상태만 알리고, 프론트가 결과 조회 API 를 따로 부른다.
 * 연결이 끊겨 이벤트를 놓쳐도 상태 조회로 복구할 수 있어야 한다.
 */
@Component
public class AnalysisEventPublisher {

	private static final Logger log = LoggerFactory.getLogger(AnalysisEventPublisher.class);
	private static final long TIMEOUT_MS = 10 * 60 * 1000L;

	private final Map<UUID, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

	public record StatusEvent(UUID analysisId, String targetKey, AnalysisStatus status, Instant at, String errorCode,
			String errorSummary) {
	}

	public SseEmitter subscribe(UUID analysisId) {
		SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
		emitters.computeIfAbsent(analysisId, key -> new CopyOnWriteArrayList<>()).add(emitter);

		Runnable remove = () -> {
			List<SseEmitter> list = emitters.get(analysisId);
			if (list != null) {
				list.remove(emitter);
				if (list.isEmpty()) {
					emitters.remove(analysisId);
				}
			}
		};
		emitter.onCompletion(remove);
		emitter.onTimeout(remove);
		emitter.onError(error -> remove.run());

		try {
			// 연결 직후 한 번 보내 프록시가 스트림을 끊지 않게 한다
			emitter.send(SseEmitter.event().name("open").data(analysisId.toString()));
		} catch (IOException e) {
			remove.run();
		}
		return emitter;
	}

	public void publish(AnalysisRequestEntity request) {
		StatusEvent event = new StatusEvent(request.getId(), request.getTargetKey(), request.getStatus(),
				Instant.now(), request.getErrorCode(), request.getErrorSummary());
		List<SseEmitter> list = emitters.get(request.getId());
		if (list == null) {
			return;
		}
		for (SseEmitter emitter : list) {
			try {
				emitter.send(SseEmitter.event().name("status").data(event));
				if (request.getStatus().isTerminal()) {
					emitter.complete();
				}
			} catch (IOException e) {
				log.debug("SSE 전송 실패 analysisId={}", request.getId(), e);
				emitter.completeWithError(e);
			}
		}
	}
}
