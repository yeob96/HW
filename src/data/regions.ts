import type { RegionBase } from '../types'

// 프로토타입: 실제 실거래가 API 대신 사용하는 목업 지역 데이터
// basePriceEok = 해당 지역 매매 평균 총액(만원)
export const REGIONS: RegionBase[] = [
  { dongCode: '1168010100', regionName: '강남구 역삼동', lat: 37.5006, lng: 127.0364, basePriceEok: 250000 },
  { dongCode: '1165010100', regionName: '서초구 서초동', lat: 37.4837, lng: 127.0324, basePriceEok: 240000 },
  { dongCode: '1171010100', regionName: '송파구 잠실동', lat: 37.5133, lng: 127.1, basePriceEok: 200000 },
  { dongCode: '1144010100', regionName: '마포구 합정동', lat: 37.5495, lng: 126.9137, basePriceEok: 150000 },
  { dongCode: '1156010100', regionName: '영등포구 여의도동', lat: 37.5219, lng: 126.9245, basePriceEok: 180000 },
  { dongCode: '1120010100', regionName: '성동구 성수동1가', lat: 37.5446, lng: 127.0559, basePriceEok: 190000 },
  { dongCode: '1162010100', regionName: '관악구 봉천동', lat: 37.4784, lng: 126.9516, basePriceEok: 90000 },
  { dongCode: '1135010100', regionName: '노원구 상계동', lat: 37.66, lng: 127.0698, basePriceEok: 65000 },
  { dongCode: '1138010100', regionName: '은평구 응암동', lat: 37.5986, lng: 126.9269, basePriceEok: 70000 },
  { dongCode: '1153010100', regionName: '구로구 구로동', lat: 37.4954, lng: 126.8874, basePriceEok: 75000 },
  { dongCode: '1174010100', regionName: '강동구 천호동', lat: 37.5384, lng: 127.1237, basePriceEok: 85000 },
  { dongCode: '1159010100', regionName: '동작구 사당동', lat: 37.4766, lng: 126.9816, basePriceEok: 95000 },
]
