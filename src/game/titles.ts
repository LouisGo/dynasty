import type { PlayerCard, ResultTitle, ResultSummary, StarterAssignment } from './types'

function sumPower(players: StarterAssignment[]) {
  return players.reduce((total, player) => total + player.power, 0)
}

export function pickDynastyTitle(
  summary: Omit<ResultSummary, 'title'>,
  playerIndex: Map<string, PlayerCard>,
): ResultTitle {
  const guardPower = sumPower(
    summary.starters.filter((player) => player.slot === 'PG' || player.slot === 'SG'),
  )
  const wingPower = sumPower(
    summary.starters.filter((player) => player.slot === 'SF' || player.slot === 'PF'),
  )
  const bigPower =
    summary.starters.find((player) => player.slot === 'C')?.power ?? summary.sixthMan.power
  const legends = summary.starters.filter((player) => {
    const card = playerIndex.get(player.playerId)
    return card?.tier === 'T0'
  }).length

  if (summary.teamRating >= 97 || (summary.totalPower >= 583 && legends >= 2)) {
    return {
      label: '历史神罚队',
      subtitle: '你不是在补强阵容，你是在重写篮球神话的封面。',
    }
  }

  if (summary.efficiencyScore >= 7.4 && summary.budgetRemaining >= 16) {
    return {
      label: '平民王朝模板',
      subtitle: '工资表没炸，冠军想象力先炸了。',
    }
  }

  if (summary.totalStars >= 5) {
    return {
      label: '赌桌王朝',
      subtitle: '你没有平均主义，只有不断加码的偏爱。',
    }
  }

  if (guardPower >= 195) {
    return {
      label: '后场核爆实验室',
      subtitle: '持球和投射已经把比赛节奏掰成了自己的样子。',
    }
  }

  if (wingPower + bigPower >= 286) {
    return {
      label: '禁区旧神复辟',
      subtitle: '尺寸、对抗和篮下终结把对手压回了旧时代。',
    }
  }

  const benchCard = playerIndex.get(summary.sixthMan.playerId)
  if (benchCard && (benchCard.tier === 'T1' || benchCard.tier === 'T0')) {
    return {
      label: '替补席上还有核弹',
      subtitle: '第六人下车时，别人的主力阵容就开始发抖。',
    }
  }

  return {
    label: '能赢一切的幻想阵容',
    subtitle: '也许不是最贵，但看起来已经够像冠军。',
  }
}
