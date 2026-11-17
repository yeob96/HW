package com.gongmae.backend.registry;

/** 등기부등본의 구(區) 구분. 설계 문서 §6.2 */
public enum RegistrySection {
	/** 표제부 — 부동산의 표시 */
	표제부,
	/** 갑구 — 소유권에 관한 사항 */
	갑구,
	/** 을구 — 소유권 외의 권리에 관한 사항 */
	을구
}
