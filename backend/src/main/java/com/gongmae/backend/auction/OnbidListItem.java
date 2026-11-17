package com.gongmae.backend.auction;

import tools.jackson.databind.JsonNode;

/**
 * 온비드 부동산 물건목록 응답의 한 건. 62개 필드 중 쓰는 것만 담는다.
 *
 * <p>값이 숫자로도 문자열로도 오고(예: {@code lowstBidPrcIndctCont} 는 문자열),
 * null 이나 빈 문자열도 섞여 있어 읽을 때 전부 방어한다.
 */
public record OnbidListItem(
		Long onbidCltrno,
		String cltrMngNo,
		String pbctCdtnNo,
		String cltrNm,
		String prptDivCd,
		String prptDivNm,
		String dspsMthodCd,
		String dspsMthodNm,
		String usgMclsId,
		String usgMclsNm,
		String usgSclsNm,
		String sdNm,
		String sggNm,
		String emdNm,
		String ltnoPnu,
		Long apslEvlAmt,
		Long lowstBidPrc,
		Integer usbdNft,
		String pbctStatCd,
		String pbctStatNm,
		String bidBgngDt,
		String bidEndDt,
		String mdfcnDt) {

	public static OnbidListItem from(JsonNode node) {
		Long id = asLong(node, "onbidCltrno");
		if (id == null) {
			return null;
		}
		return new OnbidListItem(
				id,
				asText(node, "cltrMngNo"),
				asText(node, "pbctCdtnNo"),
				asText(node, "onbidCltrNm"),
				asText(node, "prptDivCd"),
				asText(node, "prptDivNm"),
				asText(node, "dspsMthodCd"),
				asText(node, "dspsMthodNm"),
				asText(node, "cltrUsgMclsCtgrId"),
				asText(node, "cltrUsgMclsCtgrNm"),
				asText(node, "cltrUsgSclsCtgrNm"),
				asText(node, "lctnSdnm"),
				asText(node, "lctnSggnm"),
				asText(node, "lctnEmdNm"),
				asText(node, "ltnoPnu"),
				asLong(node, "apslEvlAmt"),
				asLong(node, "lowstBidPrcIndctCont"),
				asInt(node, "usbdNft"),
				asText(node, "pbctStatCd"),
				asText(node, "pbctStatNm"),
				asText(node, "cltrBidBgngDt"),
				asText(node, "cltrBidEndDt"),
				asText(node, "mdfcnDt"));
	}

	private static String asText(JsonNode node, String field) {
		JsonNode value = node.get(field);
		if (value == null || value.isNull()) {
			return null;
		}
		String text = value.asString().strip();
		return text.isEmpty() || "null".equals(text) ? null : text;
	}

	private static Long asLong(JsonNode node, String field) {
		String text = asText(node, field);
		if (text == null) {
			return null;
		}
		try {
			return Long.parseLong(text.replaceAll("[^0-9-]", ""));
		} catch (NumberFormatException e) {
			return null;
		}
	}

	private static Integer asInt(JsonNode node, String field) {
		Long value = asLong(node, field);
		return value == null ? null : value.intValue();
	}
}
