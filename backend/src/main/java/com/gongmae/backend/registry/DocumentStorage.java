package com.gongmae.backend.registry;

import java.io.IOException;

/**
 * 등본 원문을 보관하는 자리. 지금은 로컬 디스크 구현만 있고, 운영에서는 S3 구현으로 바꿔 끼운다.
 *
 * <p>원문은 분석 결과와 달리 공유 대상이 아니다. 저장 위치를 이 인터페이스 뒤에 숨겨 두어,
 * 보관 정책(암호화·보존기간·접근 통제)을 한 곳에서 바꿀 수 있게 한다.
 */
public interface DocumentStorage {

	/** 원문을 저장하고 저장 키를 돌려준다 */
	String store(String contentHash, String originalFilename, byte[] bytes) throws IOException;

	byte[] read(String storageKey) throws IOException;

	boolean exists(String storageKey);
}
