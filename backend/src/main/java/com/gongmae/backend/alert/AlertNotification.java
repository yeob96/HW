package com.gongmae.backend.alert;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * 사용자에게 간 알림 한 건.
 *
 * <p>(관심조건, 물건) 쌍에 유니크 제약을 걸어, 수집이 겹쳐 돌거나 재시도가 나도
 * 같은 물건으로 같은 조건에 두 번 알림이 가지 않게 한다.
 */
@Entity
@Table(name = "alert_notification",
		uniqueConstraints = @UniqueConstraint(name = "uq_notification_sub_item",
				columnNames = { "subscription_id", "onbid_cltrno" }),
		indexes = @Index(name = "idx_notification_user", columnList = "user_id, created_at"))
public class AlertNotification {

	@Id
	private UUID id;

	@Column(name = "user_id", nullable = false, length = 100)
	private String userId;

	@Column(name = "subscription_id", nullable = false)
	private UUID subscriptionId;

	@Column(name = "subscription_name", nullable = false, length = 100)
	private String subscriptionName;

	@Column(name = "onbid_cltrno", nullable = false)
	private Long onbidCltrno;

	/** 상세·분석으로 이어가기 위한 물건관리번호 */
	@Column(name = "cltr_mng_no", length = 40)
	private String cltrMngNo;

	@Column(nullable = false, length = 300)
	private String title;

	@Column(nullable = false, length = 500)
	private String body;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "read_at")
	private Instant readAt;

	protected AlertNotification() {
		// JPA
	}

	public AlertNotification(String userId, AlertSubscription subscription, Long onbidCltrno, String cltrMngNo,
			String title, String body) {
		this.id = UUID.randomUUID();
		this.userId = userId;
		this.subscriptionId = subscription.getId();
		this.subscriptionName = subscription.getName();
		this.onbidCltrno = onbidCltrno;
		this.cltrMngNo = cltrMngNo;
		this.title = title.length() > 300 ? title.substring(0, 300) : title;
		this.body = body.length() > 500 ? body.substring(0, 500) : body;
		this.createdAt = Instant.now();
	}

	public void markRead() {
		if (this.readAt == null) {
			this.readAt = Instant.now();
		}
	}

	public UUID getId() {
		return id;
	}

	public String getUserId() {
		return userId;
	}

	public UUID getSubscriptionId() {
		return subscriptionId;
	}

	public String getSubscriptionName() {
		return subscriptionName;
	}

	public Long getOnbidCltrno() {
		return onbidCltrno;
	}

	public String getCltrMngNo() {
		return cltrMngNo;
	}

	public String getTitle() {
		return title;
	}

	public String getBody() {
		return body;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getReadAt() {
		return readAt;
	}
}
