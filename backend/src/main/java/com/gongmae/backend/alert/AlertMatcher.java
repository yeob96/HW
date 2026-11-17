package com.gongmae.backend.alert;

import java.util.List;

import org.springframework.stereotype.Component;

import com.gongmae.backend.auction.AuctionItem;

/**
 * 신규 물건이 관심조건에 맞는지 본다.
 *
 * <p>비어 있는 조건은 "제한 없음"으로 통과시킨다. 값을 읽지 못한 항목(null)이 있는데
 * 그 항목에 조건이 걸려 있으면 <b>통과시키지 않는다</b> — 모르는 것을 맞다고 볼 수는 없다.
 */
@Component
public class AlertMatcher {

	public boolean matches(AlertSubscription subscription, AuctionItem item) {
		if (!subscription.isEnabled()) {
			return false;
		}
		if (!regionMatches(subscription, item)) {
			return false;
		}
		if (!inList(subscription.usgMclsIdList(), item.getUsgMclsId())) {
			return false;
		}
		if (!inList(subscription.prptDivCdList(), item.getPrptDivCd())) {
			return false;
		}
		if (!priceMatches(subscription, item)) {
			return false;
		}
		if (subscription.getMaxLowstRatio() != null) {
			Double ratio = item.getLowstRatio();
			if (ratio == null || ratio > subscription.getMaxLowstRatio()) {
				return false;
			}
		}
		if (subscription.getMinUsbdNft() != null) {
			Integer failed = item.getUsbdNft();
			if (failed == null || failed < subscription.getMinUsbdNft()) {
				return false;
			}
		}
		return true;
	}

	private boolean regionMatches(AlertSubscription subscription, AuctionItem item) {
		if (subscription.getSdNm() != null) {
			if (item.getSdNm() == null || !item.getSdNm().contains(subscription.getSdNm())) {
				return false;
			}
		}
		if (subscription.getSggNm() != null) {
			return item.getSggNm() != null && item.getSggNm().contains(subscription.getSggNm());
		}
		return true;
	}

	private boolean priceMatches(AlertSubscription subscription, AuctionItem item) {
		if (subscription.getMinPrice() == null && subscription.getMaxPrice() == null) {
			return true;
		}
		Long price = item.getLowstBidPrc();
		if (price == null) {
			return false;
		}
		if (subscription.getMinPrice() != null && price < subscription.getMinPrice()) {
			return false;
		}
		return subscription.getMaxPrice() == null || price <= subscription.getMaxPrice();
	}

	private boolean inList(List<String> allowed, String value) {
		if (allowed.isEmpty()) {
			return true;
		}
		return value != null && allowed.contains(value);
	}

	/** 알림 문구 */
	public String titleFor(AuctionItem item) {
		String where = String.join(" ", nullToEmpty(item.getSdNm()), nullToEmpty(item.getSggNm())).strip();
		String usage = item.getUsgSclsNm() != null ? item.getUsgSclsNm() : nullToEmpty(item.getUsgMclsNm());
		return "%s %s 새 물건".formatted(where.isEmpty() ? "신규" : where, usage).strip();
	}

	public String bodyFor(AuctionItem item) {
		StringBuilder body = new StringBuilder();
		if (item.getCltrNm() != null) {
			body.append(item.getCltrNm()).append(' ');
		}
		if (item.getLowstBidPrc() != null) {
			body.append("최저 ").append(manwon(item.getLowstBidPrc()));
		}
		if (item.getLowstRatio() != null) {
			body.append(" (감정가의 ").append(item.getLowstRatio()).append("%)");
		}
		if (item.getUsbdNft() != null && item.getUsbdNft() > 0) {
			body.append(" · 유찰 ").append(item.getUsbdNft()).append("회");
		}
		if (item.getBidEndDt() != null && item.getBidEndDt().length() >= 8) {
			String d = item.getBidEndDt();
			body.append(" · 마감 ").append(d, 0, 4).append('.').append(d, 4, 6).append('.').append(d, 6, 8);
		}
		return body.toString().strip();
	}

	private static String manwon(long won) {
		long manwon = won / 10000;
		if (manwon >= 10000) {
			long eok = manwon / 10000;
			long rest = manwon % 10000;
			return rest > 0 ? "%d억 %,d만원".formatted(eok, rest) : "%d억원".formatted(eok);
		}
		return "%,d만원".formatted(manwon);
	}

	private static String nullToEmpty(String value) {
		return value == null ? "" : value;
	}
}
