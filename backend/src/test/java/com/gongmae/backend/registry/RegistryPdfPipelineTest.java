package com.gongmae.backend.registry;

import static org.assertj.core.api.Assumptions.assumeThat;
import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * PDF → 텍스트 → 권리 레코드까지 실제 PDF 로 통과시키는 검증.
 *
 * <p>단위 테스트가 다루지 못하는 구간(PDFBox 텍스트 추출)이 여기서 걸린다.
 * 겸사겸사 {@code build/sample-registry.pdf} 를 남겨 두어 업로드 화면을 손으로 확인할 때 쓴다.
 *
 * <p>한글 PDF 를 만들려면 한글 폰트가 필요하다. 없는 환경에서는 테스트를 건너뛴다.
 */
class RegistryPdfPipelineTest {

	private static final String[] LINES = {
			"【 표 제 부 】 ( 1동의 건물의 표시 )",
			"서울특별시 강남구 역삼동 123-45 래미안아파트 제101동 제12층 제1201호",
			"【 갑 구 】 ( 소유권에 관한 사항 )",
			"순위번호 등 기 목 적 접 수 등 기 원 인 권리자 및 기타사항",
			"1 소유권보존 2015년3월2일 제12345호 소유자 홍길동 서울특별시 강남구",
			"2 소유권이전 2018년5월7일 제23456호 매매 소유자 김철수 서울특별시 서초구",
			"3 가압류 2022년8월1일 제34567호 청구금액 금50,000,000원 채권자 주식회사 한빛",
			"4 임의경매개시결정 2024년2월3일 제45678호 채권자 우리은행",
			"【 을 구 】 ( 소유권 이외의 권리에 관한 사항 )",
			"순위번호 등 기 목 적 접 수 등 기 원 인 권리자 및 기타사항",
			"1 전세권설정 2017년1월5일 제20001호 전세금 금150,000,000원 전세권자 박영희",
			"2 근저당권설정 2019년6월10일 제30001호 채권최고액 금240,000,000원 근저당권자 국민은행",
			"3 근저당권설정 2023년3월9일 제40001호 채권최고액 금100,000,000원 근저당권자 하나캐피탈",
	};

	private static final String[] FONT_CANDIDATES = {
			"C:/Windows/Fonts/malgun.ttf",
			"/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
			"/System/Library/Fonts/AppleSDGothicNeo.ttc",
	};

	private static File findKoreanFont() {
		for (String candidate : FONT_CANDIDATES) {
			File file = new File(candidate);
			if (file.isFile()) {
				return file;
			}
		}
		return null;
	}

	private byte[] buildPdf(File font) throws IOException {
		try (PDDocument document = new PDDocument()) {
			PDPage page = new PDPage(PDRectangle.A4);
			document.addPage(page);
			PDType0Font korean = PDType0Font.load(document, font);

			try (PDPageContentStream content = new PDPageContentStream(document, page)) {
				content.beginText();
				content.setFont(korean, 9);
				content.setLeading(16f);
				content.newLineAtOffset(40, PDRectangle.A4.getHeight() - 60);
				for (String line : LINES) {
					content.showText(line);
					content.newLine();
				}
				content.endText();
			}

			ByteArrayOutputStream out = new ByteArrayOutputStream();
			document.save(out);
			return out.toByteArray();
		}
	}

	@Test
	@DisplayName("실제 PDF에서 텍스트를 뽑아 권리 레코드까지 만든다")
	void extractsAndParsesRealPdf() throws IOException {
		File font = findKoreanFont();
		assumeThat(font).as("한글 폰트가 있어야 한글 PDF를 만들 수 있다").isNotNull();

		byte[] pdf = buildPdf(font);

		// 업로드 화면을 손으로 확인할 때 쓰도록 남겨 둔다
		Path output = Paths.get("build", "sample-registry.pdf");
		Files.createDirectories(output.getParent());
		Files.write(output, pdf);

		RegistryTextExtractor extractor = new RegistryTextExtractor();
		RegistryTextExtractor.Extraction extraction = extractor.extract(pdf);

		assertThat(extraction.pageCount()).isEqualTo(1);
		assertThat(extraction.textExtracted()).as("텍스트 레이어가 살아 있어야 한다").isTrue();
		assertThat(extraction.text()).contains("갑 구").contains("근저당권설정");

		RegistryParser.ParseResult parsed = new RegistryParser().parse(UUID.randomUUID(), extraction.text());
		assertThat(parsed.rights()).as("표 머리글을 뺀 등기 항목 7건").hasSize(7);

		RightsAnalyzer.Analysis analysis = new RightsAnalyzer().analyze(parsed.rights(),
				parsed.propertyDescription(), parsed.warnings(),
				new AnalysisPayload.DocumentInfo("sample-registry.pdf", extraction.pageCount(),
						extraction.textExtracted(), RegistryParser.PARSE_VERSION, parsed.rights().size()));

		assertThat(analysis.payload().baseRight().found()).isTrue();
		assertThat(analysis.payload().baseRight().kind()).isEqualTo("근저당권");
		assertThat(analysis.riskLevel()).isEqualTo("HIGH");
	}

	@Test
	@DisplayName("텍스트가 없는 PDF는 스캔본으로 보고 OCR 필요를 알린다")
	void flagsScannedPdfWithoutTextLayer() throws IOException {
		byte[] blank;
		try (PDDocument document = new PDDocument()) {
			document.addPage(new PDPage(PDRectangle.A4));
			ByteArrayOutputStream out = new ByteArrayOutputStream();
			document.save(out);
			blank = out.toByteArray();
		}

		RegistryTextExtractor.Extraction extraction = new RegistryTextExtractor().extract(blank);
		assertThat(extraction.textExtracted()).isFalse();
	}
}
