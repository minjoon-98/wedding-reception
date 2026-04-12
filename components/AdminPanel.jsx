'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { SIDE_OPTIONS } from '@/lib/constants'
import { getSideBadgeStyle } from '@/lib/constants'
import { formatAmount, formatDateTime } from '@/lib/format'
import StatsCards from '@/components/StatsCards'

const GROOM_SIDES = ['신랑측', '신랑 부모님', '미분류']
const BRIDE_SIDES = ['신부측', '신부 부모님', '미분류']

export default function AdminPanel({ weddingId, side, role }) {
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSide, setFilterSide] = useState('전체')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkSide, setBulkSide] = useState('미분류')
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const channelRef = useRef(null)

  // Load guests
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .eq('wedding_id', weddingId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setGuests(data)
      }
      setLoading(false)
    }
    load()
  }, [weddingId])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`admin-guests-${weddingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'guests',
          filter: `wedding_id=eq.${weddingId}`,
        },
        (payload) => {
          setGuests((prev) => {
            if (prev.some((g) => g.id === payload.new.id)) return prev
            return [payload.new, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'guests',
          filter: `wedding_id=eq.${weddingId}`,
        },
        (payload) => {
          setGuests((prev) =>
            prev.map((g) => (g.id === payload.new.id ? payload.new : g))
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'guests',
          filter: `wedding_id=eq.${weddingId}`,
        },
        (payload) => {
          setGuests((prev) => prev.filter((g) => g.id !== payload.old.id))
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
    }
  }, [weddingId])

  // 측별 접근 시 해당 측 데이터만 표시
  const sideFilteredGuests = useMemo(() => {
    if (role === 'admin') return guests
    if (side === 'groom') return guests.filter((g) => GROOM_SIDES.includes(g.side))
    if (side === 'bride') return guests.filter((g) => BRIDE_SIDES.includes(g.side))
    return [] // side 미확인 시 빈 배열 (보안)
  }, [guests, side, role])

  // 측별 필터 옵션도 제한
  const availableSideOptions = useMemo(() => {
    if (role === 'admin' || !side) return SIDE_OPTIONS
    return side === 'groom' ? ['신랑측', '신랑 부모님', '미분류'] : ['신부측', '신부 부모님', '미분류']
  }, [side, role])

  // Filtered + sorted guests
  const filteredGuests = useMemo(() => {
    let result = [...sideFilteredGuests]

    if (filterSide !== '전체') {
      result = result.filter((g) => g.side === filterSide)
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (g) =>
          g.name?.toLowerCase().includes(q) ||
          g.relation?.toLowerCase().includes(q) ||
          g.memo?.toLowerCase().includes(q)
      )
    }

    result.sort((a, b) => {
      let aVal = a[sortKey]
      let bVal = b[sortKey]
      if (sortKey === 'amount') {
        aVal = aVal || 0
        bVal = bVal || 0
      }
      if (sortKey === 'created_at') {
        aVal = aVal || ''
        bVal = bVal || ''
      }
      if (sortKey === 'name') {
        aVal = (aVal || '').toLowerCase()
        bVal = (bVal || '').toLowerCase()
      }
      if (aVal < bVal) return sortAsc ? -1 : 1
      if (aVal > bVal) return sortAsc ? 1 : -1
      return 0
    })

    return result
  }, [sideFilteredGuests, filterSide, search, sortKey, sortAsc])

  // Toggle selection
  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filteredGuests.length && filteredGuests.length > 0) {
        return new Set()
      }
      return new Set(filteredGuests.map((g) => g.id))
    })
  }, [filteredGuests])

  // Bulk classify
  const handleBulkClassify = useCallback(async () => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)

    const { error } = await supabase
      .from('guests')
      .update({ side: bulkSide })
      .in('id', ids)

    if (error) {
      alert('분류 변경에 실패했습니다.')
      return
    }
    setGuests((prev) =>
      prev.map((g) => (ids.includes(g.id) ? { ...g, side: bulkSide } : g))
    )
    setSelectedIds(new Set())
  }, [selectedIds, bulkSide])

  // Inline edit
  const startEdit = useCallback((guest) => {
    setEditingId(guest.id)
    setEditData({
      name: guest.name || '',
      amount: String(guest.amount || ''),
      side: guest.side || '미분류',
      relation: guest.relation || '',
      memo: guest.memo || '',
    })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditData({})
  }, [])

  const saveEdit = useCallback(async () => {
    if (!editingId) return

    const updates = {
      name: editData.name.trim(),
      amount: editData.amount ? parseInt(editData.amount, 10) : 0,
      side: editData.side,
      relation: editData.relation.trim() || null,
      memo: editData.memo.trim() || null,
    }

    const { error } = await supabase
      .from('guests')
      .update(updates)
      .eq('id', editingId)

    if (error) {
      alert('수정에 실패했습니다.')
      return
    }
    setGuests((prev) =>
      prev.map((g) => (g.id === editingId ? { ...g, ...updates } : g))
    )
    setEditingId(null)
    setEditData({})
  }, [editingId, editData])

  // Delete
  const handleDelete = useCallback(
    async (id) => {
      if (!confirm('정말 삭제하시겠습니까?')) return

      const { error } = await supabase
        .from('guests')
        .delete()
        .eq('id', id)

      if (!error) {
        setGuests((prev) => prev.filter((g) => g.id !== id))
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    []
  )

  // CSV export
  const handleExport = useCallback(() => {
    const headers = ['이름', '금액', '구분', '관계', '메모', '접수자', '접수시간']
    const rows = filteredGuests.map((g) => [
      g.name || '',
      g.amount || 0,
      g.side || '',
      g.relation || '',
      g.memo || '',
      g.recorded_by || '',
      g.created_at || '',
    ])

    const bom = '\uFEFF'
    const csv = bom + [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `guests_${weddingId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredGuests, weddingId])

  const handleSort = useCallback(
    (key) => {
      if (sortKey === key) {
        setSortAsc((prev) => !prev)
      } else {
        setSortKey(key)
        setSortAsc(true)
      }
    },
    [sortKey]
  )

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-gold-500 animate-pulse">불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <StatsCards guests={sideFilteredGuests} />

      {/* Toolbar */}
      <div className="space-y-3">
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름, 관계, 메모 검색..."
          className="w-full h-10 px-4 border-2 border-gold-200 rounded-xl bg-white
            focus:border-gold-600 focus:ring-2 focus:ring-gold-100
            outline-none transition-all text-sm"
        />

        {/* Filters + Sort */}
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={filterSide}
            onChange={(e) => setFilterSide(e.target.value)}
            className="h-9 px-3 border border-gold-200 rounded-lg bg-white text-sm text-gold-700"
          >
            <option value="전체">전체</option>
            {availableSideOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <button
            onClick={() => handleSort('created_at')}
            className={`h-9 px-3 rounded-lg text-sm border transition-colors
              ${sortKey === 'created_at' ? 'bg-gold-600 text-white border-gold-600' : 'bg-white text-gold-700 border-gold-200 hover:bg-gold-50'}`}
          >
            시간 {sortKey === 'created_at' ? (sortAsc ? '↑' : '↓') : ''}
          </button>
          <button
            onClick={() => handleSort('amount')}
            className={`h-9 px-3 rounded-lg text-sm border transition-colors
              ${sortKey === 'amount' ? 'bg-gold-600 text-white border-gold-600' : 'bg-white text-gold-700 border-gold-200 hover:bg-gold-50'}`}
          >
            금액 {sortKey === 'amount' ? (sortAsc ? '↑' : '↓') : ''}
          </button>
          <button
            onClick={() => handleSort('name')}
            className={`h-9 px-3 rounded-lg text-sm border transition-colors
              ${sortKey === 'name' ? 'bg-gold-600 text-white border-gold-600' : 'bg-white text-gold-700 border-gold-200 hover:bg-gold-50'}`}
          >
            이름 {sortKey === 'name' ? (sortAsc ? '↑' : '↓') : ''}
          </button>

          <button
            onClick={handleExport}
            className="h-9 px-3 rounded-lg text-sm border border-gold-200 bg-white text-gold-700 hover:bg-gold-50 transition-colors ml-auto"
          >
            CSV 내보내기
          </button>
        </div>

        {/* Bulk classify */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 p-3 bg-gold-50 rounded-xl border border-gold-200">
            <span className="text-sm text-gold-700">
              {selectedIds.size}명 선택됨
            </span>
            <select
              value={bulkSide}
              onChange={(e) => setBulkSide(e.target.value)}
              className="h-8 px-2 border border-gold-200 rounded-lg bg-white text-sm"
            >
              {availableSideOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkClassify}
              className="h-8 px-3 rounded-lg text-sm font-medium bg-gold-600 text-white hover:bg-gold-700 transition-colors"
            >
              일괄 분류
            </button>
          </div>
        )}
      </div>

      {/* Guest table */}
      <div className="bg-white rounded-xl border border-gold-200 overflow-x-auto">
        {/* Table header */}
        <div className="flex items-center gap-2 px-4 py-2 bg-gold-50 border-b border-gold-200 text-xs text-gold-500 font-medium">
          <input
            type="checkbox"
            checked={selectedIds.size === filteredGuests.length && filteredGuests.length > 0}
            onChange={toggleSelectAll}
            className="shrink-0"
          />
          <span className="w-20 lg:w-28 shrink-0">이름</span>
          <span className="w-20 lg:w-28 shrink-0 text-right">금액</span>
          <span className="w-20 lg:w-24 shrink-0 text-center">구분</span>
          <span className="flex-1 hidden sm:block">관계/메모</span>
          <span className="w-20 shrink-0 hidden lg:block">접수자</span>
          <span className="w-24 shrink-0 text-right hidden sm:block">시간</span>
          <span className="w-16 shrink-0 text-right">작업</span>
        </div>

        {filteredGuests.length === 0 ? (
          <div className="text-center py-8 text-gold-400 text-sm">
            {search || filterSide !== '전체'
              ? '검색 결과가 없습니다'
              : '아직 접수된 하객이 없습니다'}
          </div>
        ) : (
          <div className="divide-y divide-gold-100">
            {filteredGuests.map((guest) => (
              <div key={guest.id}>
                {editingId === guest.id ? (
                  /* Edit mode */
                  <div className="p-3 space-y-2 bg-gold-50/50">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) =>
                          setEditData({ ...editData, name: e.target.value })
                        }
                        placeholder="이름"
                        className="h-8 px-2 border border-gold-200 rounded-lg text-sm bg-white"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editData.amount}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            amount: e.target.value.replace(/\D/g, ''),
                          })
                        }
                        placeholder="금액"
                        className="h-8 px-2 border border-gold-200 rounded-lg text-sm bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={editData.side}
                        onChange={(e) =>
                          setEditData({ ...editData, side: e.target.value })
                        }
                        className="h-8 px-2 border border-gold-200 rounded-lg text-sm bg-white"
                      >
                        {availableSideOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editData.relation}
                        onChange={(e) =>
                          setEditData({ ...editData, relation: e.target.value })
                        }
                        placeholder="관계"
                        className="h-8 px-2 border border-gold-200 rounded-lg text-sm bg-white"
                      />
                      <input
                        type="text"
                        value={editData.memo}
                        onChange={(e) =>
                          setEditData({ ...editData, memo: e.target.value })
                        }
                        placeholder="메모"
                        className="h-8 px-2 border border-gold-200 rounded-lg text-sm bg-white"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={cancelEdit}
                        className="h-7 px-3 rounded-lg text-xs border border-gold-200 text-gold-600 hover:bg-gold-50"
                      >
                        취소
                      </button>
                      <button
                        onClick={saveEdit}
                        className="h-7 px-3 rounded-lg text-xs bg-gold-600 text-white hover:bg-gold-700"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gold-50/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(guest.id)}
                      onChange={() => toggleSelect(guest.id)}
                      className="shrink-0"
                    />
                    <span className="w-20 lg:w-28 shrink-0 font-medium text-gold-800 truncate">
                      {guest.name}
                    </span>
                    <span className="w-20 lg:w-28 shrink-0 text-right text-gold-700">
                      {formatAmount(guest.amount)}
                    </span>
                    <span className="w-20 lg:w-24 shrink-0 text-center">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full border ${getSideBadgeStyle(guest.side)}`}
                      >
                        {guest.side}
                      </span>
                    </span>
                    <span className="flex-1 text-xs text-gold-400 truncate hidden sm:block">
                      {[guest.relation, guest.memo].filter(Boolean).join(' / ')}
                    </span>
                    <span className="w-20 shrink-0 text-xs text-gold-400 truncate hidden lg:block">
                      {guest.recorded_by}
                    </span>
                    <span className="w-24 shrink-0 text-right text-xs text-gold-400 hidden sm:block">
                      {formatDateTime(guest.created_at)}
                    </span>
                    <span className="w-16 shrink-0 flex justify-end gap-1">
                      <button
                        onClick={() => startEdit(guest)}
                        className="text-xs text-gold-500 hover:text-gold-700"
                        title="수정"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(guest.id)}
                        className="text-xs text-red-400 hover:text-red-600"
                        title="삭제"
                      >
                        🗑️
                      </button>
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="text-center text-sm text-gold-400">
        총 {filteredGuests.length}명
        {filterSide !== '전체' || search ? ` (전체 ${guests.length}명)` : ''}
      </div>
    </div>
  )
}
