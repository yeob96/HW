package com.gongmae.backend.alert;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gongmae.backend.auction.AuctionItem;
import com.gongmae.backend.auction.AuctionItemRepository;

/** 관심조건 관리와 신규 물건 알림 발송. */
@Service
public class AlertService {

	private static final Logger log = LoggerFactory.getLogger(AlertService.class);
	private static final int MAX_NOTIFICATIONS_PER_RUN_PER_USER = 50;

	private final AlertSubscriptionRepository subscriptions;
	private final AlertNotificationRepository notifications;
	private final AuctionItemRepository items;
	private final AlertMatcher matcher;
	private final NotificationEventPublisher events;

	AlertService(AlertSubscriptionRepository subscriptions, AlertNotificationRepository notifications,
			AuctionItemRepository items, AlertMatcher matcher, NotificationEventPublisher events) {
		this.subscriptions = subscriptions;
		this.notifications = notifications;
		this.items = items;
		this.matcher = matcher;
		this.events = events;
	}

	public static class Rejected extends RuntimeException {

		public Rejected(String message) {
			super(message);
		}
	}

	// ── 관심조건 ──

	public List<AlertSubscription> listSubscriptions(String userId) {
		return subscriptions.findByUserIdOrderByCreatedAtDesc(requireUser(userId));
	}

	@Transactional
	public AlertSubscription saveSubscription(UUID id, String userId, String name, String sdNm, String sggNm,
			String usgMclsIds, String prptDivCds, Long minPrice, Long maxPrice, Double maxLowstRatio,
			Integer minUsbdNft) {
		String user = requireUser(userId);
		if (name == null || name.isBlank()) {
			throw new Rejected("관심조건 이름을 입력해주세요.");
		}
		if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
			throw new Rejected("최저가 범위가 뒤집혀 있습니다.");
		}

		AlertSubscription subscription;
		if (id == null) {
			subscription = new AlertSubscription(user, name.strip());
		} else {
			subscription = subscriptions.findById(id).orElseThrow(() -> new Rejected("관심조건을 찾지 못했습니다."));
			if (!subscription.getUserId().equals(user)) {
				throw new Rejected("다른 사용자의 관심조건은 수정할 수 없습니다.");
			}
			subscription.rename(name.strip());
		}

		subscription.update(sdNm, sggNm, usgMclsIds, prptDivCds, minPrice, maxPrice, maxLowstRatio, minUsbdNft);
		if (!subscription.hasAnyCondition()) {
			throw new Rejected("조건을 하나도 걸지 않으면 모든 신규 물건에 알림이 갑니다. 최소 한 가지는 정해주세요.");
		}
		return subscriptions.save(subscription);
	}

	@Transactional
	public void setEnabled(UUID id, String userId, boolean enabled) {
		AlertSubscription subscription = subscriptions.findById(id)
				.orElseThrow(() -> new Rejected("관심조건을 찾지 못했습니다."));
		if (!subscription.getUserId().equals(requireUser(userId))) {
			throw new Rejected("다른 사용자의 관심조건은 바꿀 수 없습니다.");
		}
		subscription.setEnabled(enabled);
		subscriptions.save(subscription);
	}

	@Transactional
	public void deleteSubscription(UUID id, String userId) {
		AlertSubscription subscription = subscriptions.findById(id)
				.orElseThrow(() -> new Rejected("관심조건을 찾지 못했습니다."));
		if (!subscription.getUserId().equals(requireUser(userId))) {
			throw new Rejected("다른 사용자의 관심조건은 지울 수 없습니다.");
		}
		subscriptions.delete(subscription);
	}

	// ── 알림 ──

	public List<AlertNotification> listNotifications(String userId, int limit) {
		return notifications.findByUserIdOrderByCreatedAtDesc(requireUser(userId),
				PageRequest.of(0, Math.clamp(limit, 1, 200)));
	}

	public long unreadCount(String userId) {
		return notifications.countByUserIdAndReadAtIsNull(requireUser(userId));
	}

	@Transactional
	public void markRead(UUID notificationId, String userId) {
		AlertNotification notification = notifications.findById(notificationId)
				.orElseThrow(() -> new Rejected("알림을 찾지 못했습니다."));
		if (!notification.getUserId().equals(requireUser(userId))) {
			throw new Rejected("다른 사용자의 알림입니다.");
		}
		notification.markRead();
		notifications.save(notification);
	}

	@Transactional
	public int markAllRead(String userId) {
		List<AlertNotification> unread = notifications.findByUserIdAndReadAtIsNull(requireUser(userId));
		unread.forEach(AlertNotification::markRead);
		notifications.saveAll(unread);
		return unread.size();
	}

	/**
	 * 새로 들어온 물건을 관심조건과 맞춰 알림을 만든다. 수집기가 부른다.
	 *
	 * <p>한 사용자에게 한 번에 쏟아지는 알림 수를 제한한다. 수집이 오래 멈췄다 돌면
	 * 수백 건이 한꺼번에 생길 수 있는데, 그러면 알림함이 쓸모없어진다.
	 *
	 * @return 만들어진 알림 수
	 */
	@Transactional
	public int notifyNewItems(List<AuctionItem> newItems) {
		List<AlertSubscription> active = subscriptions.findByEnabledTrue();
		if (active.isEmpty()) {
			markAlerted(newItems);
			return 0;
		}

		Map<String, Integer> perUser = new LinkedHashMap<>();
		List<AlertNotification> created = new ArrayList<>();

		for (AuctionItem item : newItems) {
			for (AlertSubscription subscription : active) {
				if (!matcher.matches(subscription, item)) {
					continue;
				}
				String user = subscription.getUserId();
				int already = perUser.getOrDefault(user, 0);
				if (already >= MAX_NOTIFICATIONS_PER_RUN_PER_USER) {
					continue;
				}
				if (notifications.existsBySubscriptionIdAndOnbidCltrno(subscription.getId(), item.getOnbidCltrno())) {
					continue;
				}
				created.add(new AlertNotification(user, subscription, item.getOnbidCltrno(), item.getCltrMngNo(),
						matcher.titleFor(item), matcher.bodyFor(item)));
				perUser.put(user, already + 1);
			}
		}

		if (!created.isEmpty()) {
			notifications.saveAll(created);
		}
		markAlerted(newItems);

		// 사용자별로 한 번씩만 알린다
		for (Map.Entry<String, Integer> entry : perUser.entrySet()) {
			String user = entry.getKey();
			String title = created.stream()
					.filter(n -> n.getUserId().equals(user))
					.map(AlertNotification::getTitle)
					.findFirst()
					.orElse("새 물건 알림");
			events.publish(user, notifications.countByUserIdAndReadAtIsNull(user),
					entry.getValue() > 1 ? title + " 외 " + (entry.getValue() - 1) + "건" : title);
		}

		log.info("신규 물건 {}건 → 알림 {}건 (대상 사용자 {}명)", newItems.size(), created.size(), perUser.size());
		return created.size();
	}

	private void markAlerted(List<AuctionItem> newItems) {
		newItems.forEach(AuctionItem::markAlerted);
		items.saveAll(newItems);
	}

	private static String requireUser(String userId) {
		if (userId == null || userId.isBlank()) {
			throw new Rejected("사용자 정보가 필요합니다. 로그인 후 이용해주세요.");
		}
		return userId.strip();
	}
}
