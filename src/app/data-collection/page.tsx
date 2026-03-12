"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Radio,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Play,
  Settings2,
  Eye,
  RotateCcw,
  Plug,
  Zap,
  UserCheck,
  Search,
  ArrowRight,
  FileSpreadsheet,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────
type ConnectorType = "auto" | "semi-auto"
type ConnectorStatus = "active" | "error" | "disabled" | "pending_review"
type JobStatus = "running" | "completed" | "error" | "pending_review" | "approved" | "rejected"

interface Connector {
  id: string
  name: string
  market: string
  type: ConnectorType
  status: ConnectorStatus
  icon: string
  lastRun: string | null
  nextRun: string
  schedule: string
  hasCredentials: boolean
  description: string
}

interface CollectionJob {
  id: string
  connectorId: string
  connectorName: string
  market: string
  connectorType: ConnectorType
  startedAt: string
  completedAt: string | null
  status: JobStatus
  progress: number
  recordCount: number | null
  errorMessage: string | null
  reviewNote: string | null
  steps: JobStep[]
  reviewData?: ReviewData
}

interface JobStep {
  name: string
  status: "completed" | "running" | "pending" | "error"
  detail?: string
}

interface ReviewData {
  beforeLabel: string
  afterLabel: string
  beforeColumns: string[]
  afterColumns: string[]
  beforeRows: Record<string, string | number | null>[]
  afterRows: Record<string, string | number | null>[]
  summary: { label: string; value: string }[]
}

// ─── Mock Data ───────────────────────────────────────────────
function generateMockConnectors(): Connector[] {
  return [
    {
      id: "conn-1", name: "배민상회 주문수집", market: "배민상회", type: "semi-auto",
      status: "pending_review", icon: "🛵", lastRun: "2026-03-12 09:00",
      nextRun: "2026-03-12 15:00", schedule: "매일 09:00, 15:00", hasCredentials: true,
      description: "배민상회 주문 데이터 수집 → 엑셀 변환 → 검수 후 ERP 업로드",
    },
    {
      id: "conn-2", name: "쿠팡 판매데이터", market: "쿠팡", type: "auto",
      status: "active", icon: "🚀", lastRun: "2026-03-12 10:30",
      nextRun: "2026-03-12 16:30", schedule: "매일 04:30, 10:30, 16:30", hasCredentials: true,
      description: "쿠팡 판매/정산 데이터 자동 수집 및 DB 적재",
    },
    {
      id: "conn-3", name: "네이버 스마트스토어", market: "네이버", type: "auto",
      status: "active", icon: "🟢", lastRun: "2026-03-12 08:00",
      nextRun: "2026-03-12 14:00", schedule: "매일 08:00, 14:00, 20:00", hasCredentials: true,
      description: "네이버 스마트스토어 주문/클레임 데이터 자동 수집",
    },
    {
      id: "conn-4", name: "11번가 주문수집", market: "11번가", type: "semi-auto",
      status: "active", icon: "🔴", lastRun: "2026-03-12 07:00",
      nextRun: "2026-03-12 13:00", schedule: "매일 07:00, 13:00, 19:00", hasCredentials: true,
      description: "11번가 주문 데이터 수집 → 포맷 변환 → 검수 후 반영",
    },
    {
      id: "conn-5", name: "옥션/G마켓 통합", market: "옥션/G마켓", type: "auto",
      status: "active", icon: "🔵", lastRun: "2026-03-12 06:00",
      nextRun: "2026-03-12 12:00", schedule: "매일 06:00, 12:00, 18:00", hasCredentials: true,
      description: "ESM Plus 통합 API로 옥션/G마켓 주문 자동 수집",
    },
    {
      id: "conn-6", name: "ERP 생산데이터", market: "ERP", type: "auto",
      status: "active", icon: "🏭", lastRun: "2026-03-12 11:00",
      nextRun: "2026-03-12 12:00", schedule: "매시간", hasCredentials: true,
      description: "BizMore-ERP 생산실적/재고 데이터 실시간 수집",
    },
    {
      id: "conn-7", name: "사내 메일 데이터", market: "사내메일", type: "semi-auto",
      status: "error", icon: "📧", lastRun: "2026-03-11 18:00",
      nextRun: "2026-03-12 09:00", schedule: "매일 09:00, 18:00", hasCredentials: true,
      description: "사내 메일함에서 거래처 발주서/견적서 엑셀 추출",
    },
    {
      id: "conn-8", name: "위메프 판매데이터", market: "위메프", type: "auto",
      status: "disabled", icon: "🟠", lastRun: null,
      nextRun: "-", schedule: "비활성", hasCredentials: false,
      description: "위메프 판매 데이터 수집 (계정 정보 미입력)",
    },
  ]
}

// 배민 주문 원본 데이터 (배민_주문_복호화.xlsx 기반)
const baeminOriginalData: ReviewData = {
  beforeLabel: "배민상회 주문 원본 (복호화 완료)",
  afterLabel: "ERP 자동업로드용 변환 결과",
  beforeColumns: ["주문번호", "상태", "상품명-옵션명", "관리용상품명", "수량", "판매가격", "받는분", "받는분 연락처", "도로명 주소", "배송메시지"],
  afterColumns: ["거래처코드", "거래처명", "품목코드", "품명", "수량", "단가", "합계단가", "비고", "받는사람", "주소"],
  beforeRows: [
    { 주문번호: "1000015744136", 상태: "배송준비중", "상품명-옵션명": "초밥용기(SL-H15s)-뚜껑", 관리용상품명: "SL-H15s 뚜껑", 수량: 1, 판매가격: "55,300", 받는분: "이찬규", "받는분 연락처": "1071230556", "도로명 주소": "서울 은평구 진흥로 52-2 응암동 4층", 배송메시지: "-" },
    { 주문번호: "1000015744136", 상태: "배송준비중", "상품명-옵션명": "초밥용기(SL-H15s)-몸통", 관리용상품명: "SL-H15s 용기", 수량: 1, 판매가격: "48,510", 받는분: "이찬규", "받는분 연락처": "1071230556", "도로명 주소": "서울 은평구 진흥로 52-2 응암동 4층", 배송메시지: "-" },
    { 주문번호: "1000015743978", 상태: "배송준비중", "상품명-옵션명": "사탕수수 펄프용기(S-30oz/6x9사각)-뚜껑", 관리용상품명: "6x9 트레이 뚜껑", 수량: 1, 판매가격: "37,000", 받는분: "이혜림", "받는분 연락처": "1093712625", "도로명 주소": "인천 서구 담지로86번길 16-49 101호", 배송메시지: "매장 문안에 넣어쥬세요" },
    { 주문번호: "1000015743978", 상태: "배송준비중", "상품명-옵션명": "사탕수수 펄프용기(S-30oz/6x9사각)-몸통", 관리용상품명: "6x9 트레이 용기", 수량: 1, 판매가격: "69,000", 받는분: "이혜림", "받는분 연락처": "1093712625", "도로명 주소": "인천 서구 담지로86번길 16-49 101호", 배송메시지: "매장 문안에 넣어쥬세요" },
    { 주문번호: "1000015743813", 상태: "배송준비중", "상품명-옵션명": "일회용 종이컵(SL-10oz 화이트)", 관리용상품명: "SL-10oz 화이트", 수량: 3, 판매가격: "28,500", 받는분: "최민서", "받는분 연락처": "1088234410", "도로명 주소": "경기 성남시 분당구 판교역로 235", 배송메시지: "경비실에 맡겨주세요" },
    { 주문번호: "1000015743756", 상태: "배송준비중", "상품명-옵션명": "크라프트 도시락박스(KR-200)-뚜껑", 관리용상품명: "KR-200 뚜껑", 수량: 2, 판매가격: "44,000", 받는분: "박준형", "받는분 연락처": "1056781234", "도로명 주소": "서울 강남구 테헤란로 152", 배송메시지: "-" },
    { 주문번호: "1000015743756", 상태: "배송준비중", "상품명-옵션명": "크라프트 도시락박스(KR-200)-몸통", 관리용상품명: "KR-200 용기", 수량: 2, 판매가격: "66,000", 받는분: "박준형", "받는분 연락처": "1056781234", "도로명 주소": "서울 강남구 테헤란로 152", 배송메시지: "-" },
    { 주문번호: "1000015743690", 상태: "배송준비중", "상품명-옵션명": "친환경 PLA컵(PLA-16oz)-뚜껑", 관리용상품명: "PLA-16oz 뚜껑", 수량: 5, 판매가격: "75,000", 받는분: "김수진", "받는분 연락처": "1099887766", "도로명 주소": "부산 해운대구 센텀중앙로 48", 배송메시지: "1층 카페로 배송" },
    { 주문번호: "1000015743690", 상태: "배송준비중", "상품명-옵션명": "친환경 PLA컵(PLA-16oz)-몸통", 관리용상품명: "PLA-16oz 용기", 수량: 5, 판매가격: "95,000", 받는분: "김수진", "받는분 연락처": "1099887766", "도로명 주소": "부산 해운대구 센텀중앙로 48", 배송메시지: "1층 카페로 배송" },
    { 주문번호: "1000015743550", 상태: "배송준비중", "상품명-옵션명": "PP 밀폐용기(PP-500ml)", 관리용상품명: "PP-500ml", 수량: 10, 판매가격: "120,000", 받는분: "정태영", "받는분 연락처": "1077665544", "도로명 주소": "대전 유성구 대학로 99", 배송메시지: "부재시 문앞" },
  ],
  afterRows: [
    { 거래처코드: "123456789", 거래처명: "테스트용(배민상회)", 품목코드: "SL-H15s_L", 품명: "SL-H15s 뚜껑", 수량: 600, 단가: "83.79", 합계단가: "50,274", 비고: "1000015744136 이찬규 택선 2 3800 03/12", 받는사람: "1000015744136", 주소: "이찬규/서울 은평구 진흥로 52-2 응암동 4층" },
    { 거래처코드: "123456789", 거래처명: "테스트용(배민상회)", 품목코드: "SL-H15s_B", 품명: "SL-H15s 용기", 수량: 600, 단가: "81.67", 합계단가: "49,002", 비고: "1000015744136 이찬규 택선 2 3800 03/12", 받는사람: "1000015744136", 주소: "이찬규/서울 은평구 진흥로 52-2 응암동 4층" },
    { 거래처코드: "123456789", 거래처명: "테스트용(배민상회)", 품목코드: "펄프뚜껑-01", 품명: "6x9 트레이 뚜껑", 수량: 300, 단가: "112.12", 합계단가: "33,636", 비고: "1000015743978 이혜림 택선 2 3800 03/12", 받는사람: "1000015743978", 주소: "이혜림/인천 서구 담지로86번길 16-49 101호" },
    { 거래처코드: "123456789", 거래처명: "테스트용(배민상회)", 품목코드: "펄프용기-01", 품명: "6x9 트레이 용기", 수량: 300, 단가: "186.67", 합계단가: "56,001", 비고: "1000015743978 이혜림 택선 2 3800 03/12", 받는사람: "1000015743978", 주소: "이혜림/인천 서구 담지로86번길 16-49 101호" },
    { 거래처코드: "123456789", 거래처명: "테스트용(배민상회)", 품목코드: "SL-10oz-W", 품명: "SL-10oz 화이트", 수량: 1500, 단가: "19.00", 합계단가: "28,500", 비고: "1000015743813 최민서 택선 1 3800 03/12", 받는사람: "1000015743813", 주소: "최민서/경기 성남시 분당구 판교역로 235" },
    { 거래처코드: "123456789", 거래처명: "테스트용(배민상회)", 품목코드: "KR-200_L", 품명: "KR-200 뚜껑", 수량: 400, 단가: "110.00", 합계단가: "44,000", 비고: "1000015743756 박준형 택선 2 3800 03/12", 받는사람: "1000015743756", 주소: "박준형/서울 강남구 테헤란로 152" },
    { 거래처코드: "123456789", 거래처명: "테스트용(배민상회)", 품목코드: "KR-200_B", 품명: "KR-200 용기", 수량: 400, 단가: "165.00", 합계단가: "66,000", 비고: "1000015743756 박준형 택선 2 3800 03/12", 받는사람: "1000015743756", 주소: "박준형/서울 강남구 테헤란로 152" },
    { 거래처코드: "123456789", 거래처명: "테스트용(배민상회)", 품목코드: "PLA-16oz_L", 품명: "PLA-16oz 뚜껑", 수량: 1000, 단가: "75.00", 합계단가: "75,000", 비고: "1000015743690 김수진 택선 2 3800 03/12", 받는사람: "1000015743690", 주소: "김수진/부산 해운대구 센텀중앙로 48" },
    { 거래처코드: "123456789", 거래처명: "테스트용(배민상회)", 품목코드: "PLA-16oz_B", 품명: "PLA-16oz 용기", 수량: 1000, 단가: "95.00", 합계단가: "95,000", 비고: "1000015743690 김수진 택선 2 3800 03/12", 받는사람: "1000015743690", 주소: "김수진/부산 해운대구 센텀중앙로 48" },
    { 거래처코드: "123456789", 거래처명: "테스트용(배민상회)", 품목코드: "PP-500ml", 품명: "PP-500ml", 수량: 2000, 단가: "60.00", 합계단가: "120,000", 비고: "1000015743550 정태영 택선 1 3800 03/12", 받는사람: "1000015743550", 주소: "정태영/대전 유성구 대학로 99" },
  ],
  summary: [
    { label: "원본 주문 건수", value: "10건 (6개 주문)" },
    { label: "변환 품목 수", value: "10건" },
    { label: "총 판매금액", value: "638,310원" },
    { label: "택배비 자동 계산", value: "6건 × 3,800원 = 22,800원" },
    { label: "변환 방식", value: "관리용상품명 → 품목코드 매핑" },
    { label: "수량 변환", value: "판매단위 → 낱개 단위 (BOX→EA)" },
  ],
}

function generateMockJobs(): CollectionJob[] {
  return [
    {
      id: "job-001", connectorId: "conn-1", connectorName: "배민상회 주문수집",
      market: "배민상회", connectorType: "semi-auto",
      startedAt: "2026-03-12 09:00:12", completedAt: "2026-03-12 09:03:45",
      status: "pending_review", progress: 100, recordCount: 10,
      errorMessage: null,
      reviewNote: "배민상회 주문 10건 수집 완료. 엑셀 변환 완료. 검수 요청 중.",
      steps: [
        { name: "배민상회 로그인", status: "completed" },
        { name: "주문 목록 스크래핑", status: "completed", detail: "10건 수집" },
        { name: "엑셀 복호화 (암호 해제)", status: "completed", detail: "배민_주문_복호화.xlsx" },
        { name: "ERP 양식 변환", status: "completed", detail: "자동업로드_생성.xlsx" },
        { name: "담당자 검수 대기", status: "running", detail: "검수 요청됨" },
        { name: "ERP 업로드", status: "pending" },
      ],
      reviewData: baeminOriginalData,
    },
    {
      id: "job-002", connectorId: "conn-2", connectorName: "쿠팡 판매데이터",
      market: "쿠팡", connectorType: "auto",
      startedAt: "2026-03-12 10:30:00", completedAt: "2026-03-12 10:31:22",
      status: "completed", progress: 100, recordCount: 132,
      errorMessage: null, reviewNote: null,
      steps: [
        { name: "쿠팡 API 인증", status: "completed" },
        { name: "판매 데이터 조회", status: "completed", detail: "132건" },
        { name: "데이터 정규화", status: "completed" },
        { name: "DB 적재", status: "completed", detail: "132건 반영" },
      ],
    },
    {
      id: "job-003", connectorId: "conn-3", connectorName: "네이버 스마트스토어",
      market: "네이버", connectorType: "auto",
      startedAt: "2026-03-12 08:00:00", completedAt: "2026-03-12 08:02:10",
      status: "completed", progress: 100, recordCount: 89,
      errorMessage: null, reviewNote: null,
      steps: [
        { name: "커머스 API 인증", status: "completed" },
        { name: "주문 데이터 수집", status: "completed", detail: "78건" },
        { name: "클레임 데이터 수집", status: "completed", detail: "11건" },
        { name: "DB 적재", status: "completed", detail: "89건 반영" },
      ],
    },
    {
      id: "job-004", connectorId: "conn-6", connectorName: "ERP 생산데이터",
      market: "ERP", connectorType: "auto",
      startedAt: "2026-03-12 11:00:00", completedAt: null,
      status: "running", progress: 65, recordCount: null,
      errorMessage: null, reviewNote: null,
      steps: [
        { name: "ERP 연결", status: "completed" },
        { name: "생산실적 조회", status: "completed", detail: "38건" },
        { name: "재고 데이터 조회", status: "running", detail: "진행 중..." },
        { name: "DB 적재", status: "pending" },
      ],
    },
    {
      id: "job-005", connectorId: "conn-7", connectorName: "사내 메일 데이터",
      market: "사내메일", connectorType: "semi-auto",
      startedAt: "2026-03-11 18:00:00", completedAt: "2026-03-11 18:01:30",
      status: "error", progress: 40, recordCount: null,
      errorMessage: "메일 서버 연결 타임아웃 (gw.mailplug.com 응답 없음)",
      reviewNote: null,
      steps: [
        { name: "메일 서버 연결", status: "error", detail: "타임아웃" },
        { name: "메일함 검색", status: "pending" },
        { name: "엑셀 다운로드", status: "pending" },
        { name: "암호 해제 & 변환", status: "pending" },
        { name: "담당자 검수 대기", status: "pending" },
      ],
    },
    {
      id: "job-006", connectorId: "conn-4", connectorName: "11번가 주문수집",
      market: "11번가", connectorType: "semi-auto",
      startedAt: "2026-03-12 07:00:00", completedAt: "2026-03-12 07:04:20",
      status: "approved", progress: 100, recordCount: 23,
      errorMessage: null,
      reviewNote: "김영희 담당자 검수 완료 (07:15). 23건 정상 확인.",
      steps: [
        { name: "11번가 로그인", status: "completed" },
        { name: "주문 데이터 수집", status: "completed", detail: "23건" },
        { name: "포맷 변환", status: "completed" },
        { name: "담당자 검수", status: "completed", detail: "김영희 승인" },
        { name: "DB 반영", status: "completed", detail: "23건 반영" },
      ],
    },
    {
      id: "job-007", connectorId: "conn-5", connectorName: "옥션/G마켓 통합",
      market: "옥션/G마켓", connectorType: "auto",
      startedAt: "2026-03-12 06:00:00", completedAt: "2026-03-12 06:01:55",
      status: "completed", progress: 100, recordCount: 56,
      errorMessage: null, reviewNote: null,
      steps: [
        { name: "ESM Plus API 인증", status: "completed" },
        { name: "옥션 주문 수집", status: "completed", detail: "31건" },
        { name: "G마켓 주문 수집", status: "completed", detail: "25건" },
        { name: "DB 적재", status: "completed", detail: "56건 반영" },
      ],
    },
    {
      id: "job-008", connectorId: "conn-1", connectorName: "배민상회 주문수집",
      market: "배민상회", connectorType: "semi-auto",
      startedAt: "2026-03-11 15:00:00", completedAt: "2026-03-11 15:04:10",
      status: "approved", progress: 100, recordCount: 35,
      errorMessage: null,
      reviewNote: "박민수 담당자 검수 완료 (15:20). 35건 정상 확인, ERP 업로드 완료.",
      steps: [
        { name: "배민상회 로그인", status: "completed" },
        { name: "주문 목록 스크래핑", status: "completed", detail: "35건" },
        { name: "엑셀 변환", status: "completed" },
        { name: "담당자 검수", status: "completed", detail: "박민수 승인" },
        { name: "ERP 업로드", status: "completed", detail: "35건 반영" },
      ],
    },
  ]
}

// ─── Status helpers ──────────────────────────────────────────
function connectorStatusBadge(status: ConnectorStatus) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">정상</Badge>
    case "error":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">오류</Badge>
    case "disabled":
      return <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100">비활성</Badge>
    case "pending_review":
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">검수대기</Badge>
  }
}

function connectorTypeBadge(type: ConnectorType) {
  return type === "auto" ? (
    <Badge variant="outline" className="border-blue-200 text-blue-600 gap-1">
      <Zap className="h-3 w-3" />자동
    </Badge>
  ) : (
    <Badge variant="outline" className="border-purple-200 text-purple-600 gap-1">
      <UserCheck className="h-3 w-3" />반자동
    </Badge>
  )
}

function jobStatusBadge(status: JobStatus) {
  switch (status) {
    case "running":
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 gap-1"><Loader2 className="h-3 w-3 animate-spin" />수집 중</Badge>
    case "completed":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1"><CheckCircle2 className="h-3 w-3" />완료</Badge>
    case "error":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1"><XCircle className="h-3 w-3" />오류</Badge>
    case "pending_review":
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 gap-1"><Clock className="h-3 w-3" />검수대기</Badge>
    case "approved":
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 gap-1"><CheckCircle2 className="h-3 w-3" />승인완료</Badge>
    case "rejected":
      return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 gap-1"><XCircle className="h-3 w-3" />반려</Badge>
  }
}

function stepStatusIcon(status: JobStep["status"]) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    case "pending":
      return <Clock className="h-4 w-4 text-gray-300" />
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />
  }
}

// ─── Review Detail Component ─────────────────────────────────
function ReviewDetailView({ job, onApprove, onReject, onBack }: {
  job: CollectionJob
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onBack: () => void
}) {
  const [viewTab, setViewTab] = useState<"after" | "before" | "steps">("after")
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const rd = job.reviewData!

  const toggleRow = (idx: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />뒤로
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">검수 상세</h1>
            {jobStatusBadge(job.status)}
            {connectorTypeBadge(job.connectorType)}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {job.connectorName} · {job.startedAt} 수집 · {job.recordCount}건
          </p>
        </div>
        {job.status === "pending_review" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 gap-1"
              onClick={() => onReject(job.id)}
            >
              <XCircle className="h-4 w-4" />반려
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white gap-1"
              onClick={() => onApprove(job.id)}
            >
              <CheckCircle2 className="h-4 w-4" />검수 승인
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {rd.summary.map((s, i) => (
          <Card key={i}>
            <CardContent className="p-3">
              <p className="text-[11px] text-gray-500 mb-0.5">{s.label}</p>
              <p className="text-sm font-semibold text-gray-900">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Process Steps */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            {job.steps.map((step, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="flex items-center gap-1">
                  {stepStatusIcon(step.status)}
                  <span className={`text-xs ${
                    step.status === "completed" ? "text-gray-700" :
                    step.status === "running" ? "text-blue-600 font-medium" :
                    step.status === "error" ? "text-red-600" : "text-gray-400"
                  }`}>
                    {step.name}
                  </span>
                </div>
                {i < job.steps.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-gray-300" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 border-b">
        {([
          { key: "after", label: "변환 결과 (ERP 업로드용)", icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
          { key: "before", label: "원본 데이터 (배민상회)", icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
          { key: "steps", label: "변환 단계 상세", icon: <Eye className="h-3.5 w-3.5" /> },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setViewTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              viewTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {viewTab === "after" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              {rd.afterLabel}
            </CardTitle>
            <p className="text-xs text-gray-500">이 데이터가 ERP에 업로드됩니다. 내용을 확인 후 승인해주세요.</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-green-50">
                    <TableHead className="w-8 text-center text-xs">#</TableHead>
                    {rd.afterColumns.map(col => (
                      <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rd.afterRows.map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-green-50/50">
                      <TableCell className="text-center text-xs text-gray-400">{idx + 1}</TableCell>
                      {rd.afterColumns.map(col => (
                        <TableCell key={col} className="text-xs whitespace-nowrap">
                          {row[col] ?? "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {viewTab === "before" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-blue-600" />
              {rd.beforeLabel}
            </CardTitle>
            <p className="text-xs text-gray-500">배민상회에서 수집한 원본 주문 데이터입니다.</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-50">
                    <TableHead className="w-8 text-center text-xs">#</TableHead>
                    {rd.beforeColumns.map(col => (
                      <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rd.beforeRows.map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-blue-50/50">
                      <TableCell className="text-center text-xs text-gray-400">{idx + 1}</TableCell>
                      {rd.beforeColumns.map(col => (
                        <TableCell key={col} className="text-xs whitespace-nowrap max-w-[200px] truncate">
                          {row[col] ?? "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {viewTab === "steps" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">변환 과정 상세</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Row-by-row mapping */}
            <div className="space-y-2">
              {rd.beforeRows.map((bRow, idx) => {
                const aRow = rd.afterRows[idx]
                if (!aRow) return null
                const isExpanded = expandedRows.has(idx)
                return (
                  <div key={idx} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleRow(idx)}
                      className="w-full flex items-center justify-between p-3 hover:bg-gray-50 text-left"
                    >
                      <div className="flex items-center gap-3 text-sm min-w-0">
                        <span className="text-xs text-gray-400 w-5 shrink-0">#{idx + 1}</span>
                        <span className="text-blue-600 truncate">{bRow["상품명-옵션명"]}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className="text-green-600 truncate">{aRow["품목코드"]} ({aRow["품명"]})</span>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </button>
                    {isExpanded && (
                      <div className="border-t p-3 bg-gray-50/50 grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="font-medium text-blue-600 mb-2">원본 (배민상회)</p>
                          <div className="space-y-1.5">
                            {rd.beforeColumns.map(col => (
                              <div key={col} className="flex gap-2">
                                <span className="text-gray-500 w-24 shrink-0">{col}</span>
                                <span className="text-gray-900 break-all">{String(bRow[col] ?? "-")}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="font-medium text-green-600 mb-2">변환 결과 (ERP)</p>
                          <div className="space-y-1.5">
                            {rd.afterColumns.map(col => (
                              <div key={col} className="flex gap-2">
                                <span className="text-gray-500 w-24 shrink-0">{col}</span>
                                <span className="text-gray-900 break-all">{String(aRow[col] ?? "-")}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom Action Bar for pending_review */}
      {job.status === "pending_review" && (
        <div className="sticky bottom-0 bg-white border-t p-4 -mx-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            위 데이터를 확인하셨나요? 승인 시 ERP에 자동 업로드됩니다.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 gap-1"
              onClick={() => onReject(job.id)}
            >
              <XCircle className="h-4 w-4" />반려
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white gap-1"
              onClick={() => onApprove(job.id)}
            >
              <CheckCircle2 className="h-4 w-4" />검수 승인 및 ERP 업로드
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────
export default function DataCollectionPage() {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [jobs, setJobs] = useState<CollectionJob[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<CollectionJob | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [connectorDetailOpen, setConnectorDetailOpen] = useState(false)
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null)
  const [activeTab, setActiveTab] = useState<"all" | "review" | "error">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [reviewDetailJob, setReviewDetailJob] = useState<CollectionJob | null>(null)
  const [connectorFilter, setConnectorFilter] = useState<string>("all")

  useEffect(() => {
    const timer = setTimeout(() => {
      setConnectors(generateMockConnectors())
      setJobs(generateMockJobs())
      setLoading(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  const handleApprove = useCallback((jobId: string) => {
    setJobs(prev => prev.map(j =>
      j.id === jobId
        ? {
            ...j,
            status: "approved" as JobStatus,
            reviewNote: `관리자 검수 완료 (${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}). ${j.recordCount}건 정상 확인. ERP 업로드 완료.`,
            steps: j.steps.map(s =>
              s.name.includes("검수") ? { ...s, status: "completed" as const, detail: "관리자 승인" } :
              s.name.includes("업로드") || s.name.includes("반영") ? { ...s, status: "completed" as const, detail: `${j.recordCount}건 반영` } :
              s
            ),
          }
        : j
    ))
    setConnectors(prev => prev.map(c =>
      c.status === "pending_review" ? { ...c, status: "active" as ConnectorStatus } : c
    ))
    if (reviewDetailJob?.id === jobId) {
      setReviewDetailJob(prev => prev ? { ...prev, status: "approved" as JobStatus } : null)
    }
  }, [reviewDetailJob])

  const handleReject = useCallback((jobId: string) => {
    setJobs(prev => prev.map(j =>
      j.id === jobId
        ? {
            ...j,
            status: "rejected" as JobStatus,
            reviewNote: `관리자 반려 (${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}). 데이터 재검토 필요.`,
            steps: j.steps.map(s =>
              s.name.includes("검수") ? { ...s, status: "error" as const, detail: "반려됨" } : s
            ),
          }
        : j
    ))
    if (reviewDetailJob?.id === jobId) {
      setReviewDetailJob(prev => prev ? { ...prev, status: "rejected" as JobStatus } : null)
    }
  }, [reviewDetailJob])

  const openReviewDetail = useCallback((job: CollectionJob) => {
    if (job.reviewData) {
      setReviewDetailJob(job)
    } else {
      setSelectedJob(job)
      setDetailOpen(true)
    }
  }, [])

  // ─── Computed ────────────────────────────────────────────
  const totalConnectors = connectors.length
  const activeConnectors = connectors.filter(c => c.status === "active" || c.status === "pending_review").length
  const pendingReviews = jobs.filter(j => j.status === "pending_review").length
  const errorCount = connectors.filter(c => c.status === "error").length

  // 커넥터별 고유 목록
  const connectorOptions = Array.from(new Set(jobs.map(j => j.connectorId))).map(id => {
    const job = jobs.find(j => j.connectorId === id)!
    const conn = connectors.find(c => c.id === id)
    return { id, name: job.connectorName, icon: conn?.icon || "" }
  })

  const filteredJobs = jobs.filter(j => {
    if (activeTab === "review") return j.status === "pending_review"
    if (activeTab === "error") return j.status === "error"
    return true
  }).filter(j => {
    if (connectorFilter !== "all") return j.connectorId === connectorFilter
    return true
  }).filter(j => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return j.connectorName.toLowerCase().includes(q) || j.market.toLowerCase().includes(q)
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  // ─── Review Detail View ────────────────────────────────
  if (reviewDetailJob) {
    return (
      <ReviewDetailView
        job={reviewDetailJob}
        onApprove={handleApprove}
        onReject={handleReject}
        onBack={() => setReviewDetailJob(null)}
      />
    )
  }

  // ─── Main View ─────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">데이터 수집 관리 감독</h1>
        <p className="text-sm text-gray-500 mt-1">온라인 마켓 커넥터 현황 및 수집 작업 모니터링</p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><Plug className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-gray-500">총 커넥터</p>
                <p className="text-2xl font-bold">{totalConnectors}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><CheckCircle2 className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-gray-500">활성 커넥터</p>
                <p className="text-2xl font-bold text-green-600">{activeConnectors}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={pendingReviews > 0 ? "ring-2 ring-amber-300" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg"><Clock className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-sm text-gray-500">검수 대기</p>
                <p className="text-2xl font-bold text-amber-600">{pendingReviews}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={errorCount > 0 ? "ring-2 ring-red-300" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-sm text-gray-500">오류 발생</p>
                <p className="text-2xl font-bold text-red-600">{errorCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connector Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Radio className="h-5 w-5" />커넥터 현황
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[240px]">커넥터</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>최근 수집</TableHead>
                  <TableHead>다음 예정</TableHead>
                  <TableHead>스케줄</TableHead>
                  <TableHead className="text-right">동작</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connectors.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => { setSelectedConnector(c); setConnectorDetailOpen(true) }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{c.icon}</span>
                        <div>
                          <p className="font-medium text-sm">{c.name}</p>
                          <p className="text-xs text-gray-400">{c.market}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{connectorTypeBadge(c.type)}</TableCell>
                    <TableCell>{connectorStatusBadge(c.status)}</TableCell>
                    <TableCell className="text-sm text-gray-600">{c.lastRun || "-"}</TableCell>
                    <TableCell className="text-sm text-gray-600">{c.nextRun}</TableCell>
                    <TableCell className="text-sm text-gray-500">{c.schedule}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => e.stopPropagation()}><Play className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => e.stopPropagation()}><Settings2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Job History */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg">수집 작업 현황</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={connectorFilter}
                onChange={(e) => setConnectorFilter(e.target.value)}
                className="py-1.5 px-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="all">전체 커넥터</option>
                {connectorOptions.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm border rounded-lg w-36 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="flex rounded-lg border overflow-hidden">
                {([
                  { key: "all", label: "전체" },
                  { key: "review", label: `검수대기 (${pendingReviews})` },
                  { key: "error", label: "오류" },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeTab === tab.key
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredJobs.length === 0 ? (
              <div className="text-center text-gray-400 py-8">해당하는 작업이 없습니다.</div>
            ) : (
              filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className={`border rounded-lg p-4 cursor-pointer hover:shadow-sm transition-shadow ${
                    job.status === "pending_review" ? "border-amber-300 bg-amber-50/30" :
                    job.status === "error" ? "border-red-200 bg-red-50/30" :
                    job.status === "running" ? "border-blue-200 bg-blue-50/30" :
                    "border-gray-200"
                  }`}
                  onClick={() => openReviewDetail(job)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{connectors.find(c => c.id === job.connectorId)?.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{job.connectorName}</span>
                          {connectorTypeBadge(job.connectorType)}
                          {jobStatusBadge(job.status)}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {job.startedAt}
                          {job.completedAt ? ` → ${job.completedAt}` : ""}
                          {job.recordCount != null ? ` · ${job.recordCount}건` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {job.status === "running" && (
                        <div className="w-32">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>진행률</span><span>{job.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${job.progress}%` }} />
                          </div>
                        </div>
                      )}

                      {job.status === "pending_review" && (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            className="h-8 bg-amber-600 hover:bg-amber-700 text-white gap-1"
                            onClick={(e) => { e.stopPropagation(); openReviewDetail(job) }}
                          >
                            <Eye className="h-3.5 w-3.5" />검수하기
                          </Button>
                        </div>
                      )}

                      {job.status === "error" && (
                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={(e) => e.stopPropagation()}>
                          <RotateCcw className="h-3.5 w-3.5" />재시도
                        </Button>
                      )}

                      <Button variant="ghost" size="sm" className="h-8 gap-1"
                        onClick={(e) => { e.stopPropagation(); setSelectedJob(job); setDetailOpen(true) }}
                      >
                        <Eye className="h-3.5 w-3.5" />상세
                      </Button>
                    </div>
                  </div>

                  {job.status === "error" && job.errorMessage && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">⚠️ {job.errorMessage}</div>
                  )}
                  {job.status === "pending_review" && job.reviewNote && (
                    <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded p-2">📋 {job.reviewNote}</div>
                  )}
                  {job.status === "approved" && job.reviewNote && (
                    <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 rounded p-2">✅ {job.reviewNote}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Job Detail Dialog ─── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedJob && connectors.find(c => c.id === selectedJob.connectorId)?.icon}
              {selectedJob?.connectorName} - 작업 상세
            </DialogTitle>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {connectorTypeBadge(selectedJob.connectorType)}
                {jobStatusBadge(selectedJob.status)}
                {selectedJob.recordCount != null && <Badge variant="outline">{selectedJob.recordCount}건 수집</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-gray-500">시작 시간</p><p className="font-medium">{selectedJob.startedAt}</p></div>
                <div><p className="text-gray-500">완료 시간</p><p className="font-medium">{selectedJob.completedAt || "진행 중"}</p></div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">작업 단계</p>
                <div className="space-y-0">
                  {selectedJob.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3 relative">
                      {i < selectedJob.steps.length - 1 && (
                        <div className="absolute left-[7px] top-5 w-0.5 h-full bg-gray-200" />
                      )}
                      <div className="relative z-10 mt-0.5 bg-white">{stepStatusIcon(step.status)}</div>
                      <div className="pb-4">
                        <p className={`text-sm font-medium ${
                          step.status === "completed" ? "text-gray-900" :
                          step.status === "running" ? "text-blue-600" :
                          step.status === "error" ? "text-red-600" : "text-gray-400"
                        }`}>{step.name}</p>
                        {step.detail && <p className="text-xs text-gray-500">{step.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {selectedJob.errorMessage && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">⚠️ {selectedJob.errorMessage}</div>
              )}
              {selectedJob.reviewNote && (
                <div className={`text-sm rounded-lg p-3 ${
                  selectedJob.status === "pending_review" ? "text-amber-700 bg-amber-50" :
                  selectedJob.status === "approved" ? "text-emerald-700 bg-emerald-50" :
                  selectedJob.status === "rejected" ? "text-red-700 bg-red-50" :
                  "text-gray-700 bg-gray-50"
                }`}>📋 {selectedJob.reviewNote}</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Connector Detail Dialog ─── */}
      <Dialog open={connectorDetailOpen} onOpenChange={setConnectorDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedConnector?.icon} {selectedConnector?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedConnector && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {connectorTypeBadge(selectedConnector.type)}
                {connectorStatusBadge(selectedConnector.status)}
                {selectedConnector.hasCredentials ? (
                  <Badge variant="outline" className="border-green-200 text-green-600 gap-1"><CheckCircle2 className="h-3 w-3" />인증 완료</Badge>
                ) : (
                  <Badge variant="outline" className="border-red-200 text-red-600 gap-1"><AlertTriangle className="h-3 w-3" />인증 필요</Badge>
                )}
              </div>
              <p className="text-sm text-gray-600">{selectedConnector.description}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b"><span className="text-gray-500">마켓</span><span className="font-medium">{selectedConnector.market}</span></div>
                <div className="flex justify-between py-2 border-b"><span className="text-gray-500">수집 주기</span><span className="font-medium">{selectedConnector.schedule}</span></div>
                <div className="flex justify-between py-2 border-b"><span className="text-gray-500">최근 수집</span><span className="font-medium">{selectedConnector.lastRun || "-"}</span></div>
                <div className="flex justify-between py-2 border-b"><span className="text-gray-500">다음 예정</span><span className="font-medium">{selectedConnector.nextRun}</span></div>
              </div>
              {selectedConnector.type === "semi-auto" && (
                <div className="text-xs text-purple-700 bg-purple-50 rounded-lg p-3">
                  <p className="font-medium mb-1">반자동 커넥터</p>
                  <p>데이터 수집 및 변환 완료 후 담당자 검수를 거쳐 최종 반영됩니다.</p>
                </div>
              )}
              {!selectedConnector.hasCredentials && (
                <div className="text-xs text-red-700 bg-red-50 rounded-lg p-3">
                  <p className="font-medium mb-1">계정 정보 필요</p>
                  <p>커넥터 동작을 위해 마켓 계정 정보(ID/비밀번호)를 입력해주세요.</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button className="flex-1 gap-1" variant="outline"><Settings2 className="h-4 w-4" />설정</Button>
                <Button className="flex-1 gap-1" disabled={!selectedConnector.hasCredentials || selectedConnector.status === "disabled"}>
                  <Play className="h-4 w-4" />수동 실행
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
