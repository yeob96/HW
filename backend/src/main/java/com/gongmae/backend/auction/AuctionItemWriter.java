package com.gongmae.backend.auction;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 수집 결과를 DB 에 쓴다.
 *
 * <p>CollectorService 안에 두면 같은 빈 안에서의 호출이라 {@code @Transactional} 프록시를 타지 않는다.
 * 그래서 쓰기만 따로 빼 두었다.
 */
@Component
public class AuctionItemWriter {

	private final AuctionItemRepository items;

	public AuctionItemWriter(AuctionItemRepository items) {
		this.items = items;
	}

	public record UpsertResult(int created, int updated, List<AuctionItem> newItems) {
	}

	@Transactional
	public UpsertResult upsert(List<OnbidListItem> incoming) {
		int created = 0;
		int updated = 0;
		List<AuctionItem> newItems = new ArrayList<>();

		for (OnbidListItem source : incoming) {
			AuctionItem item = items.findById(source.onbidCltrno()).orElse(null);
			if (item == null) {
				item = new AuctionItem(source.onbidCltrno());
				item.apply(source);
				newItems.add(items.save(item));
				created++;
			} else {
				item.apply(source);
				items.save(item);
				updated++;
			}
		}
		return new UpsertResult(created, updated, newItems);
	}

	/** 첫 수집분을 알림 없이 기준선으로 처리한다 */
	@Transactional
	public int markAllAlerted() {
		List<AuctionItem> pending = items.findByAlertedFalse(Pageable.unpaged());
		pending.forEach(AuctionItem::markAlerted);
		items.saveAll(pending);
		return pending.size();
	}
}
