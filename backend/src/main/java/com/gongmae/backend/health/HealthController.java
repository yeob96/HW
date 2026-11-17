package com.gongmae.backend.health;

import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 프론트 ↔ 백엔드 연결 확인용 health check.
 * 액추에이터의 /actuator/health 와 달리, 프론트가 그대로 찍어볼 수 있는 모양으로 내려준다.
 */
@RestController
@RequestMapping("/api")
public class HealthController {

	private final Environment environment;
	private final String applicationName;

	public HealthController(Environment environment, @Value("${spring.application.name}") String applicationName) {
		this.environment = environment;
		this.applicationName = applicationName;
	}

	public record HealthResponse(String status, String name, List<String> profiles, String time) {
	}

	@GetMapping("/health")
	public HealthResponse health() {
		String[] active = environment.getActiveProfiles();
		List<String> profiles = active.length > 0
				? List.of(active)
				: List.of(environment.getDefaultProfiles());
		return new HealthResponse("UP", applicationName, profiles, OffsetDateTime.now().toString());
	}
}
