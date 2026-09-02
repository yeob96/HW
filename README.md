# 출퇴근 기반 부동산 검색 서비스 (프론트엔드 프로토타입)

`PROJECT.md`의 스펙을 기반으로 한 화면 흐름 프로토타입입니다. 실제 백엔드/외부 API 없이
모든 지역·실거래가 데이터는 목업(mock)으로 생성됩니다.

## 실행

```bash
npm install
npm run dev
```

## 화면 흐름

1. **직장 위치 선택** — 프리셋 거점(강남역, 여의도역, 판교역 등) 중 선택
2. **출퇴근 조건** — 이동수단(대중교통/자차), 최대 소요시간
3. **예산 조건** — 거래유형(매매/전세/월세), 가격대
4. **결과** — 조건에 맞는 지역을 지도(플레이스홀더)와 목록에 표시
5. **지역 상세** — 소요시간, 최근 실거래 목록, 가격 추이 차트

## 목업 데이터 안내

- 좌표 기반 소요시간은 카카오모빌리티/ODsay 연동 대신 직선거리 기반 추정치입니다 ([geo.ts](src/utils/geo.ts)).
- 실거래가는 지역·거래유형 시드 기반으로 결정론적으로 생성됩니다 ([mockTransactions.ts](src/data/mockTransactions.ts)).
- 지도는 실제 카카오맵 SDK 대신 좌표를 정규화해 배치한 플레이스홀더입니다 ([MapPlaceholder.tsx](src/components/MapPlaceholder.tsx)).

## 기술 스택

React + Vite + TypeScript, React Router, Zustand, Tailwind CSS, Recharts
