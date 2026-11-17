package com.gongmae.backend.alert;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.gongmae.backend.auction.AuctionItem;
import com.gongmae.backend.auction.OnbidListItem;

/**
 * 관심조건 매칭 규칙.
 *
 * <p>가장 미묘한 규칙은 "모르는 값은 통과시키지 않는다"는 것이다.
 * 가격 조건을 걸었는데 물건의 최저가를 못 읽었다면, 맞을 수도 있다는 이유로 알림을 보내면 안 된다.
 */
class AlertMatcherTest {

	private final AlertMatcher matcher = new AlertMatcher();

	private AuctionItem item(String sd, String sgg, String usgMclsId, String prptDivCd, Long apslEvlAmt,
			Long lowstBidPrc, Integer usbdNft) {
		AuctionItem auctionItem = new AuctionItem(1L);
		auctionItem.apply(new OnbidListItem(1L, "2024-0001-001", "123", "테스트 물건", prptDivCd, "압류재산", "0001", "매각",
				usgMclsId, "주거용건물", "아파트", sd, sgg, "역삼동", "1168010100", apslEvlAmt, lowstBidPrc, usbdNft,
				"0001", "입찰준비중", "202601010900", "202601051700", "20260101090000"));
		return auctionItem;
	}

	private AlertSubscription subscription() {
		return new AlertSubscription("user1", "테스트 조건");
	}

	@Test
	@DisplayName("조건이 비어 있는 항목은 제한 없음으로 통과한다")
	void emptyConditionsPassThrough() {
		AlertSubscription sub = subscription();
		sub.update("서울특별시", null, null, null, null, null, null, null);

		assertThat(matcher.matches(sub, item("서울특별시", "강남구", "10200", "0007", 100L, 50L, 0))).isTrue();
	}

	@Test
	@DisplayName("지역·용도·재산유형이 다르면 걸러진다")
	void filtersByRegionUsageAndPropertyType() {
		AlertSubscription sub = subscription();
		sub.update("서울특별시", "강남구", "10200", "0007", null, null, null, null);

		assertThat(matcher.matches(sub, item("서울특별시", "강남구", "10200", "0007", 100L, 50L, 0))).isTrue();
		assertThat(matcher.matches(sub, item("경기도", "성남시", "10200", "0007", 100L, 50L, 0))).isFalse();
		assertThat(matcher.matches(sub, item("서울특별시", "마포구", "10200", "0007", 100L, 50L, 0))).isFalse();
		assertThat(matcher.matches(sub, item("서울특별시", "강남구", "10300", "0007", 100L, 50L, 0))).isFalse();
		assertThat(matcher.matches(sub, item("서울특별시", "강남구", "10200", "0005", 100L, 50L, 0))).isFalse();
	}

	@Test
	@DisplayName("최저입찰가 범위로 거른다")
	void filtersByPriceRange() {
		AlertSubscription sub = subscription();
		sub.update(null, null, null, null, 100_000_000L, 500_000_000L, null, null);

		assertThat(matcher.matches(sub, item("서울특별시", "강남구", "10200", "0007", 0L, 300_000_000L, 0))).isTrue();
		assertThat(matcher.matches(sub, item("서울특별시", "강남구", "10200", "0007", 0L, 50_000_000L, 0))).isFalse();
		assertThat(matcher.matches(sub, item("서울특별시", "강남구", "10200", "0007", 0L, 900_000_000L, 0))).isFalse();
	}

	@Test
	@DisplayName("감정가 대비 최저가율 상한으로 싼 물건만 거른다")
	void filtersByDiscountRatio() {
		AlertSubscription sub = subscription();
		sub.update(null, null, null, null, null, null, 70.0, null);

		// 감정가 1000, 최저가 640 → 64%
		assertThat(matcher.matches(sub, item("서울특별시", "강남구", "10200", "0007", 1000L, 640L, 0))).isTrue();
		// 감정가 1000, 최저가 800 → 80%
		assertThat(matcher.matches(sub, item("서울특별시", "강남구", "10200", "0007", 1000L, 800L, 0))).isFalse();
	}

	@Test
	@DisplayName("유찰 횟수 하한으로 거른다")
	void filtersByFailureCount() {
		AlertSubscription sub = subscription();
		sub.update(null, null, null, null, null, null, null, 2);

		assertThat(matcher.matches(sub, item("서울특별시", "강남구", "10200", "0007", 100L, 50L, 3))).isTrue();
		assertThat(matcher.matches(sub, item("서울특별시", "강남구", "10200", "0007", 100L, 50L, 1))).isFalse();
	}

	@Test
	@DisplayName("조건을 건 항목의 값을 모르면 통과시키지 않는다")
	void doesNotPassWhenConditionedValueIsUnknown() {
		AlertSubscription priced = subscription();
		priced.update(null, null, null, null, null, 500_000_000L, null, null);
		assertThat(matcher.matches(priced, item("서울특별시", "강남구", "10200", "0007", 100L, null, 0))).isFalse();

		AlertSubscription ratio = subscription();
		ratio.update(null, null, null, null, null, null, 70.0, null);
		// 감정가가 0이면 비율을 낼 수 없다
		assertThat(matcher.matches(ratio, item("서울특별시", "강남구", "10200", "0007", 0L, 100L, 0))).isFalse();

		AlertSubscription failed = subscription();
		failed.update(null, null, null, null, null, null, null, 1);
		assertThat(matcher.matches(failed, item("서울특별시", "강남구", "10200", "0007", 100L, 50L, null))).isFalse();
	}

	@Test
	@DisplayName("꺼 둔 관심조건은 알림을 만들지 않는다")
	void disabledSubscriptionNeverMatches() {
		AlertSubscription sub = subscription();
		sub.update("서울특별시", null, null, null, null, null, null, null);
		sub.setEnabled(false);

		assertThat(matcher.matches(sub, item("서울특별시", "강남구", "10200", "0007", 100L, 50L, 0))).isFalse();
	}

	@Test
	@DisplayName("조건을 하나도 걸지 않으면 저장을 막는다")
	void rejectsSubscriptionWithoutAnyCondition() {
		AlertSubscription sub = subscription();
		sub.update(null, null, null, null, null, null, null, null);
		assertThat(sub.hasAnyCondition()).isFalse();
	}

	@Test
	@DisplayName("알림 문구에 지역·가격·유찰횟수가 들어간다")
	void buildsReadableMessage() {
		AuctionItem auctionItem = item("서울특별시", "강남구", "10200", "0007", 1_000_000_000L, 640_000_000L, 2);

		assertThat(matcher.titleFor(auctionItem)).contains("서울특별시 강남구").contains("아파트");
		assertThat(matcher.bodyFor(auctionItem))
				.contains("6억 4,000만원")
				.contains("감정가의 64.0%")
				.contains("유찰 2회");
	}
}
