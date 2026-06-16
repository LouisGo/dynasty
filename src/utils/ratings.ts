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

export function getPeakImpactRows(card: PlayerCard) {
  const impact = card.peakImpact

  return [
    { label: '巅峰值', value: impact.peakValue },
    { label: '主攻发动', value: impact.primaryEngine },
    { label: '空间牵制', value: impact.gravity },
    { label: '防守支点', value: impact.defensiveAnchor },
    { label: '侧翼价值', value: impact.wingValue },
    { label: '篮板回合', value: impact.rebounding },
    { label: '可持续性', value: impact.availability },
  ]
}

export function getPeakImpactSourceLabel(card: PlayerCard) {
  const { sourceType, confidence } = card.peakImpact
  const sourceLabel =
    sourceType === 'manual-peak'
      ? '人工巅峰校准'
      : sourceType === 'hybrid-peak'
        ? '2K 参考 + 人工巅峰校准'
        : sourceType === 'estimated-peak'
          ? '巅峰估算'
          : '2K 快照参考'
  const confidenceLabel =
    confidence === 'high' ? '高置信' : confidence === 'medium' ? '中置信' : '低置信'

  return `${sourceLabel} · ${confidenceLabel}`
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
