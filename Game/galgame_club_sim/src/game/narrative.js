const outcomes = {
  excellent: [
    '准备工作比预想得更顺。有人主动补上遗漏的环节，讨论也很快形成了共识。',
    '活动结束后，群聊里仍有人继续交流。原本旁观的成员也开始询问下一次安排。',
  ],
  steady: [
    '过程里出现了几次停顿，但核心目标还是完成了。大家对下一步有了基本共识。',
    '结果算不上轰动，却让同好会的日常运转更扎实了一点。',
  ],
  troubled: [
    '临场协调比预期困难，几项准备直到最后才勉强补齐。',
    '行动完成了，但疲劳和沟通成本明显高于收获，复盘已经无法回避。',
  ],
};

function pick(lines, seed) {
  return lines[Math.abs(seed) % lines.length];
}

export function buildActionNarrative(state, action, member, calc, communityDelta) {
  const outcome = calc.fit >= 82 ? 'excellent' : calc.fit >= 62 ? 'steady' : 'troubled';
  const detail = pick(outcomes[outcome], state.week + member.name.length + action.id.length);
  const quote = outcome === 'excellent'
    ? `“${member.name}很清楚这件事应该从哪里开始。”`
    : outcome === 'troubled'
      ? `“先把这周撑过去，下次不能再这样临时处理了。”`
      : `“至少方向已经明确，接下来按节奏继续做。”`;
  const changes = [
    `${calc.fitRating} ${calc.fit}`,
    communityDelta.exposureGain ? `潜在关注 +${communityDelta.exposureGain}` : '',
    communityDelta.joined ? `新加入 +${communityDelta.joined}` : '',
    calc.skill.triggered ? `发动技能「${calc.skill.pack.name}」` : '',
  ].filter(Boolean);
  return {
    summary: `完成「${action.title}」`,
    detail: `${member.name}负责推进本周行动。${detail}`,
    quote,
    actors: [member.name],
    changes,
    category: action.project ? '企划推进' : '同好会日常',
    outcome,
    type: 'major',
  };
}
