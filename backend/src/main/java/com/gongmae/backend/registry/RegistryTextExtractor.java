package com.gongmae.backend.registry;

import java.io.IOException;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;

/**
 * 등본 PDF에서 텍스트를 꺼낸다. 설계 문서 §6.1
 *
 * <p>인터넷등기소에서 받은 PDF는 보통 텍스트가 살아 있어 그대로 추출된다.
 * 스캔본이면 텍스트가 거의 없는데, 그때는 OCR 단계가 필요하다는 뜻이므로
 * 여기서 추측해 채우지 않고 {@code textExtracted=false} 로 돌려준다.
 */
@Component
public class RegistryTextExtractor {

	/** 이 글자 수 미만이면 텍스트 레이어가 없는 스캔본으로 본다 */
	private static final int MIN_MEANINGFUL_CHARS = 200;

	public record Extraction(String text, int pageCount, boolean textExtracted) {
	}

	public Extraction extract(byte[] pdfBytes) throws IOException {
		try (PDDocument document = Loader.loadPDF(pdfBytes)) {
			PDFTextStripper stripper = new PDFTextStripper();
			stripper.setSortByPosition(true);
			String text = stripper.getText(document);
			String normalized = normalize(text);
			boolean extracted = normalized.replaceAll("\\s", "").length() >= MIN_MEANINGFUL_CHARS;
			return new Extraction(normalized, document.getNumberOfPages(), extracted);
		}
	}

	/** 등기부등본은 칸 맞춤 때문에 공백이 많이 들어간다. 줄 단위로만 정리한다 */
	private static String normalize(String text) {
		if (text == null) {
			return "";
		}
		return text.replace("\r\n", "\n")
				.replace(' ', ' ')
				.lines()
				.map(line -> line.replaceAll("[ \\t]+", " ").strip())
				.reduce(new StringBuilder(), (sb, line) -> sb.append(line).append('\n'), StringBuilder::append)
				.toString()
				.strip();
	}
}
