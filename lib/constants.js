export const SIDE_OPTIONS = ['미분류', '신랑측', '신부측', '신랑 부모님', '신부 부모님', '기타']
export const QUICK_AMOUNTS = [30000, 50000, 70000, 100000, 150000, 200000, 300000, 500000]

export function getSideBadgeStyle(side) {
  if (side === '신랑측' || side === '신랑 부모님') return 'bg-groom-100 text-groom-600 border-groom-200'
  if (side === '신부측' || side === '신부 부모님') return 'bg-bride-100 text-bride-600 border-bride-200'
  return 'bg-gold-100 text-gold-500 border-gold-200'
}
