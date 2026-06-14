import type { PlayerCard } from '../game/types'
import { formatRatingValue } from './format'

export function getRatingLabel(ovr: number) {
  if (ovr >= 97) {
    return '历史级核心'
  }

  if (ovr >= 94) {
    return '超巨即战力'
  }

  if (ovr >= 90) {
    return '明星主力'
  }

  if (ovr >= 86) {
    return '强力拼图'
  }

  return '轮换补强'
}

export function getRatingPercent(value: number | null | undefined) {
  return `${Math.max(0, Math.min(100, formatRatingValue(value) ?? 0))}%`
}

export function getCoreRatingRows(card: PlayerCard) {
  const ratings = card.ratings

  return [
    { label: '进攻', value: ratings?.offense },
    { label: '防守', value: ratings?.defense },
    { label: '体能', value: ratings?.physical },
    { label: '心态', value: ratings?.mentality },
  ]
}

export function getAttributeGroupRows(card: PlayerCard) {
  const groups = card.sourceAttributes?.groups

  return [
    { label: '外线终结', value: groups?.outsideScoring },
    { label: '内线终结', value: groups?.insideScoring },
    { label: '组织控场', value: groups?.playmaking },
    { label: '单防协防', value: groups?.defense },
    { label: '篮板保护', value: groups?.rebounding },
    { label: '运动能力', value: groups?.athleticism },
    { label: '无形价值', value: groups?.intangibles },
  ]
}

export function getAttributeRows(card: PlayerCard) {
  const attributes = card.sourceAttributes?.attributes

  return [
    { label: '投篮选择', value: attributes?.shotIQ },
    { label: '进攻稳定', value: attributes?.offensiveConsistency },
    { label: '传球判断', value: attributes?.passIQ },
    { label: '协防判断', value: attributes?.helpDefenseIQ },
    { label: '防守稳定', value: attributes?.defensiveConsistency },
    { label: '耐力', value: attributes?.stamina },
    { label: '耐用度', value: attributes?.durability },
    { label: '力量', value: attributes?.strength },
    { label: '敏捷', value: attributes?.agility },
  ]
}
