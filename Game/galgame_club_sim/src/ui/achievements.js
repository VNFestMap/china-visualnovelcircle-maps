import { $ } from './dom.js';
import { achievementDefs, getAchievementProgress, getRunGoals } from '../data/achievements.js';
import { icon } from './icons.js';

function achievementCard(achievement, unlocked, recent) {
  const isUnlocked = unlocked.includes(achievement.id);
  if (achievement.hidden && !isUnlocked) {
    return `<div class="achievement locked hidden-achievement">
      <div class="achievement__icon">${icon('trophy')}</div>
      <div><div class="achievement__title">隐藏成就</div><div class="achievement__desc">继续推进角色与同好会故事。</div></div>
    </div>`;
  }
  return `<div class="achievement ${isUnlocked ? 'unlocked' : 'locked'} ${recent.has(achievement.id) ? 'new' : ''}" role="listitem" aria-label="${achievement.title},${isUnlocked ? '已解锁' : '未解锁'}">
    <div class="achievement__icon" aria-hidden="true">${icon('trophy')}</div>
    <div>
      <div class="achievement__title">${achievement.title} <span class="achievement-tier">${achievement.category} · ${achievement.tier}</span></div>
      <div class="achievement__desc">${achievement.desc}</div>
    </div>
    <div class="achievement__status"><span class="state-pill state-pill--${isUnlocked ? 'good' : 'pending'}">${isUnlocked ? `+${achievement.points}` : '未解锁'}</span></div>
  </div>`;
}

export function renderAchievements(state) {
  const { unlocked, total, points } = getAchievementProgress(state);
  const recent = new Set(state.achievements?.recentlyUnlocked || []);
  const goals = getRunGoals(state);
  const recentDefs = achievementDefs
    .filter((achievement) => recent.has(achievement.id) || unlocked.includes(achievement.id))
    .slice(-3);

  $('#achievementCount').textContent = `${unlocked.length}/${total} · ${points}点`;
  $('#achievementList').innerHTML = `
    <div class="achievement-summary">
      <div><span>永久收藏</span><b>${unlocked.length}/${total}</b></div>
      <div><span>成就点数</span><b>${points}</b></div>
      <button class="btn ghost achievement-toggle" id="achievementToggle" aria-expanded="false">查看全部</button>
    </div>
    <div class="run-goals">${goals.map((goal) => `<div class="run-goal ${goal.complete ? 'complete' : ''}">
      <div><b>${goal.title}</b><span>${goal.current}/${goal.target}</span></div>
      <p>${goal.desc}</p><div class="progress"><div style="width:${goal.percent}%"></div></div>
    </div>`).join('')}</div>
    ${recentDefs.length ? `<div class="achievement-recent"><h4>最近收藏</h4>${recentDefs.map((achievement) => achievementCard(achievement, unlocked, recent)).join('')}</div>` : ''}
    <div class="achievement-all" id="achievementAll" hidden>${achievementDefs.map((achievement) => achievementCard(achievement, unlocked, recent)).join('')}</div>`;

  $('#achievementToggle')?.addEventListener('click', (event) => {
    const list = $('#achievementAll');
    const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
    event.currentTarget.setAttribute('aria-expanded', String(!expanded));
    event.currentTarget.textContent = expanded ? '查看全部' : '收起列表';
    list.hidden = expanded;
  });
}
