# SEIL 생산관리 데모 대시보드 - 구현 계획서

## 1. 프로젝트 개요

### 목적
seil 회사의 생산 데이터를 시각화하여 **생산관리 감독 페이지(Admin Dashboard)** 샘플을 제공한다.
현재 수기 엑셀 입력 방식의 비효율성을 개선할 수 있음을 보여주는 것이 핵심 목표.

### 기술 스택
| 구분 | 기술 |
|------|------|
| 프론트엔드 | **Next.js 14 (App Router)** + TypeScript |
| UI 프레임워크 | **Tailwind CSS** + **shadcn/ui** |
| 차트 | **Recharts** (React 친화, 클릭 이벤트 지원) |
| DB | **Supabase** (PostgreSQL) |
| AI | **Claude API** (Anthropic) - 차트 설명 + 종합 인사이트 |
| 배포 | **Vercel** (git push 자동 배포) |
| 상태관리 | React Server Components + Client hooks |

### 선택 이유
- Next.js App Router: SSR/SSG로 초기 로딩 빠름, API Routes로 백엔드 불필요
- shadcn/ui: 반응형 기본 지원, 복사-수정 방식이라 커스터마이징 자유
- Recharts: onClick 이벤트 내장 → 차트 클릭 시 팝업 구현 용이
- Supabase JS Client: RLS 없이 anon key로 바로 CRUD 가능 (데모용)

---

## 2. 데이터 현황

### 테이블 구조
| 테이블 | 행 수 | 설명 |
|--------|-------|------|
| `dim_equipment` | 22 | 설비 마스터 (HRP-8온스, 열접착3호 등) |
| `dim_product` | 324 | 제품 마스터 (코드, 이름, RPM, 기준생산량) |
| `dim_erp_item` | 870 | ERP 전품목 (대/중/소분류, 단가) |
| `fact_production` | 7,714 | 생산 실적 (2020-01 ~ 2026-03) |

### 핵심 컬럼 (fact_production)
- `production_date`: 생산일
- `product_code` / `product_name`: 제품
- `finished_qty` / `produced_qty` / `defect_qty`: 완성/생산/불량 수량
- `equipment_name`: 사용 설비
- `work_start_hhmm` / `work_end_hhmm` / `work_minutes`: 작업 시간
- `tech_worker` / `pack_workers`: 기술자/포장 작업자
- `work_specification` (JSONB): 작업자 역할별 상세

---

## 3. 페이지 구성 (총 6개 페이지)

### 3.1 사이드바 네비게이션
```
📊 대시보드
  ├─ 메인 대시보드
  ├─ 일보 (일일보고)
  ├─ 생산보고
  └─ 🤖 AI 인사이트
📋 데이터 관리
  ├─ 장비 관리
  ├─ 제품 관리
  ├─ ERP 제품표
  └─ 생산기록 관리
```

### 3.2 메인 대시보드 (`/`)
**목적**: 경영진/회장이 한눈에 생산 현황 파악

**차트 구성**:
1. **KPI 카드 (상단 4개)**
   - 오늘 총 생산량 | 가동 설비 수 | 불량률 | 전일 대비 증감
2. **일별 생산량 추이** (AreaChart, 최근 30일)
   - 클릭 시 해당일 생산 상세 테이블 팝업
3. **설비별 생산량 분포** (BarChart, 당월)
   - 클릭 시 해당 설비의 제품별 생산 내역 팝업
4. **제품별 생산 비율** (PieChart, 당월 TOP 10)
   - 클릭 시 해당 제품의 일별 생산 내역 팝업
5. **설비 가동률 현황** (BarChart, 수평)
   - 기준생산량 대비 실제 생산량 비율
6. **월별 생산량 트렌드** (LineChart, 최근 12개월)

### 3.3 일보 페이지 (`/daily-report`)
**목적**: 원본 엑셀의 "일보" 시트를 웹으로 재현

**구성**:
- 날짜 선택 (DatePicker, 기본값: 오늘)
- 설비별 카드 레이아웃 (21개 설비)
  - 각 카드: 설비명, 생산품명, 생산량, 기준량, 수율, 작업시간, 작업자
- 상단 요약: 총 생산량, 가동 설비 수, 작업자 현황 (포장/기술/기타)
- 비고 영역: 지게차, 박스포장, 연차 등 메모

### 3.4 생산보고 페이지 (`/production-report`)
**목적**: 원본 엑셀의 "생산보고" 시트를 웹으로 재현

**구성**:
- 날짜 선택
- 테이블 형태 (원본 엑셀과 유사)
  - NO | 설비명 | 생산품명 | 기준수량 | 생산수량 | 가동율 | 작업시간(시작/종료/가동) | 불량(수량/율) | 작업자(기술/포장) | 비고
- 하단 합계 행
- PDF/엑셀 내보내기 버튼

### 3.5 AI 인사이트 페이지 (`/ai-insight`)
**목적**: Claude API를 활용한 종합 생산 분석 리포트

**구성**:
- 기간 선택 (기본: 최근 1개월)
- "분석 시작" 버튼 클릭 시 Claude API 호출
- **분석 영역 3가지**:
  1. **생산 효율 분석**: 설비별 가동률 트렌드, 병목 설비 탐지, 최적 생산 스케줄 제안
  2. **품질/불량 분석**: 불량률 패턴, 불량 발생 조건 탐지, 품질 개선 포인트
  3. **작업자 생산성**: 기술자별 생산량 비교, 최적 작업 조합 제안
- 결과는 마크다운 렌더링으로 가독성 높게 표시
- "다시 분석" 버튼으로 재생성 가능

**AI 호출 방식**:
- Next.js API Route (`/api/ai/insight`)에서 서버사이드 호출
- Supabase에서 해당 기간 데이터 집계 → Claude에게 JSON으로 전달 → 분석 결과 반환
- 스트리밍 응답으로 사용자 대기 시간 최소화

### 3.6 AI 차트 코멘트 (일보/생산보고 공통)
- 각 차트 하단에 💡 아이콘과 함께 2~3줄 AI 코멘트 표시
- 페이지 로딩 시 해당 날짜 데이터를 기반으로 Claude API 호출
- 예시: "오늘 열접착3호 가동률이 80%로 평소(92%) 대비 낮습니다. 원자재 공급 확인이 필요합니다."
- 로딩 중에는 스켈레톤 UI 표시

### 3.7 데이터 관리 - CRUD 페이지들

#### 공통 UI 패턴
- 리스트: shadcn DataTable (검색, 정렬, 페이지네이션)
- 생성/수정: shadcn Dialog (모달 폼)
- 삭제: 확인 다이얼로그
- 반응형: 모바일에서는 카드형 리스트

#### 3.5.1 장비 관리 (`/admin/equipment`)
- 필드: 설비ID, 기존명, 공식명, 약칭, 비고, 제조사, 제조국
- 기본값: equipment_id 자동 증가
- 22개 데이터라 단순 테이블로 충분

#### 3.5.2 제품 관리 (`/admin/products`)
- 필드: 제품코드, 제품명, 입수량, RPM, 설비명, 원자재, 일최대생산량
- **자동완성**: 설비명 → dim_equipment에서 드롭다운
- 324개 데이터 → 검색 + 페이지네이션 필요

#### 3.5.3 ERP 제품표 (`/admin/erp-items`)
- 필드: 품목코드, 품명, 대/중/소분류, 규격, 과세유형, 매입/매출단가, 단종여부, 비고
- **자동완성**: 대분류→중분류→소분류 연쇄 드롭다운
- 870개 데이터 → 서버사이드 검색 권장

#### 3.5.4 생산기록 관리 (`/admin/production`)
- 필드: 전체 fact_production 컬럼
- **기본값**:
  - production_date: 오늘
  - year_month: 자동 계산
  - production_type: "생산" (기본)
- **자동완성**:
  - product_code 입력 시 → product_name, equipment_name 자동 채움
  - equipment_name → dim_equipment 드롭다운
  - tech_worker, pack_workers → 기존 작업자명 자동완성
- **편의 기능**:
  - work_start_hhmm/work_end_hhmm 입력 시 → work_minutes 자동 계산
  - 이전 기록 복사 버튼

---

## 4. 차트 클릭 → 상세 팝업 설계

모든 차트에 공통 적용되는 팝업 패턴:

```
[차트 영역 클릭]
  → Dialog 열림
  → 제목: "2026-03-05 생산 상세" (클릭한 맥락)
  → 내용: DataTable (정렬/검색 가능)
  → 컬럼: 날짜, 설비, 제품명, 생산량, 불량, 작업자 등
  → 하단: CSV 다운로드 버튼
```

---

## 5. 반응형 설계

| 구분 | Desktop (≥1024px) | Mobile (<1024px) |
|------|-------------------|------------------|
| 네비게이션 | 사이드바 고정 | 햄버거 메뉴 → 드로어 |
| KPI 카드 | 4열 | 2열 |
| 차트 | 2열 그리드 | 1열 풀폭 |
| 데이터 테이블 | 전체 컬럼 | 핵심 컬럼만 + 가로 스크롤 |
| CRUD 폼 | 2열 그리드 | 1열 스택 |
| 팝업 | 중앙 Dialog (60%) | 풀스크린 Sheet |

---

## 6. 구현 순서 (토큰 효율 극대화)

### Phase 1: 프로젝트 초기화 + 공통 레이아웃
1. `npx create-next-app` (TypeScript, Tailwind, App Router)
2. shadcn/ui 초기화 + 필수 컴포넌트 설치
3. Supabase 클라이언트 설정
4. 공통 레이아웃 (사이드바 + 반응형)
5. 공통 타입 정의 (DB 스키마 → TypeScript 인터페이스)

### Phase 2: CRUD 페이지 (재사용 컴포넌트 우선)
6. DataTable 공통 컴포넌트 (검색, 정렬, 페이지네이션)
7. CRUD Dialog 공통 컴포넌트
8. 장비 관리 (가장 단순 → 패턴 확립)
9. 제품 관리
10. ERP 제품표
11. 생산기록 관리

### Phase 3: 대시보드
12. KPI 카드 컴포넌트
13. 차트 컴포넌트들 (Recharts)
14. 상세 팝업 컴포넌트
15. 메인 대시보드 조합

### Phase 4: 보고서 페이지
16. 일보 페이지
17. 생산보고 페이지

### Phase 5: AI 기능
18. Claude API 서버사이드 연동 (`/api/ai/` 라우트)
19. 차트 하단 AI 코멘트 컴포넌트
20. AI 인사이트 페이지

### Phase 6: 마무리
21. 간단한 비밀번호 인증 페이지
22. 반응형 테스트 + 미세 조정
23. Vercel 배포 설정

### 토큰 절약 전략
- **공통 컴포넌트 먼저**: DataTable, Dialog, Layout을 먼저 만들어 CRUD에서 재사용
- **타입 파일 분리**: DB 스키마 타입을 한 번만 정의
- **Supabase 훅 패턴화**: useQuery, useMutation 패턴 1회 작성 후 복제
- **Phase별 배치 작업**: 한 Phase 완성 후 다음으로 (중간 확인 최소화)

---

## 7. 디렉토리 구조 (예상)

```
seil_demo_admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # 루트 레이아웃 (사이드바)
│   │   ├── page.tsx             # 메인 대시보드
│   │   ├── daily-report/
│   │   │   └── page.tsx         # 일보
│   │   ├── production-report/
│   │   │   └── page.tsx         # 생산보고
│   │   └── admin/
│   │       ├── equipment/page.tsx
│   │       ├── products/page.tsx
│   │       ├── erp-items/page.tsx
│   │       └── production/page.tsx
│   ├── components/
│   │   ├── ui/                  # shadcn/ui 컴포넌트
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   └── mobile-nav.tsx
│   │   ├── common/
│   │   │   ├── data-table.tsx   # 공통 테이블
│   │   │   ├── crud-dialog.tsx  # 공통 CRUD 모달
│   │   │   └── detail-popup.tsx # 차트 클릭 상세 팝업
│   │   ├── dashboard/
│   │   │   ├── kpi-cards.tsx
│   │   │   ├── production-trend.tsx
│   │   │   ├── equipment-chart.tsx
│   │   │   └── product-pie.tsx
│   │   └── reports/
│   │       ├── daily-report-view.tsx
│   │       └── production-report-view.tsx
│   ├── lib/
│   │   ├── supabase.ts          # Supabase 클라이언트
│   │   └── utils.ts
│   └── types/
│       └── database.ts          # DB 스키마 타입
├── tailwind.config.ts
├── next.config.js
└── package.json
```

---

## 8. 의사결정 (확정)

| 항목 | 결정 |
|------|------|
| 인증 | 간단한 비밀번호 입력 페이지 |
| 기본 표시 기간 | 최근 1개월 |
| UI 언어 | 전체 한국어 |
| 다크모드 | 라이트 모드만 |
| AI 인사이트 | 종합 리포트 (생산효율 + 품질 + 작업자) |
| AI 표시 방식 | 각 차트 하단 2~3줄 요약 코멘트 |

---

## 9. 디렉토리 구조 (업데이트)

```
seil_demo_admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # 메인 대시보드
│   │   ├── login/page.tsx              # 비밀번호 입력
│   │   ├── daily-report/page.tsx       # 일보
│   │   ├── production-report/page.tsx  # 생산보고
│   │   ├── ai-insight/page.tsx         # AI 인사이트
│   │   ├── admin/
│   │   │   ├── equipment/page.tsx
│   │   │   ├── products/page.tsx
│   │   │   ├── erp-items/page.tsx
│   │   │   └── production/page.tsx
│   │   └── api/
│   │       └── ai/
│   │           ├── comment/route.ts    # 차트 코멘트 API
│   │           └── insight/route.ts    # 종합 분석 API
│   ├── components/
│   │   ├── ui/                         # shadcn/ui
│   │   ├── layout/
│   │   ├── common/
│   │   ├── dashboard/
│   │   ├── reports/
│   │   └── ai/
│   │       ├── ai-comment.tsx          # 차트 하단 AI 코멘트
│   │       └── ai-insight-panel.tsx    # 종합 분석 패널
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── claude.ts                   # Claude API 클라이언트
│   │   └── utils.ts
│   └── types/
│       └── database.ts
```
