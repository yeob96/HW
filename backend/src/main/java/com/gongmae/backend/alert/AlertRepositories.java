package com.gongmae.backend.alert;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

interface AlertSubscriptionRepository extends JpaRepository<AlertSubscription, UUID> {

	List<AlertSubscription> findByUserIdOrderByCreatedAtDesc(String userId);

	List<AlertSubscription> findByEnabledTrue();
}

interface AlertNotificationRepository extends JpaRepository<AlertNotification, UUID> {

	List<AlertNotification> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);

	long countByUserIdAndReadAtIsNull(String userId);

	List<AlertNotification> findByUserIdAndReadAtIsNull(String userId);

	boolean existsBySubscriptionIdAndOnbidCltrno(UUID subscriptionId, Long onbidCltrno);
}
