package com.gongmae.backend.config;

import java.util.concurrent.Executor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/** MQ 대신 쓰는 분석 작업 스레드 풀과, 온비드 수집 스케줄러. 설계 문서 §4.3 */
@Configuration
@EnableAsync
@EnableScheduling
public class AsyncConfig {

	@Bean("analysisExecutor")
	public Executor analysisExecutor() {
		ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
		executor.setCorePoolSize(2);
		executor.setMaxPoolSize(4);
		executor.setQueueCapacity(100);
		executor.setThreadNamePrefix("analysis-");
		executor.initialize();
		return executor;
	}
}
