package com.gongmae.backend.registry;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

/**
 * 등기부등본 텍스트를 권리 레코드로 구조화한다. 설계 문서 §6.1·§6.2
 *
 * <p>원칙은 하나다 — <b>문서에 없는 값은 만들어내지 않는다.</b>
 * 접수일이나 권리자를 못 읽으면 null 로 두고 {@code confidence} 를 낮춘다.
 * 낮은 신뢰도 항목은 뒤의 규칙 엔진이 자동 확정하지 않고 판단 보류로 분류한다.
 */
@Component
public class RegistryParser {

	/** 파싱 규칙이 바뀌면 올린다. 저장된 결과의 재현성 추적에 쓰인다 */
	public static final String PARSE_VERSION = "1.0";

	private static final Pattern SECTION_MARKER = Pattern.compile("[\\[【]?\\s*(표\\s*제\\s*부|갑\\s*구|을\\s*구)\\s*[\\]】]?");
	/** 등기 항목의 시작 — 줄머리의 순위번호 (가지번호 포함) */
	private static final Pattern ENTRY_START = Pattern.compile("^(\\d{1,3}(?:-\\d{1,3})?)\\s+(\\S.*)$");
	private static final Pattern DATE = Pattern.compile("(\\d{4})\\s*년\\s*(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일");
	private static final Pattern RECEIPT_NO = Pattern.compile("제\\s*(\\d+)\\s*호");
	private static final Pattern AMOUNT = Pattern.compile(
			"(?:채권최고액|청구금액|피보전권리금액|전세금|임차보증금|거래가액)\\s*금?\\s*([0-9][0-9,]*)\\s*원");
	private static final Pattern HOLDER = Pattern.compile(
			"(소유자|공유자|채권자|근저당권자|가압류권자|압류권자|전세권자|임차권자|지상권자|지역권자|가등기권자|신탁자|수탁자|권리자)\\s*[:：]?\\s*([^0-9\\n]{1,40})");
	/** 말소등기가 가리키는 순위번호 — "3번 근저당권설정등기말소" */
	private static final Pattern CANCEL_TARGET = Pattern.compile("(\\d{1,3}(?:-\\d{1,3})?)\\s*번");
	private static final Pattern ADDRESS_HINT = Pattern.compile(
			"(특별시|광역시|특별자치시|특별자치도|[가-힣]{2,}도)\\s|[가-힣]+(시|군|구)\\s+[가-힣]+(동|읍|면|리|로|길)");

	public record ParseResult(List<RegistryRight> rights, String propertyDescription, List<String> warnings) {
	}

	public ParseResult parse(UUID documentId, String text) {
		List<String> lines = text.lines().map(String::strip).toList();
		List<String> warnings = new ArrayList<>();

		RegistrySection current = null;
		String propertyDescription = null;

		List<Block> blocks = new ArrayList<>();
		Block open = null;

		for (String line : lines) {
			if (line.isEmpty()) {
				continue;
			}

			RegistrySection marker = sectionOf(line);
			if (marker != null) {
				if (open != null) {
					blocks.add(open);
					open = null;
				}
				current = marker;
				continue;
			}

			if (current == RegistrySection.표제부) {
				if (propertyDescription == null && line.length() >= 8 && ADDRESS_HINT.matcher(line).find()) {
					propertyDescription = line;
				}
				continue;
			}
			if (current == null) {
				continue;
			}

			Matcher entry = ENTRY_START.matcher(line);
			String purpose = entry.matches() ? purposeToken(entry.group(2)) : null;
			if (purpose != null) {
				if (open != null) {
					blocks.add(open);
				}
				open = new Block(current, entry.group(1), purpose, line);
			} else if (open != null) {
				open.append(line);
			}
		}
		if (open != null) {
			blocks.add(open);
		}

		if (blocks.isEmpty()) {
			warnings.add("갑구·을구에서 등기 항목을 하나도 찾지 못했습니다. 텍스트 레이어가 없는 스캔본이거나 형식이 다를 수 있습니다.");
		}
		if (propertyDescription == null) {
			warnings.add("표제부에서 부동산 표시를 찾지 못했습니다.");
		}

		// 말소등기가 가리키는 순위번호를 모아 둔다
		Set<String> cancelledRanks = new LinkedHashSet<>();
		for (Block block : blocks) {
			if (block.purpose().contains("말소")) {
				Matcher m = CANCEL_TARGET.matcher(block.fullText());
				while (m.find()) {
					cancelledRanks.add(block.section().name() + ":" + m.group(1));
				}
			}
		}

		List<RegistryRight> rights = new ArrayList<>();
		int index = 0;
		for (Block block : blocks) {
			if (block.purpose().contains("말소")) {
				// 말소등기 자체는 권리가 아니라 다른 권리를 지우는 기록이다
				continue;
			}
			rights.add(toRight(documentId, block, index++,
					cancelledRanks.contains(block.section().name() + ":" + block.rankNo())));
		}

		long unknownKind = rights.stream().filter(r -> r.getKind() == RightKind.기타).count();
		if (unknownKind > 0) {
			warnings.add("권리 종류를 판별하지 못한 항목이 %d건 있습니다. 원문 대조가 필요합니다.".formatted(unknownKind));
		}
		long noDate = rights.stream().filter(r -> r.getReceivedOn() == null).count();
		if (noDate > 0) {
			warnings.add("접수일을 읽지 못한 항목이 %d건 있습니다. 선후관계 판단에서 제외됩니다.".formatted(noDate));
		}

		return new ParseResult(rights, propertyDescription, warnings);
	}

	private RegistryRight toRight(UUID documentId, Block block, int index, boolean cancelled) {
		String body = block.fullText();
		LocalDate receivedOn = firstDate(body);
		String receiptNo = firstGroup(RECEIPT_NO, body);
		Long amount = parseAmount(body);
		String holder = parseHolder(body);
		RightKind kind = classify(block.purpose(), body);

		double confidence = 1.0;
		if (receivedOn == null) {
			confidence -= 0.35;
		}
		if (kind == RightKind.기타) {
			confidence -= 0.3;
		}
		if (holder == null) {
			confidence -= 0.15;
		}
		if (receiptNo == null) {
			confidence -= 0.1;
		}
		confidence = Math.max(0, Math.round(confidence * 100) / 100.0);

		String source = body.length() > 1000 ? body.substring(0, 1000) : body;
		return new RegistryRight(documentId, block.section(), index, block.rankNo(), receivedOn, receiptNo,
				block.purpose(), kind, holder, amount, cancelled, source, confidence);
	}

	/**
	 * 순위번호 뒤의 첫 토큰이 등기목적인지 보고, 맞으면 그 토큰을 돌려준다.
	 *
	 * <p>실제 등본은 한 행의 모든 칸이 한 줄로 이어져 나오는 경우가 많다
	 * ("1 소유권보존 2015년3월2일 제12345호 소유자 홍길동 …").
	 * 그래서 줄 전체 길이가 아니라 <b>첫 토큰</b>만 보고 판별한다.
	 * 표 머리글이나 금액만 있는 줄은 여기서 걸러진다.
	 */
	private static String purposeToken(String rest) {
		String head = rest.strip();
		if (head.isEmpty()) {
			return null;
		}
		String token = head.split("\\s+", 2)[0];
		if (token.length() > 30) {
			return null;
		}
		boolean looksRight = token
				.matches(".*(소유권|저당권|전세권|지상권|지역권|임차권|가등기|가처분|가압류|압류|경매|환매|신탁|유치권|말소|변경|이전|보존|설정|회복|등기).*");
		return looksRight ? token : null;
	}

	private static RegistrySection sectionOf(String line) {
		Matcher m = SECTION_MARKER.matcher(line);
		if (!m.find()) {
			return null;
		}
		String token = m.group(1).replaceAll("\\s", "");
		return switch (token) {
			case "표제부" -> RegistrySection.표제부;
			case "갑구" -> RegistrySection.갑구;
			case "을구" -> RegistrySection.을구;
			default -> null;
		};
	}

	/** 등기목적 문자열로 권리 종류를 정한다. 더 좁은 표현을 먼저 본다 */
	static RightKind classify(String purpose, String body) {
		String s = (purpose + " " + body).replaceAll("\\s", "");
		if (s.contains("유치권")) {
			return RightKind.유치권;
		}
		if (s.contains("법정지상권")) {
			return RightKind.법정지상권;
		}
		if (s.contains("예고등기")) {
			return RightKind.예고등기;
		}
		if (s.contains("경매개시결정")) {
			return RightKind.경매개시결정;
		}
		if (s.contains("근저당권")) {
			return RightKind.근저당권;
		}
		if (s.contains("저당권")) {
			return RightKind.저당권;
		}
		if (s.contains("가압류")) {
			return RightKind.가압류;
		}
		if (s.contains("압류")) {
			return RightKind.압류;
		}
		if (s.contains("가처분")) {
			return RightKind.가처분;
		}
		if (s.contains("전세권")) {
			return RightKind.전세권;
		}
		if (s.contains("임차권")) {
			return RightKind.임차권;
		}
		if (s.contains("지역권")) {
			return RightKind.지역권;
		}
		if (s.contains("지상권")) {
			return RightKind.지상권;
		}
		if (s.contains("환매")) {
			return RightKind.환매특약;
		}
		if (s.contains("가등기")) {
			// 담보가등기는 말소기준권리가 되지만, 소유권이전청구권 가등기는 선순위면 인수된다
			return s.contains("담보") ? RightKind.담보가등기 : RightKind.소유권이전가등기;
		}
		if (s.contains("소유권이전") || s.contains("소유권보존")) {
			return RightKind.소유권이전;
		}
		return RightKind.기타;
	}

	private static LocalDate firstDate(String body) {
		Matcher m = DATE.matcher(body);
		if (!m.find()) {
			return null;
		}
		try {
			return LocalDate.of(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)));
		} catch (NumberFormatException | DateTimeException e) {
			return null;
		}
	}

	private static Long parseAmount(String body) {
		Matcher m = AMOUNT.matcher(body);
		if (!m.find()) {
			return null;
		}
		try {
			return Long.parseLong(m.group(1).replace(",", ""));
		} catch (NumberFormatException e) {
			return null;
		}
	}

	private static String parseHolder(String body) {
		Matcher m = HOLDER.matcher(body);
		if (!m.find()) {
			return null;
		}
		String value = m.group(2).strip();
		// 주소가 이어 붙는 경우가 많아 첫 토큰만 취한다
		int cut = value.indexOf("  ");
		if (cut > 0) {
			value = value.substring(0, cut);
		}
		value = value.replaceAll("[,·]$", "").strip();
		return value.isEmpty() ? null : value;
	}

	private static String firstGroup(Pattern pattern, String body) {
		Matcher m = pattern.matcher(body);
		return m.find() ? m.group(1) : null;
	}

	/** 파싱 중인 등기 항목 하나 */
	private static final class Block {
		private final RegistrySection section;
		private final String rankNo;
		private final String purpose;
		private final StringBuilder rest = new StringBuilder();

		Block(RegistrySection section, String rankNo, String purpose, String firstLine) {
			this.section = section;
			this.rankNo = rankNo;
			this.purpose = purpose;
			this.rest.append(firstLine).append('\n');
		}

		void append(String line) {
			rest.append(line).append('\n');
		}

		RegistrySection section() {
			return section;
		}

		String rankNo() {
			return rankNo;
		}

		String purpose() {
			return purpose;
		}

		String fullText() {
			return rest.toString();
		}
	}
}
