import { $ } from './dom.js';
import { projectRisk } from '../game/projects.js';
import { icon } from './icons.js';

export function renderProjects(s) {
  const targets = ['projectList', 'projectArchiveList']
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (!targets.length) return;
  if (!s.projects.length) {
    const compactEmpty = `<div class="project project--empty"><h4>暂无大型企划</h4><p>带有“企划”标记的行动会在这里生成跨周进度。</p></div>`;
    const archiveEmpty = `<div class="project-empty-state">
      <div class="project-empty-state__intro">
        <span class="project-empty-state__icon">${icon('projects')}</span>
        <div>
          <span class="eyebrow">PROJECT SLOT AVAILABLE</span>
          <h4>本学期还没有启动大型企划</h4>
          <p>普通行动维持同好会运转，大型企划会持续数周，并将负责人能力转化为作品、曝光和同好会资产。</p>
        </div>
      </div>
      <div class="project-seeds" aria-label="可启动企划类型">
        <span>社刊制作</span><span>漫展出摊</span><span>跨校联动</span><span>原创 视觉小说</span><span>交接文档</span>
      </div>
      <div class="project-empty-state__footer">
        <p>先在指挥台选择带有企划标记的行动，完成本周决策后即可建立进度档案。</p>
        <button class="btn ghost project-empty-state__action" type="button" data-route="command">${icon('back')}前往指挥台</button>
      </div>
    </div>`;
    targets.forEach((target) => {
      target.innerHTML = target.id === 'projectArchiveList' ? archiveEmpty : compactEmpty;
    });
    return;
  }
  const markup = s.projects.slice().reverse().map((p) => {
    const risk = projectRisk(p, s);
    const statusCls = p.done ? 'good' : risk >= 70 ? 'bad' : 'warn';
    const statusText = p.done ? '完成' : `${p.progress}%`;
    return `<div class="project" role="article" aria-label="${p.title},${p.done ? '已完成' : `进度 ${p.progress}%`},质量 ${p.quality},负荷 ${p.load},风险 ${risk}">
      <h4>${p.title}<span class="state-pill state-pill--${statusCls === 'good' ? 'good' : statusCls}"><span class="state-pill__icon" aria-hidden="true">${statusCls === 'good' ? '✓' : statusCls === 'warn' ? '●' : '⚠'}</span>${statusText}</span></h4>
      <p>${p.goal}</p>
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.progress}" aria-label="${p.title} 进度"><div style="width:${p.progress}%"></div></div>
      <div class="project-meta" style="margin-top:9px">
        <span class="tag">负责人 ${p.owner}</span>
        <span class="tag">质量 ${p.quality}</span>
        <span class="tag warn">负荷 ${p.load}</span>
        <span class="tag ${risk >= 70 ? 'bad' : 'good'}">风险 ${risk}</span>
      </div>
    </div>`;
  }).join('');
  targets.forEach((target) => { target.innerHTML = markup; });
}
