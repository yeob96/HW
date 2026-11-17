package com.gongmae.backend.auction;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.ReentrantLock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.gongmae.backend.alert.AlertService;

/**
 * 온비드 물건을 주기적으로 받아 저장하고, 처음 보는 물건을 가려낸다.
 *
 * <p>첫 수집은 전량, 이후에는 최종수정일 기준 증분으로 돈다. 개발계정에 일일 호출 한도가 있어
 * 한 번의 수집이 쓰는 호출 수를 {@code app.onbid.max-calls-per-run} 으로 묶는다.
 *
 * <p>여기서 "신규"는 온비드 기준 신규가 아니라 <b>우리가 처음 본 물건</b>이다.
 * 그래서 첫 전량 수집에서는 모든 물건이 신규가 되는데, 그때 수만 건의 알림이 나가면 안 되므로
 * 첫 수집분은 알림 없이 기준선으로만 깔아 둔다.
 */
@Service
public class CollectorService {

	private static final Logger log = LoggerFactory.getLogger(CollectorService.class);
	private static final DateTimeFormatter YMD = DateTimeFormatter.ofPattern("yyyyMMdd");

	private final AuctionItemRepository items;
	private final AuctionItemWriter writer;
	private final OnbidClient client;
	private final AlertService alerts;
	private final int maxCallsPerRun;

	/** 수집이 겹쳐 돌지 않게 막는다 */
	private final ReentrantLock lock = new ReentrantLock();
	private final AtomicReference<CollectResult> lastResult = new AtomicReference<>();

	public CollectorService(AuctionItemRepository items, AuctionItemWriter writer, OnbidClient client,
			AlertService alerts, @Value("${app.onbid.max-calls-per-run:20}") int maxCallsPerRun) {
		this.items = items;
		this.writer = writer;
		this.client = client;
		this.alerts = alerts;
		this.maxCallsPerRun = maxCallsPerRun;
	}

	public record CollectResult(
			Instant at,
			boolean baseline,
			int calls,
			int received,
			int created,
			int updated,
			int notificationsSent,
			long durationMs,
			String error) {
	}

	public Optional<CollectResult> lastResult() {
		return Optional.ofNullable(lastResult.get());
	}

	public long totalItems() {
		return items.count();
	}

	public boolean isConfigured() {
		return client.isConfigured();
	}

	@Scheduled(fixedDelayString = "${app.onbid.collect-interval:PT1H}",
			initialDelayString = "${app.onbid.collect-initial-delay:PT1M}")
	public void scheduled() {
		if (!client.isConfigured()) {
			log.debug("서비스키가 없어 수집을 건너뜁니다.");
			return;
		}
		collect();
	}

	public CollectResult collect() {
		if (!lock.tryLock()) {
			log.info("이미 수집이 돌고 있어 이번 요청은 건너뜁니다.");
			return lastResult.get();
		}
		long startedAt = System.currentTimeMillis();
		try {
			CollectResult result = doCollect(startedAt);
			lastResult.set(result);
			return result;
		} catch (Exception e) {
			log.warn("수집 실패: {}", e.getMessage());
			CollectResult failure = new CollectResult(Instant.now(), false, 0, 0, 0, 0, 0,
					System.currentTimeMillis() - startedAt, e.getMessage());
			lastResult.set(failure);
			return failure;
		} finally {
			lock.unlock();
		}
	}

	private CollectResult doCollect(long startedAt) {
		boolean baseline = items.count() == 0;

		// 증분 수집 — 지금까지 본 것 중 가장 최근 수정일 하루 전부터 다시 훑어 경계 누락을 막는다
		String modifiedFrom = null;
		if (!baseline) {
			String maxMdfcn = items.findMaxMdfcnDt();
			if (maxMdfcn != null && maxMdfcn.length() >= 8) {
				modifiedFrom = LocalDate.parse(maxMdfcn.substring(0, 8), YMD).minusDays(1).format(YMD);
			}
		}

		int calls = 0;
		int received = 0;
		int created = 0;
		int updated = 0;
		List<AuctionItem> newlyCreated = new ArrayList<>();

		for (String pvctTrgtYn : List.of("N", "Y")) {
			int pageNo = 1;
			long total = Long.MAX_VALUE;
			while ((long) (pageNo - 1) * client.pageSize() < total && calls < maxCallsPerRun) {
				OnbidClient.Page page = client.fetch(pvctTrgtYn, pageNo, modifiedFrom);
				calls++;
				total = page.totalCount();
				received += page.items().size();

				AuctionItemWriter.UpsertResult upsert = writer.upsert(page.items());
				created += upsert.created();
				updated += upsert.updated();
				newlyCreated.addAll(upsert.newItems());

				if (page.items().isEmpty()) {
					break;
				}
				pageNo++;
			}
		}

		int sent = 0;
		if (baseline) {
			int marked = writer.markAllAlerted();
			log.info("첫 수집 {}건을 기준선으로 저장했습니다. 알림은 보내지 않습니다.", marked);
		} else if (!newlyCreated.isEmpty()) {
			sent = alerts.notifyNewItems(newlyCreated);
		}

		CollectResult result = new CollectResult(Instant.now(), baseline, calls, received, created, updated, sent,
				System.currentTimeMillis() - startedAt, null);
		log.info("수집 완료 — 호출 {}회, 수신 {}건, 신규 {}건, 갱신 {}건, 알림 {}건 ({}ms)", calls, received, created, updated,
				sent, result.durationMs());
		return result;
	}
}
