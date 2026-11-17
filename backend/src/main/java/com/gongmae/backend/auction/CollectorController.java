package com.gongmae.backend.auction;

import java.time.Instant;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 수집 상태 확인과 수동 실행. 주기 수집을 기다리지 않고 바로 돌려볼 때 쓴다. */
@RestController
@RequestMapping("/api/collector")
public class CollectorController {

	private final CollectorService collector;
	private final AuctionItemRepository items;

	public CollectorController(CollectorService collector, AuctionItemRepository items) {
		this.collector = collector;
		this.items = items;
	}

	public record StatusView(
			boolean configured,
			long totalItems,
			long pendingAlert,
			Instant lastRunAt,
			Boolean lastRunBaseline,
			Integer lastRunCalls,
			Integer lastRunCreated,
			Integer lastRunUpdated,
			Integer lastRunNotifications,
			Long lastRunDurationMs,
			String lastRunError) {
	}

	public record RecentItemView(
			Long onbidCltrno,
			String cltrMngNo,
			String cltrNm,
			String sdNm,
			String sggNm,
			String usgMclsNm,
			Long apslEvlAmt,
			Long lowstBidPrc,
			Double lowstRatio,
			Integer usbdNft,
			String pbctStatNm,
			String bidEndDt,
			Instant firstSeenAt) {

		static RecentItemView of(AuctionItem i) {
			return new RecentItemView(i.getOnbidCltrno(), i.getCltrMngNo(), i.getCltrNm(), i.getSdNm(), i.getSggNm(),
					i.getUsgMclsNm(), i.getApslEvlAmt(), i.getLowstBidPrc(), i.getLowstRatio(), i.getUsbdNft(),
					i.getPbctStatNm(), i.getBidEndDt(), i.getFirstSeenAt());
		}
	}

	@GetMapping("/status")
	public StatusView status() {
		return collector.lastResult()
				.map(r -> new StatusView(collector.isConfigured(), collector.totalItems(), items.countByAlertedFalse(),
						r.at(), r.baseline(), r.calls(), r.created(), r.updated(), r.notificationsSent(),
						r.durationMs(), r.error()))
				.orElseGet(() -> new StatusView(collector.isConfigured(), collector.totalItems(),
						items.countByAlertedFalse(), null, null, null, null, null, null, null, null));
	}

	@PostMapping("/run")
	public ResponseEntity<StatusView> run() {
		collector.collect();
		return ResponseEntity.ok(status());
	}

	/** 최근에 처음 본 물건들 — 알림이 제대로 걸리는지 눈으로 볼 때 쓴다 */
	@GetMapping("/recent")
	public List<RecentItemView> recent() {
		return items.findTop50ByOrderByFirstSeenAtDesc().stream().map(RecentItemView::of).toList();
	}
}
