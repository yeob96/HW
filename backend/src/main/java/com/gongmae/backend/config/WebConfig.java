package com.gongmae.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Vite 개발 서버(기본 5173)에서 직접 호출할 때를 위한 CORS 설정.
 * 개발 중에는 Vite 프록시(/api → 8080)를 쓰므로 보통 걸리지 않지만,
 * 프론트를 다른 포트나 배포 도메인에서 띄울 때를 대비해 열어 둔다.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

	private final String[] allowedOrigins;

	public WebConfig(@Value("${app.cors.allowed-origins}") String[] allowedOrigins) {
		this.allowedOrigins = allowedOrigins;
	}

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/api/**")
				.allowedOrigins(allowedOrigins)
				.allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
				.allowedHeaders("*")
				.maxAge(3600);
	}
}
