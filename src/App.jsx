import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import { Link } from 'react-router-dom'

const QUICK_AMOUNTS = [30000, 50000, 70000, 100000, 150000, 200000, 300000, 500000]

function formatAmount(num) {
  if (!num) return ''
  return num.toLocaleString('ko-KR')
}

function formatAmountShort(num) {
  if (num >= 10000) {
    const man = num / 10000
    return man % 1 === 0 ? `${man}만` : `${man}만`
  }
  return formatAmount(num)
}

export default function App() {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [side, setSide] = useState('미분류')
  const [relation, setRelation] = useState('')
  const [memo, setMemo] = useState('')
  const [showExtra, setShowExtra] = useState(false)
  const [recentGuests, setRecentGuests] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [todayTotal, setTodayTotal] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const nameInputRef = useRef(null)

  const SIDE_OPTIONS = ['미분류', '신랑측', '신부측', '신랑 부모님', '신부 부모님', '기타']

  useEffect(() => {
    fetchRecent()

    // Supabase 실시간 구독
    const channel = supabase
      .channel('guests-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, () => {
        fetchRecent()
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

    // 총액 계산
    const { data: allData } = await supabase
      .from('guests')
      .select('amount')

    if (allData) {
      setTodayTotal(allData.reduce((sum, g) => sum + (g.amount || 0), 0))
      setTodayCount(allData.length)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !amount) return

    setIsSubmitting(true)

    const { error } = await supabase
      .from('guests')
      .insert([{
        name: name.trim(),
        amount: parseInt(amount),
        side: side,
        relation: relation.trim(),
        memo: memo.trim(),
        recorded_by: '',
      }])

    setIsSubmitting(false)

    if (!error) {
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

  function handleQuickAmount(val) {
    setAmount(String(val))
  }

  const numericAmount = parseInt(amount) || 0

  return (
    <div className="min-h-screen bg-ivory">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-ivory/80 backdrop-blur-md border-b border-sage-100">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-bold text-sage-700">축의금 접수</h1>
            <p className="text-xs text-sage-400 mt-0.5">
              {todayCount}명 · {formatAmount(todayTotal)}원
            </p>
          </div>
          <Link
            to="/admin"
            className="text-xs px-3 py-1.5 rounded-full bg-sage-50 text-sage-600 hover:bg-sage-100 transition-colors"
          >
            관리자
          </Link>
        </div>
      </header>

      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-scale-in">
          <div className="bg-sage-600 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-lg">
            ✓ 접수 완료
          </div>
        </div>
      )}

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-sage-600 mb-1.5">
              하객 이름
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름 입력"
              className="w-full px-4 py-3.5 rounded-xl border-2 border-sage-100 bg-white text-lg
                         focus:border-sage-400 focus:outline-none transition-colors
                         placeholder:text-sage-200"
              autoComplete="off"
            />
          </div>

          {/* 금액 */}
          <div>
            <label className="block text-sm font-medium text-sage-600 mb-1.5">
              축의금
              {numericAmount > 0 && (
                <span className="ml-2 text-sage-400 font-normal">
                  {formatAmount(numericAmount)}원
                </span>
              )}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="금액 직접 입력"
              className="w-full px-4 py-3.5 rounded-xl border-2 border-sage-100 bg-white text-lg
                         focus:border-sage-400 focus:outline-none transition-colors
                         placeholder:text-sage-200"
              inputMode="numeric"
            />

            {/* 빠른 금액 선택 */}
            <div className="flex flex-wrap gap-2 mt-3">
              {QUICK_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAmount(val)}
                  className={`amount-chip ${
                    numericAmount === val
                      ? '!bg-sage-600 !text-white'
                      : ''
                  }`}
                >
                  {formatAmountShort(val)}
                </button>
              ))}
            </div>
          </div>

          {/* 추가 정보 (선택) */}
          <div>
            <button
              type="button"
              onClick={() => setShowExtra(!showExtra)}
              className="flex items-center gap-1.5 text-sm text-sage-400 hover:text-sage-600 transition-colors"
            >
              <span className={`inline-block transition-transform duration-200 ${showExtra ? 'rotate-90' : ''}`}>
                ▸
              </span>
              추가 정보 (선택)
              {(side !== '미분류' || relation || memo) && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-sage-400" />
              )}
            </button>

            {showExtra && (
              <div className="mt-3 space-y-3 animate-slide-up">
                {/* 구분 */}
                <div>
                  <label className="block text-xs font-medium text-sage-500 mb-1">구분</label>
                  <div className="flex flex-wrap gap-2">
                    {SIDE_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSide(opt)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150
                          ${side === opt
                            ? 'bg-sage-600 text-white'
                            : 'bg-sage-50 text-sage-500 hover:bg-sage-100'
                          }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 관계 */}
                <div>
                  <label className="block text-xs font-medium text-sage-500 mb-1">관계</label>
                  <input
                    type="text"
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                    placeholder="예: 대학동기, 직장동료, 고모부"
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-sage-100 bg-white text-sm
                               focus:border-sage-400 focus:outline-none transition-colors
                               placeholder:text-sage-200"
                  />
                </div>

                {/* 메모 */}
                <div>
                  <label className="block text-xs font-medium text-sage-500 mb-1">메모</label>
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="예: 안경 쓴 분, 파란 넥타이"
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-sage-100 bg-white text-sm
                               focus:border-sage-400 focus:outline-none transition-colors
                               placeholder:text-sage-200"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 접수 버튼 */}
          <button
            type="submit"
            disabled={!name.trim() || !amount || isSubmitting}
            className="w-full py-4 rounded-xl text-white font-semibold text-lg
                       bg-sage-600 hover:bg-sage-700 active:bg-sage-800
                       disabled:bg-sage-200 disabled:cursor-not-allowed
                       transition-all duration-150 active:scale-[0.98]"
          >
            {isSubmitting ? '접수 중...' : '접수하기'}
          </button>
        </form>

        {/* 최근 접수 내역 */}
        <section className="mt-8">
          <h2 className="text-sm font-medium text-sage-400 mb-3">최근 접수</h2>
          <div className="space-y-2">
            {recentGuests.length === 0 ? (
              <p className="text-center text-sage-300 py-8 text-sm">
                아직 접수 내역이 없습니다
              </p>
            ) : (
              recentGuests.map((guest, i) => (
                <div
                  key={guest.id}
                  className="flex items-center justify-between px-4 py-3 bg-white rounded-xl
                             border border-sage-50 animate-slide-up"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center
                                    text-sm font-medium text-sage-600">
                      {guest.name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-sage-700">
                        {guest.name}
                        {guest.side && guest.side !== '미분류' && (
                          <span className="ml-1.5 text-xs font-normal text-sage-400">{guest.side}</span>
                        )}
                      </p>
                      <p className="text-xs text-sage-400">
                        {new Date(guest.created_at).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {guest.memo && (
                          <span className="ml-1.5 text-sage-300">· {guest.memo}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-sage-700">
                    {formatAmount(guest.amount)}
                    <span className="text-sage-400 font-normal text-sm">원</span>
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
