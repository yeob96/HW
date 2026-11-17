package com.gongmae.backend.alert;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 새 알림이 생기면 그 사용자에게 SSE 로 알린다.
 *
 * <p>분석 상태 알림과 같은 원칙이다 — 본문을 다 싣지 않고 "새 알림이 있다"는 사실과 읽지 않은 개수만 보낸다.
 * 화면은 그걸 받고 목록 API 를 다시 부른다. 연결이 끊겨 이벤트를 놓쳐도 목록 조회로 복구된다.
 */
@Component
public class NotificationEventPublisher {

	private static final Logger log = LoggerFactory.getLogger(NotificationEventPublisher.class);
	private static final long TIMEOUT_MS = 30 * 60 * 1000L;

	private final Map<String, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

	public record NewAlertEvent(String userId, long unreadCount, String title, Instant at) {
	}

	public SseEmitter subscribe(String userId) {
		SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
		emitters.computeIfAbsent(userId, key -> new CopyOnWriteArrayList<>()).add(emitter);

		Runnable remove = () -> {
			List<SseEmitter> list = emitters.get(userId);
			if (list != null) {
				list.remove(emitter);
				if (list.isEmpty()) {
					emitters.remove(userId);
				}
			}
		};
		emitter.onCompletion(remove);
		emitter.onTimeout(remove);
		emitter.onError(error -> remove.run());

		try {
			emitter.send(SseEmitter.event().name("open").data(userId));
		} catch (IOException e) {
			remove.run();
		}
		return emitter;
	}

	public void publish(String userId, long unreadCount, String title) {
		List<SseEmitter> list = emitters.get(userId);
		if (list == null || list.isEmpty()) {
			return;
		}
		NewAlertEvent event = new NewAlertEvent(userId, unreadCount, title, Instant.now());
		for (SseEmitter emitter : list) {
			try {
				emitter.send(SseEmitter.event().name("alert").data(event));
			} catch (IOException e) {
				log.debug("알림 SSE 전송 실패 userId={}", userId, e);
				emitter.completeWithError(e);
			}
		}
	}
}
