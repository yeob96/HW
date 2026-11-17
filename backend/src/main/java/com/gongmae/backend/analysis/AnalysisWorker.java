package com.gongmae.backend.analysis;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.gongmae.backend.registry.AnalysisPayload;
import com.gongmae.backend.registry.DocumentStorage;
import com.gongmae.backend.registry.RegistryDocument;
import com.gongmae.backend.registry.RegistryDocumentRepository;
import com.gongmae.backend.registry.RegistryParser;
import com.gongmae.backend.registry.RegistryRight;
import com.gongmae.backend.registry.RegistryRightRepository;
import com.gongmae.backend.registry.RegistryTextExtractor;
import com.gongmae.backend.registry.RightsAnalyzer;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/**
 * 분석 워크플로를 실제로 돌리는 작업자. MQ 를 붙이면 이 클래스가 컨슈머가 된다.
 *
 * <p>단계를 분리해 각 단계의 실패를 구분해서 기록한다(설계 문서 §4.4·§11).
 * 수집 실패와 법률 판단의 불확실성을 같은 것으로 취급하지 않는다 — 전자는 FAILED,
 * 후자는 결과 안의 "판단 보류"다.
 */
@Component
public class AnalysisWorker {

	private static final Logger log = LoggerFactory.getLogger(AnalysisWorker.class);

	private final AnalysisRequestRepository requests;
	private final AnalysisResultRepository results;
	private final RegistryDocumentRepository documents;
	private final RegistryRightRepository rights;
	private final DocumentStorage storage;
	private final RegistryTextExtractor extractor;
	private final RegistryParser parser;
	private final RightsAnalyzer analyzer;
	private final AnalysisEventPublisher events;
	private final ObjectMapper objectMapper;
	private final Duration cacheTtl;

	public AnalysisWorker(AnalysisRequestRepository requests, AnalysisResultRepository results,
			RegistryDocumentRepository documents, RegistryRightRepository rights, DocumentStorage storage,
			RegistryTextExtractor extractor, RegistryParser parser, RightsAnalyzer analyzer,
			AnalysisEventPublisher events, ObjectMapper objectMapper,
			@Value("${app.analysis.cache-ttl:PT24H}") Duration cacheTtl) {
		this.requests = requests;
		this.results = results;
		this.documents = documents;
		this.rights = rights;
		this.storage = storage;
		this.extractor = extractor;
		this.parser = parser;
		this.analyzer = analyzer;
		this.events = events;
		this.objectMapper = objectMapper;
		this.cacheTtl = cacheTtl;
	}

	/**
	 * analysisId 기준 멱등 처리(§11). 이미 끝난 요청이 다시 들어오면 아무것도 하지 않는다.
	 */
	@Transactional
	public void run(UUID analysisId) {
		AnalysisRequestEntity request = requests.findById(analysisId).orElse(null);
		if (request == null) {
			log.warn("분석 요청을 찾지 못했습니다 analysisId={}", analysisId);
			return;
		}
		if (request.getStatus() != AnalysisStatus.READY) {
			log.info("이미 처리됐거나 처리 중입니다 analysisId={} status={}", analysisId, request.getStatus());
			return;
		}

		request.markProcessing();
		requests.save(request);
		events.publish(request);

		try {
			analyze(request);
			request.markCompleted();
		} catch (AnalysisFailure e) {
			log.info("분석 실패 analysisId={} code={} {}", analysisId, e.code(), e.getMessage());
			request.markFailed(e.code(), e.getMessage());
		} catch (Exception e) {
			log.error("분석 중 예기치 못한 오류 analysisId={}", analysisId, e);
			request.markFailed("UNEXPECTED_ERROR", e.getClass().getSimpleName() + ": " + e.getMessage());
		}

		requests.save(request);
		events.publish(request);
	}

	private void analyze(AnalysisRequestEntity request) {
		UUID documentId = request.getDocumentId();
		if (documentId == null) {
			throw new AnalysisFailure("DOCUMENT_MISSING", "분석에 사용할 등기부등본이 지정되지 않았습니다.");
		}
		RegistryDocument document = documents.findById(documentId)
				.orElseThrow(() -> new AnalysisFailure("DOCUMENT_NOT_FOUND", "등기부등본 기록을 찾지 못했습니다."));

		byte[] bytes;
		try {
			bytes = storage.read(document.getStorageKey());
		} catch (Exception e) {
			throw new AnalysisFailure("DOCUMENT_READ_FAILED", "보관된 등본 원문을 읽지 못했습니다: " + e.getMessage());
		}

		RegistryTextExtractor.Extraction extraction;
		try {
			extraction = extractor.extract(bytes);
		} catch (Exception e) {
			throw new AnalysisFailure("PDF_PARSE_FAILED", "PDF 를 열지 못했습니다: " + e.getMessage());
		}

		RegistryParser.ParseResult parsed = parser.parse(document.getId(), extraction.text());

		// 같은 문서를 다시 분석할 수 있으므로 기존 권리 레코드를 지우고 다시 넣는다
		rights.deleteByDocumentId(document.getId());
		List<RegistryRight> saved = rights.saveAll(parsed.rights());

		AnalysisPayload.DocumentInfo info = new AnalysisPayload.DocumentInfo(document.getOriginalFilename(),
				document.getPageCount(), extraction.textExtracted(), document.getParseVersion(), saved.size());

		RightsAnalyzer.Analysis analysis = analyzer.analyze(saved, parsed.propertyDescription(), parsed.warnings(),
				info);

		String json;
		try {
			json = objectMapper.writeValueAsString(analysis.payload());
		} catch (JacksonException e) {
			throw new AnalysisFailure("RESULT_SERIALIZE_FAILED", "분석 결과를 저장 형식으로 바꾸지 못했습니다.");
		}

		Instant expiresAt = Instant.now().plus(cacheTtl);
		results.save(new AnalysisResultEntity(request.getId(), request.getTargetKey(), document.getId(),
				request.getAnalysisVersion(), analysis.riskLevel(), analysis.headline(), json, expiresAt));
	}

	/** 수집·파싱 단계의 실패. 법률 판단의 불확실성과 구분한다 */
	static class AnalysisFailure extends RuntimeException {

		private final String code;

		AnalysisFailure(String code, String message) {
			super(message);
			this.code = code;
		}

		String code() {
			return code;
		}
	}
}
