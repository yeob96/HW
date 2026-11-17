package com.gongmae.backend.alert;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 관심조건과 알림 API.
 *
 * <p>인증이 아직 없어 {@code userId} 를 파라미터로 받는다. 프론트의 목업 계정 아이디를 그대로 쓴다.
 * 실제 인증이 붙으면 이 파라미터를 토큰에서 꺼내도록 바꾸면 된다.
 */
@RestController
@RequestMapping("/api/alerts")
public class AlertController {

	private final AlertService service;
	private final NotificationEventPublisher events;

	public AlertController(AlertService service, NotificationEventPublisher events) {
		this.service = service;
		this.events = events;
	}

	public record SubscriptionRequest(
			UUID id,
			String userId,
			String name,
			String sdNm,
			String sggNm,
			String usgMclsIds,
			String prptDivCds,
			Long minPrice,
			Long maxPrice,
			Double maxLowstRatio,
			Integer minUsbdNft) {
	}

	public record SubscriptionView(
			UUID id,
			String name,
			boolean enabled,
			String sdNm,
			String sggNm,
			String usgMclsIds,
			String prptDivCds,
			Long minPrice,
			Long maxPrice,
			Double maxLowstRatio,
			Integer minUsbdNft,
			Instant createdAt) {

		static SubscriptionView of(AlertSubscription s) {
			return new SubscriptionView(s.getId(), s.getName(), s.isEnabled(), s.getSdNm(), s.getSggNm(),
					s.getUsgMclsIds(), s.getPrptDivCds(), s.getMinPrice(), s.getMaxPrice(), s.getMaxLowstRatio(),
					s.getMinUsbdNft(), s.getCreatedAt());
		}
	}

	public record NotificationView(
			UUID id,
			String subscriptionName,
			Long onbidCltrno,
			String cltrMngNo,
			String title,
			String body,
			Instant createdAt,
			Instant readAt) {

		static NotificationView of(AlertNotification n) {
			return new NotificationView(n.getId(), n.getSubscriptionName(), n.getOnbidCltrno(), n.getCltrMngNo(),
					n.getTitle(), n.getBody(), n.getCreatedAt(), n.getReadAt());
		}
	}

	public record InboxView(long unreadCount, List<NotificationView> notifications) {
	}

	public record ErrorResponse(String message) {
	}

	@GetMapping("/subscriptions")
	public List<SubscriptionView> listSubscriptions(@RequestParam String userId) {
		return service.listSubscriptions(userId).stream().map(SubscriptionView::of).toList();
	}

	@PostMapping("/subscriptions")
	public SubscriptionView saveSubscription(@RequestBody SubscriptionRequest request) {
		AlertSubscription saved = service.saveSubscription(request.id(), request.userId(), request.name(),
				request.sdNm(), request.sggNm(), request.usgMclsIds(), request.prptDivCds(), request.minPrice(),
				request.maxPrice(), request.maxLowstRatio(), request.minUsbdNft());
		return SubscriptionView.of(saved);
	}

	@PostMapping("/subscriptions/{id}/enabled")
	public ResponseEntity<Void> setEnabled(@PathVariable UUID id, @RequestParam String userId,
			@RequestParam boolean enabled) {
		service.setEnabled(id, userId, enabled);
		return ResponseEntity.noContent().build();
	}

	@DeleteMapping("/subscriptions/{id}")
	public ResponseEntity<Void> deleteSubscription(@PathVariable UUID id, @RequestParam String userId) {
		service.deleteSubscription(id, userId);
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/notifications")
	public InboxView notifications(@RequestParam String userId,
			@RequestParam(defaultValue = "50") int limit) {
		return new InboxView(service.unreadCount(userId),
				service.listNotifications(userId, limit).stream().map(NotificationView::of).toList());
	}

	@PostMapping("/notifications/{id}/read")
	public ResponseEntity<Void> markRead(@PathVariable UUID id, @RequestParam String userId) {
		service.markRead(id, userId);
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/notifications/read-all")
	public ResponseEntity<Void> markAllRead(@RequestParam String userId) {
		service.markAllRead(userId);
		return ResponseEntity.noContent().build();
	}

	/** 새 알림 스트림. 본문은 싣지 않고 "새 알림이 있다"와 읽지 않은 개수만 보낸다 */
	@GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
	public SseEmitter stream(@RequestParam String userId) {
		return events.subscribe(userId);
	}

	@ExceptionHandler(AlertService.Rejected.class)
	public ResponseEntity<ErrorResponse> handleRejected(AlertService.Rejected e) {
		return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage()));
	}
}
