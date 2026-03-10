-- ============================================
-- Seil Demo Admin - Supabase 테이블 셋업 SQL
-- ============================================
-- 실행 순서:
-- 1. 이 SQL을 Supabase SQL Editor에서 실행
-- 2. 각 테이블에 CSV 데이터를 Import (Table Editor → Import)
--    순서: dim_equipment → dim_product → dim_erp_item → fact_production
-- ============================================

-- 기존 테이블 삭제 (있는 경우)
DROP TABLE IF EXISTS fact_production CASCADE;
DROP TABLE IF EXISTS dim_product CASCADE;
DROP TABLE IF EXISTS dim_erp_item CASCADE;
DROP TABLE IF EXISTS dim_equipment CASCADE;

-- ============================================
-- 1. dim_equipment (설비 마스터)
-- ============================================
CREATE TABLE dim_equipment (
  equipment_id INTEGER PRIMARY KEY,
  name_legacy TEXT,
  name_official TEXT,
  name_short TEXT,
  note TEXT,
  manufacturer TEXT,
  country TEXT,
  factory TEXT DEFAULT '지기생산부'
);

-- ============================================
-- 2. dim_product (제품 마스터)
-- PK: 자동 증가 id (product_code 중복 허용)
-- ============================================
CREATE TABLE dim_product (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_code TEXT,
  product_name TEXT,
  pack_qty INTEGER,
  rpm INTEGER,
  equipment_name TEXT,
  raw_material TEXT,
  daily_max_qty INTEGER,
  factory TEXT DEFAULT '지기생산부'
);

-- ============================================
-- 3. dim_erp_item (ERP 품목 마스터)
-- ============================================
CREATE TABLE dim_erp_item (
  item_code TEXT PRIMARY KEY,
  item_name TEXT,
  category_large TEXT,
  category_medium TEXT,
  category_small TEXT,
  spec TEXT,
  tax_type TEXT,
  purchase_price NUMERIC,
  sales_price NUMERIC,
  is_discontinued INTEGER DEFAULT 0,
  note TEXT
);

-- ============================================
-- 4. fact_production (생산 실적)
-- ============================================
CREATE TABLE fact_production (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  year_month TEXT,
  production_type TEXT,
  production_date TEXT,
  product_code TEXT,
  product_name TEXT,
  finished_qty INTEGER,
  produced_qty INTEGER,
  defect_qty INTEGER,
  tech_worker TEXT,
  pack_workers TEXT,
  equipment_name TEXT,
  note TEXT,
  source_sheet TEXT,
  work_specification JSONB,
  worker_count INTEGER,
  work_start_hhmm TEXT,
  work_end_hhmm TEXT,
  work_minutes INTEGER,
  factory TEXT DEFAULT '지기생산부'
);

-- ============================================
-- 5. ai_insight_cache (AI 분석 캐시)
-- ============================================
CREATE TABLE ai_insight_cache (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cache_key TEXT UNIQUE NOT NULL,
  insight_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS 비활성화 (데모 프로젝트)
-- ============================================
ALTER TABLE dim_equipment DISABLE ROW LEVEL SECURITY;
ALTER TABLE dim_product DISABLE ROW LEVEL SECURITY;
ALTER TABLE dim_erp_item DISABLE ROW LEVEL SECURITY;
ALTER TABLE fact_production DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insight_cache DISABLE ROW LEVEL SECURITY;

-- RLS가 이미 활성화된 경우를 위한 anon 읽기/쓰기 정책
DO $$
BEGIN
  -- dim_equipment
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dim_equipment' AND policyname = 'Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON dim_equipment FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  -- dim_product
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dim_product' AND policyname = 'Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON dim_product FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  -- dim_erp_item
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dim_erp_item' AND policyname = 'Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON dim_erp_item FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  -- fact_production
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fact_production' AND policyname = 'Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON fact_production FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  -- ai_insight_cache
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_insight_cache' AND policyname = 'Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON ai_insight_cache FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- 인덱스
-- ============================================
CREATE INDEX idx_fact_production_date ON fact_production(production_date);
CREATE INDEX idx_fact_production_equipment ON fact_production(equipment_name);
CREATE INDEX idx_fact_production_year_month ON fact_production(year_month);
CREATE INDEX idx_dim_product_equipment ON dim_product(equipment_name);
CREATE INDEX idx_dim_product_code ON dim_product(product_code);
CREATE INDEX idx_fact_production_factory ON fact_production(factory);
CREATE INDEX idx_dim_equipment_factory ON dim_equipment(factory);
CREATE INDEX idx_dim_product_factory ON dim_product(factory);

-- ============================================
-- 완료!
-- 이제 Table Editor에서 CSV를 Import 하세요.
-- 순서: dim_equipment → dim_product → dim_erp_item → fact_production
--
-- dim_product CSV Import 시 주의:
--   - "id" 컬럼은 자동 생성이므로 CSV에 id 컬럼이 있으면
--     Import 시 해당 컬럼을 무시하거나, CSV에서 id 컬럼을 제거하세요.
-- ============================================
