import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from './lib/supabase'
import { formatAmount, formatAmountShort, formatDateTime } from './lib/format'
import { Link } from 'react-router-dom'

const QUICK_AMOUNTS = [30000, 50000, 70000, 100000, 150000, 200000, 300000, 500000]
const SIDE_OPTIONS = ['미분류', '신랑측', '신부측', '신랑 부모님', '신부 부모님', '기타']

function getSideBadgeStyle(side) {
  if (side === '신랑측' || side === '신랑 부모님') {
    return 'bg-groom-100 text-groom-600 border-groom-200'
  }
  if (side === '신부측' || side === '신부 부모님') {
    return 'bg-bride-100 text-bride-600 border-bride-200'
  }
  return 'bg-gold-100 text-gold-500 border-gold-200'
}

export default function App() {
  const [recorder, setRecorder] = useState(() => localStorage.getItem('wedding_recorder') || '')
  const [recorderInput, setRecorderInput] = useState('')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [side, setSide] = useState('미분류')
  const [relation, setRelation] = useState('')
  const [memo, setMemo] = useState('')
  const [showExtra, setShowExtra] = useState(false)
  const [recentGuests, setRecentGuests] = useState([])
  const [allGuests, setAllGuests] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const nameInputRef = useRef(null)

  // 접수자 이름 설정
  function saveRecorder(val) {
    const trimmed = val.trim()
    if (!trimmed) return
    localStorage.setItem('wedding_recorder', trimmed)
    setRecorder(trimmed)
  }

  // 동명이인 경고
  const duplicateWarning = useMemo(() => {
    const trimmed = name.trim()
    if (!trimmed) return null
    const matches = allGuests.filter(g => g.name === trimmed)
    if (matches.length === 0) return null
    return `"${trimmed}" 이름으로 이미 ${matches.length}건 접수되어 있습니다`
  }, [name, allGuests])

  useEffect(() => {
    fetchRecent()

    const channel = supabase
      .channel('guests-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guests' }, (payload) => {
        setRecentGuests(prev => {
          if (prev.some(g => g.id === payload.new.id)) return prev
          return [payload.new, ...prev].slice(0, 10)
        })
        setAllGuests(prev => {
          if (prev.some(g => g.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'guests' }, (payload) => {
        setRecentGuests(prev => prev.map(g => g.id === payload.new.id ? payload.new : g))
        setAllGuests(prev => prev.map(g => g.id === payload.new.id ? payload.new : g))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'guests' }, (payload) => {
        setRecentGuests(prev => prev.filter(g => g.id !== payload.old.id))
        setAllGuests(prev => prev.filter(g => g.id !== payload.old.id))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchRecent() {
    const { data, error } = await supabase
      .from('guests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (!error && data) {
      setRecentGuests(data)
    }

    const { data: allData } = await supabase
      .from('guests')
      .select('id, name, amount, side')

    if (allData) {
      setAllGuests(allData)
    }
  }

  const stats = useMemo(() => {
    const total = allGuests.reduce((sum, g) => sum + (g.amount || 0), 0)
    const groomGuests = allGuests.filter(g => g.side === '신랑측' || g.side === '신랑 부모님')
    const brideGuests = allGuests.filter(g => g.side === '신부측' || g.side === '신부 부모님')
    return {
      total,
      count: allGuests.length,
      groom: { count: groomGuests.length, amount: groomGuests.reduce((s, g) => s + (g.amount || 0), 0) },
      bride: { count: brideGuests.length, amount: brideGuests.reduce((s, g) => s + (g.amount || 0), 0) },
    }
  }, [allGuests])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !amount) return

    setIsSubmitting(true)

    const { data: inserted, error } = await supabase
      .from('guests')
      .insert([{
        name: name.trim(),
        amount: parseInt(amount),
        side,
        relation: relation.trim(),
        memo: memo.trim(),
        recorded_by: recorder,
      }])
      .select()

    setIsSubmitting(false)

    if (!error && inserted) {
      setRecentGuests(prev => [inserted[0], ...prev].slice(0, 10))
      setAllGuests(prev => [...prev, inserted[0]])
      setName('')
      setAmount('')
      setSide('미분류')
      setRelation('')
      setMemo('')
      setShowExtra(false)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 1500)
      nameInputRef.current?.focus()
    }
  }

  const numericAmount = parseInt(amount) || 0
  const todayStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  // 접수자 설정 안 됐으면 설정 화면
  if (!recorder) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="bg-ivory rounded-2xl p-8 border border-gold-200 shadow-sm shadow-gold-600/5
                        max-w-sm w-full text-center">
          <p className="text-[11px] tracking-[6px] text-gold-400 uppercase font-medium">
            Wedding Reception
          </p>
          <h1 className="font-display text-[22px] font-bold text-gold-800 mt-2">
            접수자 설정
          </h1>
          <p className="text-[13px] text-gold-500 mt-2 mb-6">
            이 기기에서 접수하는 분의 이름을 입력해주세요
          </p>
          <input
            type="text"
            value={recorderInput}
            onChange={(e) => setRecorderInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveRecorder(recorderInput)}
            placeholder="예: 민준, 삼촌"
            className="w-full px-4 py-3.5 rounded-xl border border-gold-200 bg-parchment text-[16px]
                       font-semibold text-gold-800 text-center
                       focus:border-gold-600 focus:outline-none transition-all
                       placeholder:text-gold-300"
            autoFocus
          />
          <button
            onClick={() => saveRecorder(recorderInput)}
            disabled={!recorderInput.trim()}
            className="w-full mt-4 py-3.5 rounded-xl text-white font-bold text-[15px]
                       bg-gradient-to-br from-gold-600 to-[#A67C1E]
                       disabled:from-gold-300 disabled:to-gold-300 disabled:cursor-not-allowed
                       transition-all shadow-md shadow-gold-600/15"
          >
            시작하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-10">
      {/* ── Header ── */}
      <header className="text-center pt-8 pb-6 border-b border-gold-200">
        <p className="text-[11px] tracking-[6px] text-gold-400 uppercase font-medium">
          Wedding Reception
        </p>
        <h1 className="font-display text-[26px] font-bold text-gold-800 mt-1.5 tracking-tight">
          축의금 접수
        </h1>
        <p className="text-[13px] text-gold-500 mt-1.5">{todayStr}</p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <span className="text-[12px] text-gold-400">
            접수자: <span className="font-semibold text-gold-600">{recorder}</span>
          </span>
          <button
            onClick={() => { localStorage.removeItem('wedding_recorder'); setRecorder('') }}
            className="text-[10px] text-gold-300 hover:text-gold-500 transition-colors"
          >
            변경
          </button>
          <Link
            to="/admin"
            className="text-[11px] px-4 py-1.5 rounded-full
                       border border-gold-300 text-gold-600 hover:bg-gold-50
                       transition-colors"
          >
            관리자 보기
          </Link>
        </div>
      </header>

      {/* ── Success Toast ── */}
      {showSuccess && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-scale-in">
          <div className="bg-gold-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold shadow-lg
                          shadow-gold-600/20">
            ✓ 접수 완료
          </div>
        </div>
      )}

      <main className="max-w-lg mx-auto px-5">
        {/* ── Summary Cards ── */}
        <div className="flex gap-3 mt-5">
          <div className="flex-1 bg-ivory rounded-2xl p-4 border border-gold-200
                          shadow-sm shadow-gold-600/5">
            <p className="text-[11px] text-gold-500">총 접수</p>
            <p className="text-[22px] font-extrabold text-gold-600 mt-1">
              {formatAmount(stats.total)}
              <span className="text-[12px] font-medium ml-0.5">원</span>
            </p>
            <p className="text-[11px] text-gold-400 mt-1">총 {stats.count}명</p>
          </div>
          <div className="flex flex-col gap-2.5 flex-1">
            <div className="bg-groom-50 rounded-2xl px-3.5 py-2.5 border border-groom-200">
              <p className="text-[11px] text-groom-400">신랑측 {stats.groom.count}명</p>
              <p className="text-[16px] font-bold text-groom-600">
                {formatAmount(stats.groom.amount)}
              </p>
            </div>
            <div className="bg-bride-50 rounded-2xl px-3.5 py-2.5 border border-bride-200">
              <p className="text-[11px] text-bride-400">신부측 {stats.bride.count}명</p>
              <p className="text-[16px] font-bold text-bride-600">
                {formatAmount(stats.bride.amount)}
              </p>
            </div>
          </div>
        </div>

        {/* ── Input Form ── */}
        <form onSubmit={handleSubmit}
              className="mt-5 bg-ivory rounded-2xl p-5 border border-gold-200
                         shadow-sm shadow-gold-600/5">
          {/* 이름 */}
          <div>
            <label className="block text-[11px] font-semibold text-gold-500 mb-1.5 uppercase tracking-wider">
              하객 이름
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름 입력"
              className="w-full px-4 py-3.5 rounded-xl border border-gold-200 bg-parchment text-[16px]
                         font-semibold text-gold-800
                         focus:border-gold-600 focus:ring-1 focus:ring-gold-600/20
                         focus:outline-none transition-all
                         placeholder:text-gold-300"
              autoComplete="off"
            />
            {duplicateWarning && (
              <p className="mt-1.5 text-[12px] text-bride-600 font-medium animate-slide-up">
                ⚠ {duplicateWarning} (동명이인이면 그대로 접수 가능)
              </p>
            )}
          </div>

          {/* 금액 */}
          <div className="mt-4">
            <label className="block text-[11px] font-semibold text-gold-500 mb-1.5 uppercase tracking-wider">
              축의금
              {numericAmount > 0 && (
                <span className="ml-2 text-gold-600 normal-case tracking-normal">
                  {formatAmount(numericAmount)}원
                </span>
              )}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="금액 직접 입력 (원)"
              className="w-full px-4 py-3.5 rounded-xl border border-gold-200 bg-parchment text-[16px]
                         font-bold text-gold-600 text-right
                         focus:border-gold-600 focus:ring-1 focus:ring-gold-600/20
                         focus:outline-none transition-all
                         placeholder:text-gold-300 placeholder:font-normal placeholder:text-left"
              inputMode="numeric"
            />

            {/* 빠른 금액 */}
            <div className="grid grid-cols-4 gap-1.5 mt-2.5">
              {QUICK_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(String(val))}
                  className={`amount-chip ${numericAmount === val ? 'selected' : ''}`}
                >
                  {formatAmountShort(val)}
                </button>
              ))}
            </div>
          </div>

          {/* 추가 정보 (선택) */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowExtra(!showExtra)}
              className="flex items-center gap-1.5 text-[12px] text-gold-400 hover:text-gold-600 transition-colors"
            >
              <span className={`inline-block transition-transform duration-200 text-[10px]
                                ${showExtra ? 'rotate-90' : ''}`}>
                ▸
              </span>
              추가 정보 (선택)
              {(side !== '미분류' || relation || memo) && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-gold-600" />
              )}
            </button>

            {showExtra && (
              <div className="mt-3 space-y-3 animate-slide-up">
                {/* 구분 */}
                <div>
                  <label className="block text-[11px] font-semibold text-gold-500 mb-1.5">구분</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SIDE_OPTIONS.map((opt) => {
                      const isGroom = opt === '신랑측' || opt === '신랑 부모님'
                      const isBride = opt === '신부측' || opt === '신부 부모님'
                      const isActive = side === opt

                      let activeStyle = 'bg-gold-50 border-gold-600 text-gold-600'
                      if (isActive && isGroom) activeStyle = 'bg-groom-100 border-groom-600 text-groom-600'
                      if (isActive && isBride) activeStyle = 'bg-bride-100 border-bride-600 text-bride-600'

                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSide(opt)}
                          className={`px-3 py-1.5 rounded-full text-[12px] font-medium border
                                      transition-all duration-150
                            ${isActive
                              ? `${activeStyle} border-2 font-bold`
                              : 'border-gold-300 text-gold-500 bg-ivory hover:bg-gold-50'
                            }`}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 관계 */}
                <div>
                  <label className="block text-[11px] font-semibold text-gold-500 mb-1.5">관계</label>
                  <input
                    type="text"
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                    placeholder="예: 대학동기, 직장동료, 고모부"
                    className="w-full px-4 py-2.5 rounded-xl border border-gold-200 bg-parchment text-sm
                               text-gold-800
                               focus:border-gold-600 focus:outline-none transition-all
                               placeholder:text-gold-300"
                  />
                </div>

                {/* 메모 */}
                <div>
                  <label className="block text-[11px] font-semibold text-gold-500 mb-1.5">메모</label>
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="예: 안경 쓴 분, 파란 넥타이"
                    className="w-full px-4 py-2.5 rounded-xl border border-gold-200 bg-parchment text-sm
                               text-gold-800
                               focus:border-gold-600 focus:outline-none transition-all
                               placeholder:text-gold-300"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 접수 버튼 */}
          <button
            type="submit"
            disabled={!name.trim() || !amount || isSubmitting}
            className="w-full mt-5 py-4 rounded-xl text-white font-bold text-[16px]
                       tracking-wider
                       bg-gradient-to-br from-gold-600 to-[#A67C1E]
                       hover:from-[#7A5C10] hover:to-gold-600
                       active:scale-[0.98]
                       disabled:from-gold-300 disabled:to-gold-300 disabled:cursor-not-allowed
                       transition-all duration-150
                       shadow-md shadow-gold-600/15"
          >
            {isSubmitting ? '접수 중...' : '접수 완료'}
          </button>
        </form>

        {/* ── 최근 접수 내역 ── */}
        <section className="mt-6">
          <h2 className="text-[12px] font-semibold text-gold-400 mb-3 uppercase tracking-wider">
            최근 접수
          </h2>
          <div className="space-y-2">
            {recentGuests.length === 0 ? (
              <p className="text-center text-gold-400 py-10 text-sm">
                아직 접수 내역이 없습니다
              </p>
            ) : (
              recentGuests.map((guest, i) => (
                <div
                  key={guest.id}
                  className="flex items-center justify-between px-4 py-3 bg-ivory rounded-xl
                             border border-gold-200 animate-slide-up"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gold-50 border border-gold-200
                                    flex items-center justify-center
                                    text-sm font-bold text-gold-600">
                      {guest.name[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-gold-800">
                        {guest.name}
                        {guest.side && guest.side !== '미분류' && (
                          <span className={`ml-1.5 inline-block text-[10px] font-semibold px-1.5 py-0.5
                                            rounded-full border ${getSideBadgeStyle(guest.side)}`}>
                            {guest.side}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-gold-400">
                        {formatDateTime(guest.created_at)}
                        {guest.memo && (
                          <span className="ml-1.5 text-gold-300">· {guest.memo}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <p className="font-bold text-gold-600">
                    {formatAmount(guest.amount)}
                    <span className="text-gold-400 font-medium text-[12px]">원</span>
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
