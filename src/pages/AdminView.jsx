import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

const SIDE_OPTIONS = ['미분류', '신랑측', '신부측', '신랑 부모님', '신부 부모님', '기타']

function formatAmount(num) {
  if (!num) return '0'
  return num.toLocaleString('ko-KR')
}

export default function AdminView() {
  const [guests, setGuests] = useState([])
  const [search, setSearch] = useState('')
  const [filterSide, setFilterSide] = useState('전체')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchGuests()

    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, () => {
        fetchGuests()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchGuests() {
    const { data, error } = await supabase
      .from('guests')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setGuests(data)
    }
    setLoading(false)
  }

  // 필터 & 검색 & 정렬
  const filteredGuests = useMemo(() => {
    let result = [...guests]

    // 검색
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(g =>
        g.name.toLowerCase().includes(q) ||
        (g.memo && g.memo.toLowerCase().includes(q)) ||
        (g.relation && g.relation.toLowerCase().includes(q))
      )
    }

    // 필터
    if (filterSide !== '전체') {
      result = result.filter(g => g.side === filterSide)
    }

    // 정렬
    result.sort((a, b) => {
      let valA = a[sortBy]
      let valB = b[sortBy]
      if (sortBy === 'amount') {
        valA = valA || 0
        valB = valB || 0
      }
      if (sortBy === 'name') {
        valA = valA || ''
        valB = valB || ''
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }
      if (sortDir === 'asc') return valA > valB ? 1 : -1
      return valA < valB ? 1 : -1
    })

    return result
  }, [guests, search, filterSide, sortBy, sortDir])

  // 통계
  const stats = useMemo(() => {
    const total = guests.reduce((sum, g) => sum + (g.amount || 0), 0)
    const bySide = {}
    guests.forEach(g => {
      const side = g.side || '미분류'
      if (!bySide[side]) bySide[side] = { count: 0, amount: 0 }
      bySide[side].count++
      bySide[side].amount += g.amount || 0
    })
    return { total, count: guests.length, bySide }
  }, [guests])

  // 인라인 수정
  function startEdit(guest) {
    setEditingId(guest.id)
    setEditForm({
      name: guest.name,
      amount: guest.amount,
      side: guest.side || '미분류',
      relation: guest.relation || '',
      memo: guest.memo || '',
    })
  }

  async function saveEdit(id) {
    const { error } = await supabase
      .from('guests')
      .update({
        name: editForm.name,
        amount: parseInt(editForm.amount) || 0,
        side: editForm.side,
        relation: editForm.relation,
        memo: editForm.memo,
      })
      .eq('id', id)

    if (!error) {
      setEditingId(null)
      setEditForm({})
    }
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm({})
  }

  async function deleteGuest(id, name) {
    if (!window.confirm(`"${name}" 항목을 삭제하시겠습니까?`)) return
    await supabase.from('guests').delete().eq('id', id)
  }

  // CSV 다운로드
  function downloadCSV() {
    const headers = ['이름', '금액', '구분', '관계', '메모', '접수시간']
    const rows = filteredGuests.map(g => [
      g.name,
      g.amount,
      g.side || '미분류',
      g.relation || '',
      g.memo || '',
      new Date(g.created_at).toLocaleString('ko-KR'),
    ])

    const bom = '\uFEFF'
    const csv = bom + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `축의금_접수_${new Date().toLocaleDateString('ko-KR')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 일괄 분류
  async function bulkClassify(side) {
    const unclassified = filteredGuests.filter(g => g.side === '미분류')
    if (unclassified.length === 0) return
    if (!window.confirm(`필터된 미분류 ${unclassified.length}명을 "${side}"(으)로 변경하시겠습니까?`)) return

    for (const g of unclassified) {
      await supabase.from('guests').update({ side }).eq('id', g.id)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <p className="text-sage-400">불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ivory">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-ivory/80 backdrop-blur-md border-b border-sage-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-bold text-sage-700">관리자</h1>
            <p className="text-xs text-sage-400 mt-0.5">축의금 접수 관리</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCSV}
              className="text-xs px-3 py-1.5 rounded-full bg-sage-600 text-white hover:bg-sage-700 transition-colors"
            >
              CSV 다운로드
            </button>
            <Link
              to="/"
              className="text-xs px-3 py-1.5 rounded-full bg-sage-50 text-sage-600 hover:bg-sage-100 transition-colors"
            >
              접수 화면
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 통계 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 border border-sage-50">
            <p className="text-xs text-sage-400">전체</p>
            <p className="text-xl font-bold text-sage-700 mt-1">{formatAmount(stats.total)}원</p>
            <p className="text-xs text-sage-400 mt-0.5">{stats.count}명</p>
          </div>
          {Object.entries(stats.bySide).map(([side, data]) => (
            <div key={side} className="bg-white rounded-xl p-4 border border-sage-50">
              <p className="text-xs text-sage-400">{side}</p>
              <p className="text-lg font-bold text-sage-700 mt-1">{formatAmount(data.amount)}원</p>
              <p className="text-xs text-sage-400 mt-0.5">{data.count}명</p>
            </div>
          ))}
        </div>

        {/* 검색 & 필터 */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 메모, 관계로 검색..."
            className="flex-1 px-4 py-2.5 rounded-xl border-2 border-sage-100 bg-white
                       focus:border-sage-400 focus:outline-none text-sm
                       placeholder:text-sage-300"
          />
          <div className="flex gap-2 flex-wrap">
            {['전체', ...SIDE_OPTIONS].map((side) => (
              <button
                key={side}
                onClick={() => setFilterSide(side)}
                className={`px-3 py-2 rounded-full text-xs font-medium transition-colors
                  ${filterSide === side
                    ? 'bg-sage-600 text-white'
                    : 'bg-sage-50 text-sage-600 hover:bg-sage-100'
                  }`}
              >
                {side}
                {side !== '전체' && stats.bySide[side] && (
                  <span className="ml-1 opacity-70">{stats.bySide[side].count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 정렬 & 일괄 분류 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-sage-400">정렬:</span>
            {[
              { key: 'created_at', label: '시간' },
              { key: 'name', label: '이름' },
              { key: 'amount', label: '금액' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => {
                  if (sortBy === key) {
                    setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                  } else {
                    setSortBy(key)
                    setSortDir('desc')
                  }
                }}
                className={`text-xs px-2 py-1 rounded transition-colors
                  ${sortBy === key
                    ? 'bg-sage-200 text-sage-700 font-medium'
                    : 'text-sage-400 hover:text-sage-600'
                  }`}
              >
                {label}
                {sortBy === key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
              </button>
            ))}
          </div>

          {/* 일괄 분류 */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-sage-400 mr-1">일괄분류:</span>
            {SIDE_OPTIONS.filter(s => s !== '미분류').map(side => (
              <button
                key={side}
                onClick={() => bulkClassify(side)}
                className="text-xs px-2 py-1 rounded bg-warm-50 text-warm-600 hover:bg-warm-100 transition-colors"
              >
                {side}
              </button>
            ))}
          </div>
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-xl border border-sage-50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sage-50/50">
                  <th className="text-left px-4 py-3 text-sage-500 font-medium">이름</th>
                  <th className="text-right px-4 py-3 text-sage-500 font-medium">금액</th>
                  <th className="text-left px-4 py-3 text-sage-500 font-medium">구분</th>
                  <th className="text-left px-4 py-3 text-sage-500 font-medium">관계</th>
                  <th className="text-left px-4 py-3 text-sage-500 font-medium">메모</th>
                  <th className="text-left px-4 py-3 text-sage-500 font-medium">시간</th>
                  <th className="text-center px-4 py-3 text-sage-500 font-medium">편집</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-50">
                {filteredGuests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-sage-300">
                      {search ? '검색 결과가 없습니다' : '접수 내역이 없습니다'}
                    </td>
                  </tr>
                ) : (
                  filteredGuests.map((guest) => (
                    <tr
                      key={guest.id}
                      className={`hover:bg-sage-50/30 transition-colors ${
                        guest.side === '미분류' ? 'bg-warm-50/30' : ''
                      }`}
                    >
                      {editingId === guest.id ? (
                        <>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                              className="w-full px-2 py-1 border border-sage-200 rounded text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={editForm.amount}
                              onChange={(e) => setEditForm(f => ({ ...f, amount: e.target.value }))}
                              className="w-full px-2 py-1 border border-sage-200 rounded text-sm text-right"
                              inputMode="numeric"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={editForm.side}
                              onChange={(e) => setEditForm(f => ({ ...f, side: e.target.value }))}
                              className="w-full px-2 py-1 border border-sage-200 rounded text-sm bg-white"
                            >
                              {SIDE_OPTIONS.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={editForm.relation}
                              onChange={(e) => setEditForm(f => ({ ...f, relation: e.target.value }))}
                              placeholder="예: 대학동기"
                              className="w-full px-2 py-1 border border-sage-200 rounded text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={editForm.memo}
                              onChange={(e) => setEditForm(f => ({ ...f, memo: e.target.value }))}
                              placeholder="메모"
                              className="w-full px-2 py-1 border border-sage-200 rounded text-sm"
                            />
                          </td>
                          <td className="px-3 py-2 text-xs text-sage-400">
                            {new Date(guest.created_at).toLocaleTimeString('ko-KR', {
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => saveEdit(guest.id)}
                                className="px-2 py-1 text-xs rounded bg-sage-600 text-white hover:bg-sage-700"
                              >
                                저장
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-2 py-1 text-xs rounded bg-sage-100 text-sage-600 hover:bg-sage-200"
                              >
                                취소
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3">
                            <span className="font-medium text-sage-700">{guest.name}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-sage-700">
                            {formatAmount(guest.amount)}원
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
                              ${guest.side === '미분류'
                                ? 'bg-warm-100 text-warm-600'
                                : guest.side === '신랑측'
                                ? 'bg-blue-50 text-blue-600'
                                : guest.side === '신부측'
                                ? 'bg-blush-50 text-blush-500'
                                : 'bg-sage-100 text-sage-600'
                              }`}
                            >
                              {guest.side || '미분류'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sage-500">{guest.relation || '-'}</td>
                          <td className="px-4 py-3 text-sage-500">{guest.memo || '-'}</td>
                          <td className="px-4 py-3 text-xs text-sage-400">
                            {new Date(guest.created_at).toLocaleTimeString('ko-KR', {
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => startEdit(guest)}
                                className="px-2 py-1 text-xs rounded bg-sage-50 text-sage-600 hover:bg-sage-100"
                              >
                                수정
                              </button>
                              <button
                                onClick={() => deleteGuest(guest.id, guest.name)}
                                className="px-2 py-1 text-xs rounded bg-red-50 text-red-500 hover:bg-red-100"
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 하단 요약 */}
        <div className="mt-4 text-right text-sm text-sage-500">
          필터 결과: {filteredGuests.length}명 ·{' '}
          <span className="font-semibold text-sage-700">
            {formatAmount(filteredGuests.reduce((s, g) => s + (g.amount || 0), 0))}원
          </span>
        </div>
      </main>
    </div>
  )
}
