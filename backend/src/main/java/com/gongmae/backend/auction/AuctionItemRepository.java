package com.gongmae.backend.auction;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AuctionItemRepository extends JpaRepository<AuctionItem, Long> {

	/** 아직 알림을 내보내지 않은 신규 물건 */
	List<AuctionItem> findByAlertedFalse(Pageable pageable);

	long countByAlertedFalse();

	/** 증분 수집의 시작점 — 지금까지 받은 것 중 가장 최근 최종수정일시 */
	@Query("select max(i.mdfcnDt) from AuctionItem i")
	String findMaxMdfcnDt();

	List<AuctionItem> findTop50ByOrderByFirstSeenAtDesc();
}
