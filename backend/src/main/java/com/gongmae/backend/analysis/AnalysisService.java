package com.gongmae.backend.analysis;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.gongmae.backend.registry.DocumentStorage;
import com.gongmae.backend.registry.RegistryDocument;
import com.gongmae.backend.registry.RegistryDocumentRepository;
import com.gongmae.backend.registry.RegistryParser;
import com.gongmae.backend.registry.RegistryTextExtractor;
import com.gongmae.backend.registry.RightsAnalyzer;

/**
 * 분석 요청 접수와 조회. 설계 문서 §4.1·§4.2
 *
 * <p>24시간 캐시 정책이 여기 들어 있다. 같은 물건에 대해 아직 만료되지 않은 결과가 있으면
 * 등본을 다시 올리지 않아도 그 결과를 돌려준다. 만료된 뒤에 누르면 수집부터 다시 시작한다.
 */
@Service
public class AnalysisService {

	public static final String TYPE_REGISTRY = "REGISTRY";

	private final AnalysisRequestRepository requests;
	private final AnalysisResultRepository results;
	private final RegistryDocumentRepository documents;
	private final DocumentStorage storage;
	private final RegistryTextExtractor extractor;
	private final AnalysisDispatcher dispatcher;

	public AnalysisService(AnalysisRequestRepository requests, AnalysisResultRepository results,
			RegistryDocumentRepository documents, DocumentStorage storage, RegistryTextExtractor extractor,
			AnalysisDispatcher dispatcher) {
		this.requests = requests;
		this.results = results;
		this.documents = documents;
		this.storage = storage;
		this.extractor = extractor;
		this.dispatcher = dispatcher;
	}

	/** 접수 결과 — 새로 시작했는지, 캐시를 돌려주는지, 이미 진행 중인지 */
	public record Ticket(UUID analysisId, String targetKey, AnalysisStatus status, Origin origin, Instant cachedUntil) {

		public enum Origin {
			/** 새로 분석을 시작했다 */
			STARTED,
			/** 24시간 캐시가 살아 있어 그대로 돌려준다 */
			CACHED,
			/** 같은 물건에 대한 분석이 이미 진행 중이라 거기에 붙인다 */
			IN_PROGRESS
		}
	}

	public static class RequestRejected extends RuntimeException {

		public RequestRejected(String message) {
			super(message);
		}
	}

	/** 만료되지 않은 캐시 결과 */
	public Optional<AnalysisResultEntity> findFreshResult(String targetKey) {
		return results.findFirstByTargetKeyAndAnalysisVersionAndExpiresAtAfterOrderByCreatedAtDesc(
				targetKey, RightsAnalyzer.ANALYSIS_VERSION, Instant.now());
	}

	public Optional<AnalysisRequestEntity> findRequest(UUID analysisId) {
		return requests.findById(analysisId);
	}

	public Optional<AnalysisResultEntity> findResult(UUID analysisId) {
		return results.findById(analysisId);
	}

	/**
	 * 분석 요청. 등본 파일은 캐시가 없을 때만 필요하다.
	 *
	 * @param fileBytes null 이면 캐시 조회만 한다
	 */
	public Ticket request(String targetKey, String filename, byte[] fileBytes, String requestedBy) {
		String key = normalizeTargetKey(targetKey);

		// 1) 24시간 캐시가 살아 있으면 분석하지 않는다
		Optional<AnalysisResultEntity> cached = findFreshResult(key);
		if (cached.isPresent()) {
			AnalysisResultEntity result = cached.get();
			return new Ticket(result.getId(), key, AnalysisStatus.COMPLETED, Ticket.Origin.CACHED,
					result.getExpiresAt());
		}

		// 2) 이미 진행 중인 분석이 있으면 거기에 붙인다 (중복 실행 방지, §4.2)
		List<AnalysisRequestEntity> inFlight = requests.findByTargetKeyAndStatusIn(key,
				List.of(AnalysisStatus.READY, AnalysisStatus.PROCESSING));
		if (!inFlight.isEmpty()) {
			AnalysisRequestEntity existing = inFlight.get(0);
			return new Ticket(existing.getId(), key, existing.getStatus(), Ticket.Origin.IN_PROGRESS, null);
		}

		// 3) 새로 분석하려면 등본이 필요하다
		if (fileBytes == null || fileBytes.length == 0) {
			throw new RequestRejected("이 물건의 저장된 분석 결과가 없거나 만료됐습니다. 등기부등본 PDF 를 올려야 분석할 수 있습니다.");
		}

		RegistryDocument document = storeDocument(filename, fileBytes, requestedBy);

		AnalysisRequestEntity request = new AnalysisRequestEntity(key, document.getId(), requestedBy, TYPE_REGISTRY,
				RightsAnalyzer.ANALYSIS_VERSION);
		requests.save(request);

		// 저장이 끝난 뒤에 작업을 넘긴다 — 작업자가 레코드를 못 찾는 상황을 막는다
		dispatcher.enqueue(request.getId());

		return new Ticket(request.getId(), key, request.getStatus(), Ticket.Origin.STARTED, null);
	}

	private RegistryDocument storeDocument(String filename, byte[] bytes, String uploadedBy) {
		String hash = sha256(bytes);

		// 같은 등본을 이미 올린 적이 있으면 그 기록을 쓴다
		Optional<RegistryDocument> existing = documents.findByContentHash(hash);
		if (existing.isPresent() && storage.exists(existing.get().getStorageKey())) {
			return existing.get();
		}

		int pageCount;
		boolean textExtracted;
		try {
			RegistryTextExtractor.Extraction extraction = extractor.extract(bytes);
			pageCount = extraction.pageCount();
			textExtracted = extraction.textExtracted();
		} catch (Exception e) {
			throw new RequestRejected("PDF 를 열지 못했습니다. 등기부등본 PDF 파일인지 확인해주세요.");
		}

		String storageKey;
		try {
			storageKey = storage.store(hash, filename, bytes);
		} catch (IOException e) {
			throw new RequestRejected("등본을 보관하지 못했습니다: " + e.getMessage());
		}

		return documents.save(new RegistryDocument(hash, filename, bytes.length, storageKey, pageCount,
				RegistryParser.PARSE_VERSION, textExtracted, uploadedBy));
	}

	private static String normalizeTargetKey(String targetKey) {
		if (targetKey == null || targetKey.isBlank()) {
			throw new RequestRejected("대상 물건 식별자가 필요합니다.");
		}
		String key = targetKey.strip();
		if (key.length() > 100) {
			throw new RequestRejected("대상 물건 식별자가 너무 깁니다.");
		}
		// 멀티파트 폼 필드로 보내면 Tomcat 이 ISO-8859-1 로 디코딩해 한글이 깨진다(복구 불가).
		// 조용히 깨진 값으로 분석하느니 여기서 막고 올바른 보내는 법을 알려준다.
		if (key.indexOf('�') >= 0) {
			throw new RequestRejected("물건 식별자의 글자가 깨졌습니다. targetKey 는 폼 필드가 아니라 쿼리 파라미터로 보내주세요.");
		}
		return key;
	}

	private static String sha256(byte[] bytes) {
		try {
			return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException("SHA-256 을 쓸 수 없습니다.", e);
		}
	}
}
