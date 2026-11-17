package com.gongmae.backend.analysis;

import java.io.IOException;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 등기 분석 API. 설계 문서 §4.1·§10.2
 *
 * <p>흐름: POST /api/analyses 로 접수 → SSE 로 상태 구독 → 완료되면 GET 으로 결과 조회.
 * SSE 를 놓쳐도 GET /api/analyses/{id} 로 현재 상태를 다시 확인할 수 있다.
 */
@RestController
@RequestMapping("/api/analyses")
public class AnalysisController {

	private final AnalysisService service;
	private final AnalysisEventPublisher events;
	private final ObjectMapper objectMapper;

	public AnalysisController(AnalysisService service, AnalysisEventPublisher events, ObjectMapper objectMapper) {
		this.service = service;
		this.events = events;
		this.objectMapper = objectMapper;
	}

	public record TicketResponse(UUID analysisId, String targetKey, AnalysisStatus status, String origin,
			Instant cachedUntil, String message) {
	}

	public record AnalysisView(UUID analysisId, String targetKey, AnalysisStatus status, Instant requestedAt,
			Instant startedAt, Instant completedAt, String errorCode, String errorSummary, String riskLevel,
			String headline, Instant cachedUntil, JsonNode result) {
	}

	public record ErrorResponse(String message) {
	}

	/**
	 * 분석 접수. 24시간 캐시가 살아 있으면 파일 없이도 결과를 받는다.
	 * 캐시가 없거나 만료됐으면 등기부등본 PDF 가 필요하다.
	 *
	 * <p><b>{@code targetKey} 는 쿼리 파라미터로 보낸다.</b> 사건번호에 한글("타경")이 들어가는데,
	 * 멀티파트 폼 필드로 보내면 Tomcat 이 ISO-8859-1 로 디코딩해 글자가 깨진다(EncodingConfig 참고).
	 * 예: {@code POST /api/analyses?targetKey=2025타경86319-1} + 본문에 파일만.
	 */
	// consumes 를 multipart 로 묶지 않는다. 캐시가 살아 있을 때는 파일 없이 부르는 것이 정상 흐름이라,
	// 본문 없는 요청까지 받아야 한다 (묶어 두면 415 가 난다).
	@PostMapping
	public ResponseEntity<TicketResponse> request(@RequestParam("targetKey") String targetKey,
			@RequestParam(value = "file", required = false) MultipartFile file,
			@RequestParam(value = "requestedBy", required = false) String requestedBy) throws IOException {

		byte[] bytes = (file != null && !file.isEmpty()) ? file.getBytes() : null;
		String filename = (file != null) ? file.getOriginalFilename() : null;

		AnalysisService.Ticket ticket = service.request(targetKey, filename, bytes, requestedBy);
		String message = switch (ticket.origin()) {
			case CACHED -> "24시간 안에 분석된 결과가 있어 그대로 보여드립니다.";
			case IN_PROGRESS -> "같은 물건을 이미 분석하고 있습니다. 진행 중인 분석에 연결했습니다.";
			case STARTED -> "분석을 시작했습니다.";
		};

		HttpStatus status = ticket.origin() == AnalysisService.Ticket.Origin.STARTED
				? HttpStatus.ACCEPTED
				: HttpStatus.OK;

		return ResponseEntity.status(status).body(new TicketResponse(ticket.analysisId(), ticket.targetKey(),
				ticket.status(), ticket.origin().name(), ticket.cachedUntil(), message));
	}

	/** 현재 상태와 (완료됐다면) 결과 */
	@GetMapping("/{analysisId}")
	public ResponseEntity<AnalysisView> get(@PathVariable UUID analysisId) {
		Optional<AnalysisRequestEntity> request = service.findRequest(analysisId);
		Optional<AnalysisResultEntity> result = service.findResult(analysisId);

		if (request.isEmpty() && result.isEmpty()) {
			return ResponseEntity.notFound().build();
		}
		return ResponseEntity.ok(toView(request.orElse(null), result.orElse(null)));
	}

	/** 물건 기준 조회 — 24시간 캐시가 살아 있으면 그 결과 */
	@GetMapping("/by-target/{targetKey}")
	public ResponseEntity<AnalysisView> getByTarget(@PathVariable String targetKey) {
		return service.findFreshResult(targetKey)
				.map(result -> ResponseEntity.ok(toView(service.findRequest(result.getId()).orElse(null), result)))
				.orElseGet(() -> ResponseEntity.notFound().build());
	}

	/** 상태 변경 스트림. 결과 본문은 싣지 않는다(§10.2) */
	@GetMapping(value = "/{analysisId}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
	public SseEmitter events(@PathVariable UUID analysisId) {
		return events.subscribe(analysisId);
	}

	private AnalysisView toView(AnalysisRequestEntity request, AnalysisResultEntity result) {
		JsonNode payload = null;
		if (result != null) {
			try {
				payload = objectMapper.readTree(result.getPayloadJson());
			} catch (JacksonException e) {
				payload = null;
			}
		}
		AnalysisStatus status = request != null ? request.getStatus()
				: (result != null ? AnalysisStatus.COMPLETED : AnalysisStatus.FAILED);

		return new AnalysisView(
				request != null ? request.getId() : result.getId(),
				request != null ? request.getTargetKey() : result.getTargetKey(),
				status,
				request != null ? request.getRequestedAt() : null,
				request != null ? request.getStartedAt() : null,
				request != null ? request.getCompletedAt() : null,
				request != null ? request.getErrorCode() : null,
				request != null ? request.getErrorSummary() : null,
				result != null ? result.getRiskLevel() : null,
				result != null ? result.getHeadline() : null,
				result != null ? result.getExpiresAt() : null,
				payload);
	}

	@ExceptionHandler(AnalysisService.RequestRejected.class)
	public ResponseEntity<ErrorResponse> handleRejected(AnalysisService.RequestRejected e) {
		return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage()));
	}
}
