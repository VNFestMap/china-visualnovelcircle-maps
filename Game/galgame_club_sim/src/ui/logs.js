import { $ } from './dom.js';
import { icon } from './icons.js';

const REPORT_WEEKS = [16, 24, 40, 48];
let lastLogSignature = '';
let lastReportSignature = '';

function logKey(log) {
  return encodeURIComponent([
    log.week,
    log.summary || log.text || '',
    log.category || '',
    log.type || '',
  ].join('|'));
}

function renderReportEmpty(s) {
  const nextWeek = REPORT_WEEKS.find((week) => week >= s.week);
  const weeksRemaining = nextWeek == null ? 0 : Math.max(0, nextWeek - s.week);
  const statusText = nextWeek == null
    ? '本学年阶段节点已全部完成'
    : nextWeek === s.week
      ? `第 ${nextWeek} 周结算将在本轮行动后生成`
      : `距离第 ${nextWeek} 周总结还有 ${weeksRemaining} 周`;
  const milestones = REPORT_WEEKS.map((week) => {
    const state = week < s.week ? 'complete' : week === nextWeek ? 'next' : 'locked';
    const label = state === 'complete' ? '已通过' : state === 'next' ? '下一节点' : '待解锁';
    return `<div class="report-milestone report-milestone--${state}">
      <span class="report-milestone__dot" aria-hidden="true"></span>
      <strong>第 ${week} 周</strong>
      <small>${label}</small>
    </div>`;
  }).join('');

  return `<div class="report-empty-state">
    <div class="report-empty-state__intro">
      <span class="report-empty-state__icon">${icon('archive')}</span>
      <div><span class="eyebrow">TERM REVIEW</span><h4>首份阶段报告尚未生成</h4><p>${statusText}</p></div>
    </div>
    <div class="report-milestones" aria-label="阶段报告里程碑">${milestones}</div>
    <p class="report-empty-state__note">阶段报告会汇总成员规模、资源状况与企划表现，并给出下一阶段经营目标。</p>
  </div>`;
}

export function renderLogs(s) {
  const logList = $('#logList');
  const logSignature = JSON.stringify(s.logs);
  if (logSignature !== lastLogSignature) {
    const previousKeys = new Set([...logList.querySelectorAll('details[open]')]
      .map((details) => details.dataset.logKey));
    const previousScrollTop = logList.scrollTop;
    const hadLogs = lastLogSignature !== '';

    logList.innerHTML = [...s.logs].reverse().map((log, index) => {
      const summary = log.summary || log.text || '';
      const hasDetail = !!(log.detail || log.quote || log.changes?.length || log.actors?.length);
      const key = logKey(log);
      const open = previousKeys.has(key) || (index === 0 && (!hadLogs || !previousKeys.has(key)));
      const body = `${log.detail ? `<p>${log.detail}</p>` : ''}${log.quote ? `<blockquote>${log.quote}</blockquote>` : ''}${log.actors?.length ? `<div class="log-meta">参与：${log.actors.join('、')}</div>` : ''}${log.changes?.length ? `<div class="log-changes">${log.changes.map((change) => `<span>${change}</span>`).join('')}</div>` : ''}`;
      return `<article class="log ${log.type === 'major' ? 'major' : log.type === 'arc' ? 'arc' : ''} ${log.outcome ? `log--${log.outcome}` : ''}">
        <div class="log-head"><span class="log-week">第 ${log.week} 周</span><span class="log-category">${log.category || '记录'}</span></div>
        ${hasDetail
          ? `<details data-log-key="${key}" ${open ? 'open' : ''}><summary>${summary}</summary><div class="log-detail">${body}</div></details>`
          : `<strong class="log-summary">${summary}</strong>`}
      </article>`;
    }).join('');

    logList.scrollTop = hadLogs ? previousScrollTop : 0;
    lastLogSignature = logSignature;
  }

  const reportList = $('#reportList');
  const reportSignature = JSON.stringify({ week: s.week, reports: s.termReports });
  if (reportSignature !== lastReportSignature) {
    reportList.innerHTML = s.termReports.length
      ? s.termReports.slice().reverse().map((r) => `<div class="report" role="article" aria-label="${r.title}">
        <div class="report__heading"><span>第 ${r.week} 周</span><h4>${r.title}</h4></div>
        <p>${r.body}</p>
      </div>`).join('')
      : renderReportEmpty(s);
    lastReportSignature = reportSignature;
  }
}
