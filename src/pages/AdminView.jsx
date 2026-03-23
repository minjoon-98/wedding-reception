import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

const SIDE_OPTIONS = ['미분류', '신랑측', '신부측', '신랑 부모님', '신부 부모님', '기타']

function formatAmount(num) {
  if (!num) return '0'
  return num.toLocaleString('ko-KR')
}

function getSideBadgeClasses(side) {
  if (side === '신랑측' || side === '신랑 부모님') return 'bg-groom-100 text-groom-600'
  if (side === '신부측' || side === '신부 부모님') return 'bg-bride-100 text-bride-600'
  if (side === '미분류') return 'bg-gold-50 text-gold-600 border border-gold-300'
  return 'bg-gold-100 text-gold-700'
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
  const [selected, setSelected] = useState(new Set())

  useEffect(() => {
    fetchGuests()

    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guests' }, (payload) => {
        setGuests(prev => [payload.new, ...prev])
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

  const filteredGuests = useMemo(() => {
    let result = [...guests]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(g =>
        g.name.toLowerCase().includes(q) ||
        (g.memo && g.memo.toLowerCase().includes(q)) ||
        (g.relation && g.relation.toLowerCase().includes(q))
      )
    }

    if (filterSide !== '전체') {
      result = result.filter(g => g.side === filterSide)
    }

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

  // ── 체크박스 ──
  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filteredGuests.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredGuests.map(g => g.id)))
    }
  }

  // ── 선택된 항목 일괄 분류 ──
  async function bulkClassifySelected(targetSide) {
    if (selected.size === 0) return
    if (!window.confirm(`선택한 ${selected.size}명을 "${targetSide}"(으)로 변경하시겠습니까?`)) return

    const ids = [...selected]
    for (const id of ids) {
      await supabase.from('guests').update({ side: targetSide }).eq('id', id)
    }

    // 즉시 로컬 반영
    setGuests(prev => prev.map(g =>
      selected.has(g.id) ? { ...g, side: targetSide } : g
    ))
    setSelected(new Set())
  }

  // ── 인라인 수정 ──
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
    const updates = {
      name: editForm.name,
      amount: parseInt(editForm.amount) || 0,
      side: editForm.side,
      relation: editForm.relation,
      memo: editForm.memo,
    }

    const { error } = await supabase
      .from('guests')
      .update(updates)
      .eq('id', id)

    if (!error) {
      // 즉시 로컬 반영
      setGuests(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g))
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
    const { error } = await supabase.from('guests').delete().eq('id', id)
    if (!error) {
      // 즉시 로컬 반영
      setGuests(prev => prev.filter(g => g.id !== id))
      setSelected(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gold-400 text-sm">불러오는 중...</p>
      </div>
    )
  }

  const allChecked = filteredGuests.length > 0 && selected.size === filteredGuests.length

  return (
    <div className="min-h-screen pb-10">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-ivory/90 backdrop-blur-md border-b border-gold-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-[4px] text-gold-400 uppercase">Admin</p>
            <h1 className="font-display text-lg font-bold text-gold-800">축의금 관리</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCSV}
              className="text-[12px] px-4 py-2 rounded-full font-semibold
                         bg-gradient-to-br from-gold-600 to-[#A67C1E] text-white
                         hover:from-[#7A5C10] hover:to-gold-600
                         shadow-sm shadow-gold-600/15 transition-all"
            >
              CSV 다운로드
            </button>
            <Link
              to="/"
              className="text-[12px] px-4 py-2 rounded-full border border-gold-300 text-gold-600
                         hover:bg-gold-50 transition-colors"
            >
              접수 화면
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5">
        {/* 통계 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-ivory rounded-2xl p-4 border border-gold-200 shadow-sm shadow-gold-600/5">
            <p className="text-[11px] text-gold-500">전체</p>
            <p className="text-xl font-extrabold text-gold-600 mt-1">{formatAmount(stats.total)}원</p>
            <p className="text-[11px] text-gold-400 mt-0.5">{stats.count}명</p>
          </div>
          {Object.entries(stats.bySide).map(([side, data]) => (
            <div key={side} className="bg-ivory rounded-2xl p-4 border border-gold-200 shadow-sm shadow-gold-600/5">
              <p className="text-[11px] text-gold-500">{side}</p>
              <p className="text-lg font-bold text-gold-800 mt-1">{formatAmount(data.amount)}원</p>
              <p className="text-[11px] text-gold-400 mt-0.5">{data.count}명</p>
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
            className="flex-1 px-4 py-2.5 rounded-xl border border-gold-200 bg-ivory
                       focus:border-gold-600 focus:outline-none text-sm text-gold-800
                       placeholder:text-gold-300"
          />
          <div className="flex gap-1.5 flex-wrap">
            {['전체', ...SIDE_OPTIONS].map((s) => (
              <button
                key={s}
                onClick={() => setFilterSide(s)}
                className={`px-3 py-2 rounded-full text-[12px] font-medium transition-all border
                  ${filterSide === s
                    ? 'bg-gold-600 text-white border-gold-600'
                    : 'bg-ivory text-gold-600 border-gold-300 hover:bg-gold-50'
                  }`}
              >
                {s}
                {s !== '전체' && stats.bySide[s] && (
                  <span className="ml-1 opacity-70">{stats.bySide[s].count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 정렬 & 선택 일괄 분류 */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gold-400">정렬:</span>
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
                className={`text-[12px] px-2.5 py-1 rounded-lg transition-colors
                  ${sortBy === key
                    ? 'bg-gold-100 text-gold-700 font-semibold'
                    : 'text-gold-400 hover:text-gold-600'
                  }`}
              >
                {label}
                {sortBy === key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
              </button>
            ))}
          </div>

          {/* 선택 항목 일괄 분류 */}
          {selected.size > 0 && (
            <div className="flex items-center gap-1.5 bg-gold-50 rounded-xl px-3 py-1.5 border border-gold-200
                            animate-slide-up">
              <span className="text-[12px] font-semibold text-gold-700">
                {selected.size}명 선택
              </span>
              <span className="text-gold-300 mx-1">|</span>
              {SIDE_OPTIONS.filter(s => s !== '미분류').map(s => {
                const isGroom = s === '신랑측' || s === '신랑 부모님'
                const isBride = s === '신부측' || s === '신부 부모님'
                return (
                  <button
                    key={s}
                    onClick={() => bulkClassifySelected(s)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-colors
                      ${isGroom ? 'bg-groom-100 text-groom-600 hover:bg-groom-200'
                        : isBride ? 'bg-bride-100 text-bride-600 hover:bg-bride-200'
                        : 'bg-gold-100 text-gold-600 hover:bg-gold-200'}`}
                  >
                    {s}
                  </button>
                )
              })}
              <button
                onClick={() => setSelected(new Set())}
                className="text-[11px] px-2 py-1 rounded-lg text-gold-400 hover:text-gold-600
                           ml-1"
              >
                취소
              </button>
            </div>
          )}
        </div>

        {/* ── 모바일: 전체선택 + 카드 리스트 ── */}
        <div className="sm:hidden">
          <div className="flex items-center gap-2 mb-3 px-1">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded accent-[#8B6914] cursor-pointer"
            />
            <span className="text-[12px] text-gold-500">전체 선택</span>
          </div>

          {filteredGuests.length === 0 ? (
            <p className="text-center text-gold-300 py-10 text-sm">
              {search ? '검색 결과가 없습니다' : '접수 내역이 없습니다'}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredGuests.map((guest) => (
                <div
                  key={guest.id}
                  className={`bg-ivory rounded-xl border border-gold-200 p-4
                              ${selected.has(guest.id) ? 'ring-2 ring-gold-600/30' : ''}`}
                >
                  {editingId === guest.id ? (
                    <div className="space-y-2.5">
                      <input type="text" value={editForm.name}
                        onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gold-200 rounded-lg text-sm bg-parchment"
                        placeholder="이름" />
                      <input type="number" value={editForm.amount}
                        onChange={(e) => setEditForm(f => ({ ...f, amount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gold-200 rounded-lg text-sm bg-parchment text-right"
                        placeholder="금액" inputMode="numeric" />
                      <select value={editForm.side}
                        onChange={(e) => setEditForm(f => ({ ...f, side: e.target.value }))}
                        className="w-full px-3 py-2 border border-gold-200 rounded-lg text-sm bg-ivory">
                        {SIDE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input type="text" value={editForm.relation}
                        onChange={(e) => setEditForm(f => ({ ...f, relation: e.target.value }))}
                        placeholder="관계" className="w-full px-3 py-2 border border-gold-200 rounded-lg text-sm bg-parchment" />
                      <input type="text" value={editForm.memo}
                        onChange={(e) => setEditForm(f => ({ ...f, memo: e.target.value }))}
                        placeholder="메모" className="w-full px-3 py-2 border border-gold-200 rounded-lg text-sm bg-parchment" />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(guest.id)}
                          className="flex-1 py-2 text-[12px] rounded-lg bg-gold-600 text-white font-semibold">저장</button>
                        <button onClick={cancelEdit}
                          className="flex-1 py-2 text-[12px] rounded-lg bg-gold-100 text-gold-600">취소</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(guest.id)}
                          onChange={() => toggleSelect(guest.id)}
                          className="w-4 h-4 mt-1 rounded accent-[#8B6914] cursor-pointer flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gold-800">{guest.name}</span>
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold
                                ${getSideBadgeClasses(guest.side || '미분류')}`}>
                                {guest.side || '미분류'}
                              </span>
                            </div>
                            <span className="font-bold text-gold-600 text-[15px]">
                              {formatAmount(guest.amount)}원
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gold-400">
                            <span>{new Date(guest.created_at).toLocaleTimeString('ko-KR', {
                              hour: '2-digit', minute: '2-digit'
                            })}</span>
                            {guest.relation && <span>· {guest.relation}</span>}
                            {guest.memo && <span className="text-gold-300">· {guest.memo}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-2.5 ml-7">
                        <button onClick={() => startEdit(guest)}
                          className="px-3 py-1.5 text-[11px] rounded-lg bg-gold-50 text-gold-600
                                     border border-gold-200">수정</button>
                        <button onClick={() => deleteGuest(guest.id, guest.name)}
                          className="px-3 py-1.5 text-[11px] rounded-lg bg-bride-50 text-bride-600
                                     border border-bride-200">삭제</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 데스크탑: 테이블 ── */}
        <div className="hidden sm:block bg-ivory rounded-2xl border border-gold-200 overflow-hidden
                        shadow-sm shadow-gold-600/5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gold-50/70">
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" checked={allChecked} onChange={toggleSelectAll}
                      className="w-4 h-4 rounded accent-[#8B6914] cursor-pointer" />
                  </th>
                  <th className="text-left px-4 py-3 text-[12px] text-gold-500 font-semibold">이름</th>
                  <th className="text-right px-4 py-3 text-[12px] text-gold-500 font-semibold">금액</th>
                  <th className="text-left px-4 py-3 text-[12px] text-gold-500 font-semibold">구분</th>
                  <th className="text-left px-4 py-3 text-[12px] text-gold-500 font-semibold">관계</th>
                  <th className="text-left px-4 py-3 text-[12px] text-gold-500 font-semibold">메모</th>
                  <th className="text-left px-4 py-3 text-[12px] text-gold-500 font-semibold">시간</th>
                  <th className="text-center px-4 py-3 text-[12px] text-gold-500 font-semibold">편집</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold-100">
                {filteredGuests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gold-300">
                      {search ? '검색 결과가 없습니다' : '접수 내역이 없습니다'}
                    </td>
                  </tr>
                ) : (
                  filteredGuests.map((guest) => (
                    <tr key={guest.id}
                      className={`hover:bg-gold-50/50 transition-colors ${
                        selected.has(guest.id) ? 'bg-gold-50/60' :
                        guest.side === '미분류' ? 'bg-gold-50/30' : ''
                      }`}>
                      <td className="w-10 px-3 py-3">
                        <input type="checkbox" checked={selected.has(guest.id)}
                          onChange={() => toggleSelect(guest.id)}
                          className="w-4 h-4 rounded accent-[#8B6914] cursor-pointer" />
                      </td>
                      {editingId === guest.id ? (
                        <>
                          <td className="px-3 py-2">
                            <input type="text" value={editForm.name}
                              onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                              className="w-full px-2 py-1 border border-gold-200 rounded-lg text-sm bg-parchment" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" value={editForm.amount}
                              onChange={(e) => setEditForm(f => ({ ...f, amount: e.target.value }))}
                              className="w-full px-2 py-1 border border-gold-200 rounded-lg text-sm text-right bg-parchment"
                              inputMode="numeric" />
                          </td>
                          <td className="px-3 py-2">
                            <select value={editForm.side}
                              onChange={(e) => setEditForm(f => ({ ...f, side: e.target.value }))}
                              className="w-full px-2 py-1 border border-gold-200 rounded-lg text-sm bg-ivory">
                              {SIDE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={editForm.relation}
                              onChange={(e) => setEditForm(f => ({ ...f, relation: e.target.value }))}
                              placeholder="관계"
                              className="w-full px-2 py-1 border border-gold-200 rounded-lg text-sm bg-parchment" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={editForm.memo}
                              onChange={(e) => setEditForm(f => ({ ...f, memo: e.target.value }))}
                              placeholder="메모"
                              className="w-full px-2 py-1 border border-gold-200 rounded-lg text-sm bg-parchment" />
                          </td>
                          <td className="px-3 py-2 text-[11px] text-gold-400">
                            {new Date(guest.created_at).toLocaleTimeString('ko-KR', {
                              hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => saveEdit(guest.id)}
                                className="px-2.5 py-1 text-[11px] rounded-lg bg-gold-600 text-white font-semibold
                                           hover:bg-gold-700">저장</button>
                              <button onClick={cancelEdit}
                                className="px-2.5 py-1 text-[11px] rounded-lg bg-gold-100 text-gold-600
                                           hover:bg-gold-200">취소</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-gold-800">{guest.name}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-gold-600">
                            {formatAmount(guest.amount)}원
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold
                              ${getSideBadgeClasses(guest.side || '미분류')}`}>
                              {guest.side || '미분류'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gold-500">{guest.relation || '-'}</td>
                          <td className="px-4 py-3 text-gold-500">{guest.memo || '-'}</td>
                          <td className="px-4 py-3 text-[11px] text-gold-400">
                            {new Date(guest.created_at).toLocaleTimeString('ko-KR', {
                              hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => startEdit(guest)}
                                className="px-2.5 py-1 text-[11px] rounded-lg bg-gold-50 text-gold-600
                                           border border-gold-200 hover:bg-gold-100">수정</button>
                              <button onClick={() => deleteGuest(guest.id, guest.name)}
                                className="px-2.5 py-1 text-[11px] rounded-lg bg-bride-50 text-bride-600
                                           border border-bride-200 hover:bg-bride-100">삭제</button>
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

        <div className="mt-4 text-right text-sm text-gold-500">
          필터 결과: {filteredGuests.length}명 ·{' '}
          <span className="font-bold text-gold-600">
            {formatAmount(filteredGuests.reduce((s, g) => s + (g.amount || 0), 0))}원
          </span>
        </div>
      </main>
    </div>
  )
}
