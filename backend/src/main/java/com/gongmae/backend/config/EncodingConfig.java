package com.gongmae.backend.config;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.filter.CharacterEncodingFilter;

/**
 * 요청·응답 인코딩을 UTF-8 로 고정한다.
 *
 * <p><b>주의 — multipart/form-data 의 텍스트 파트는 이 필터로 해결되지 않는다.</b>
 * 실측 결과, Tomcat 은 파트를 디코딩할 때 {@code request.setCharacterEncoding} 으로 지정한 값도,
 * 파트 자체에 붙인 {@code charset} 도 쓰지 않았다. 그래서 "2025타경86319-1" 을 폼 필드로 보내면
 * U+FFFD 가 섞인 깨진 문자열이 되고, 바이트가 이미 소실돼 되돌릴 수도 없다.
 *
 * <p>그래서 한글이 들어가는 식별자는 <b>쿼리 파라미터</b>로 받는다
 * (Tomcat 의 URI 인코딩은 UTF-8 이라 안전하다). {@code AnalysisController#request} 참고.
 * 이 필터는 일반 폼 요청과 응답 인코딩을 위해 남겨 둔다.
 */
@Configuration
public class EncodingConfig {

	@Bean
	public FilterRegistrationBean<CharacterEncodingFilter> utf8EncodingFilter() {
		CharacterEncodingFilter filter = new CharacterEncodingFilter("UTF-8", true, true);
		FilterRegistrationBean<CharacterEncodingFilter> registration = new FilterRegistrationBean<>(filter);
		registration.addUrlPatterns("/*");
		registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
		return registration;
	}
}
