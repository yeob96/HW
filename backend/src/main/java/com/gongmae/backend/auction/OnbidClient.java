package com.gongmae.backend.auction;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 온비드 부동산 물건목록 API 클라이언트.
 *
 * <p>실호출로 확인한 규약 (가이드 본문과 다른 부분이 있어 여기에 적어 둔다):
 * <ul>
 *   <li>서비스명·오퍼레이션명 양쪽에 접미사 {@code 2} 가 붙는다 — {@code OnbidRlstListSrvc2/getRlstCltrList2}</li>
 *   <li>{@code prptDivCd}(재산유형)와 {@code pvctTrgtYn}(수의계약가능)이 필수다.
 *       {@code pvctTrgtYn} 은 단일 값이라 전량을 받으려면 Y·N 두 번 돌아야 한다</li>
 *   <li>응답 봉투가 세 종류다. HTTP 200 에도 오류가 실려 오므로 상태코드로 성공을 판정하면 안 된다</li>
 * </ul>
 */
@Component
public class OnbidClient {

	private static final Logger log = LoggerFactory.getLogger(OnbidClient.class);

	private static final String SERVICE = "OnbidRlstListSrvc2";
	private static final String OPERATION = "getRlstCltrList2";
	/** 재산유형 전체 */
	private static final String ALL_PROPERTY_DIVISIONS = "0001,0002,0003,0004,0005,0006,0007,0008,0009,0010";

	private final RestClient restClient;
	private final ObjectMapper objectMapper;
	private final String baseUrl;
	private final String serviceKey;
	private final int pageSize;

	public OnbidClient(ObjectMapper objectMapper,
			@Value("${app.onbid.base-url}") String baseUrl,
			@Value("${app.onbid.service-key:}") String serviceKey,
			@Value("${app.onbid.page-size:5000}") int pageSize) {
		// RestClient.Builder 는 자동 구성되지 않아 직접 만든다
		this.restClient = RestClient.create();
		this.objectMapper = objectMapper;
		this.baseUrl = baseUrl;
		this.serviceKey = serviceKey;
		this.pageSize = pageSize;
	}

	public boolean isConfigured() {
		return serviceKey != null && !serviceKey.isBlank();
	}

	public int pageSize() {
		return pageSize;
	}

	/** 한 페이지 결과 */
	public record Page(List<OnbidListItem> items, int totalCount) {
	}

	public static class OnbidException extends RuntimeException {

		public OnbidException(String message) {
			super(message);
		}
	}

	/**
	 * @param pvctTrgtYn 수의계약 가능 여부 (Y/N) — 필수이며 단일 값
	 * @param modifiedFrom 최종수정일 시작(yyyyMMdd). null 이면 전량
	 */
	public Page fetch(String pvctTrgtYn, int pageNo, String modifiedFrom) {
		if (!isConfigured()) {
			throw new OnbidException("DATA_GO_KR_SERVICE_KEY 가 설정되지 않았습니다.");
		}

		UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(baseUrl)
				.pathSegment(SERVICE, OPERATION)
				.queryParam("serviceKey", serviceKey)
				.queryParam("resultType", "json")
				.queryParam("numOfRows", pageSize)
				.queryParam("pageNo", pageNo)
				.queryParam("prptDivCd", ALL_PROPERTY_DIVISIONS)
				.queryParam("pvctTrgtYn", pvctTrgtYn);
		if (modifiedFrom != null) {
			uri.queryParam("mdfcnYmdStart", modifiedFrom);
		}

		URI url = uri.build(true).toUri();
		String body;
		try {
			body = restClient.get().uri(url).retrieve().body(String.class);
		} catch (Exception e) {
			throw new OnbidException("온비드 API 호출에 실패했습니다: " + e.getMessage());
		}
		if (body == null || body.isBlank()) {
			throw new OnbidException("온비드 API 가 빈 응답을 돌려줬습니다.");
		}

		JsonNode root;
		try {
			root = objectMapper.readTree(body);
		} catch (Exception e) {
			throw new OnbidException("온비드 응답이 JSON 이 아닙니다: " + body.substring(0, Math.min(200, body.length())));
		}

		// 봉투 ② 게이트웨이 오류
		JsonNode gateway = root.path("OpenAPI_ServiceResponse").path("cmmMsgHeader");
		if (!gateway.isMissingNode() && !gateway.isNull()) {
			throw new OnbidException("온비드 게이트웨이 오류: " + gateway.path("errMsg").asString("?") + " / "
					+ gateway.path("returnAuthMsg").asString("?"));
		}
		// 봉투 ③ 파라미터 오류·데이터 없음
		JsonNode plain = root.path("result");
		if (!plain.isMissingNode() && root.path("body").isMissingNode() && root.path("response").isMissingNode()) {
			String code = plain.path("resultCode").asString("?");
			if (!"00".equals(code)) {
				throw new OnbidException("온비드 오류 " + code + ": " + plain.path("resultMsg").asString("?"));
			}
		}
		// 봉투 ① 정상
		JsonNode header = root.has("header") ? root.path("header") : root.path("response").path("header");
		String resultCode = header.path("resultCode").asString("");
		if (!resultCode.isEmpty() && !"00".equals(resultCode)) {
			throw new OnbidException("온비드 오류 " + resultCode + ": " + header.path("resultMsg").asString("?"));
		}

		JsonNode bodyNode = root.has("body") ? root.path("body") : root.path("response").path("body");
		JsonNode itemsNode = bodyNode.path("items");
		if (itemsNode.isObject()) {
			itemsNode = itemsNode.path("item");
		}

		List<OnbidListItem> items = new ArrayList<>();
		if (itemsNode.isArray()) {
			for (JsonNode node : itemsNode) {
				OnbidListItem item = OnbidListItem.from(node);
				if (item != null) {
					items.add(item);
				}
			}
		} else if (itemsNode.isObject()) {
			OnbidListItem item = OnbidListItem.from(itemsNode);
			if (item != null) {
				items.add(item);
			}
		}

		int totalCount = bodyNode.path("totalCount").asInt(items.size());
		log.debug("온비드 수집 pvctTrgtYn={} page={} 수신={} 총={}", pvctTrgtYn, pageNo, items.size(), totalCount);
		return new Page(items, totalCount);
	}
}
