# PRD — 핫플레이스 반감기 (Hotplace Half-Life)

> 이 레포의 프론트는 `hotplace-halflife`와 동일한 제품입니다.  
> 데이터 파이프라인(수집·반감기 계산)은 `/Users/shinleehyeon/Dev/Projects/hotplace-halflife/backend`를 사용하세요.

## 한 줄 요약
서울 상권 매출 시계열로 “얼마나 빨리 뜨고 식는가”를 **반감기**로 정량화하고, 지도·대시보드로 시각화한다.

## 핵심 지표
- `relative_share` = 상권 매출 ÷ (동일 업종·분기 시 전역 합)
- peak 이후 smoothed 값이 peak×0.5 이하가 되는 분기 수 × 3 = **반감기(개월)**

## 가설
- H1: 20대 유동비율↑ → 반감기↓ (1차 결과: **기각**)
- H2: 골목상권 반감기 < 발달/전통시장
- H3: 유행 업종 반감기 < 생활밀착 업종

## 데이터 재생성
```bash
cd /Users/shinleehyeon/Dev/Projects/hotplace-halflife/backend
uv run python -m pipeline.run_all
# 산출물: frontend/public/data/*  → 이 레포 frontend/public/data 로 복사
```

발표용 기획서: `docs/분석_아이디어_기획서.md`
