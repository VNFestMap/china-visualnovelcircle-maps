/* ===== 同好会运行画像生成器 — app.js ===== */

// ===== Dimension Labels =====
const DIM_LABELS = {
  organization_stability: '组织稳定度',
  activity_execution: '活动执行力',
  member_scale_participation: '成员规模与参与度',
  content_accumulation: '内容沉淀力',
  external_connection: '外部连接力',
  continuity: '传承持续力'
};

const DIM_KEYS = Object.keys(DIM_LABELS);
let prefillClubs = [];

function getPreferredTheme() {
  try {
    const saved = localStorage.getItem('themePreference');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch (e) {
    // localStorage may be unavailable in some embedded contexts.
  }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme, animate = false) {
  const next = theme === 'light' ? 'light' : 'dark';
  const root = document.documentElement;
  if (animate) {
    root.classList.remove('theme-changing');
    void root.offsetWidth;
    root.classList.add('theme-changing');
    window.setTimeout(() => root.classList.remove('theme-changing'), 380);
  }
  root.setAttribute('data-theme', next);
}

applyTheme(getPreferredTheme());

const SCALE_LABELS = {
  total_members: '总成员',
  active_members: '活跃成员',
  core_members: '核心成员',
  average_activity_attendance: '平均活动参与',
  active_rate: '活跃比例'
};

// ===== Example Data (from plan doc §23) =====
const EXAMPLE_DATA = {
  basic_info: {
    club_name: '橘柚视觉小说同好会',
    school_name: '示例大学',
    city: '重庆',
    founded_year: 2023,
    short_intro: '以视觉小说交流、作品推荐和联合企划为主要方向的高校同好会。'
  },
  dimensions: {
    organization_stability: {
      numeric: { total_members: 30, core_members: 8, managers_count: 3 },
      choice: { has_clear_leader: true, has_core_group: true, has_fixed_channel: true, has_task_division: true, management_mode: 'small_core_group' },
      text: '同好会有明确的负责人和三名管理员，核心组定期开会，日常通过 QQ 群和 Discord 交流。'
    },
    activity_execution: {
      numeric: { activities_last_3_months: 4, activities_last_12_months: 12, average_participants: 18, largest_activity_participants: 40 },
      choice: { activity_frequency: 'monthly', activity_types: [], has_event_plan: true, has_event_review: true, execution_stability: 'mostly_completed' },
      text: '每月举办茶会或分享会，每学期一次中型活动。活动策划和执行比较稳定。'
    },
    member_scale_participation: {
      numeric: { total_members: 120, active_members: 35, core_members: 8, average_activity_attendance: 18, members_helped_operations: 12, members_presented_or_shared: 8, members_submitted_content: 6 },
      choice: { member_activity_level: 'medium', new_member_integration: 'has_basic_path', participation_pattern: 'core_plus_some' },
      text: '普通成员主要参加活动，少数会协助事务或分享作品。新成员有基本的融入渠道。'
    },
    content_accumulation: {
      numeric: { articles_count: 15, recommendations_count: 20, event_reports_count: 8, publication_submissions_count: 5, media_outputs_count: 3, visual_materials_count: 12 },
      choice: { has_public_archive: true, output_frequency: 'regular', output_types: [], has_representative_work: true },
      text: '有稳定的文章推荐产出，参与过联合刊物投稿，活动后会有总结记录。'
    },
    external_connection: {
      numeric: { joint_projects_participated: 3, joint_projects_initiated: 1, partner_clubs_count: 4, cross_school_events_count: 2, external_events_count: 3 },
      choice: { has_external_contact_person: true, collaboration_network: 'stable_partners', collaboration_types: [], willingness_for_future_collab: 'willing_to_join' },
      text: '和附近高校有合作往来，参与过联合刊物和线上交流活动。'
    },
    continuity: {
      numeric: { founded_year: 2023, active_years: 3, consecutive_active_years: 3, leadership_transition_count: 1 },
      choice: { has_completed_transition: true, has_handover_docs: false, has_history_records: true, has_yearly_basic_activity: true, dependence_on_single_person: 'medium', continuity_risk_self_assessment: 'medium' },
      text: '同好会成立三年，经历过一次换届。有基本的历史记录，但交接文档不够完善。'
    }
  }
};

// ===== State =====
let currentStep = 1;
const TOTAL_STEPS = 9;
let lastGeneratedConfig = null; // stores the config used for last generation for copy/screenshot

// ===== Step Navigation =====
function goToStep(n) {
  if (n < 1 || n > TOTAL_STEPS) return;
  currentStep = n;

  document.querySelectorAll('.form-step').forEach(el => el.classList.remove('active'));
  const target = document.querySelector(`.form-step[data-step="${n}"]`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.step-dot').forEach(dot => {
    const s = parseInt(dot.dataset.step);
    dot.classList.toggle('active', s === n);
    dot.classList.toggle('done', s < n);
  });

  // Scroll to top of form on mobile
  if (window.innerWidth < 768) {
    document.getElementById('formArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function bindStepNav() {
  // Next buttons
  document.querySelectorAll('.btn-next').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = parseInt(btn.dataset.next);
      if (!isNaN(next)) goToStep(next);
    });
  });

  // Prev buttons
  document.querySelectorAll('.btn-prev').forEach(btn => {
    btn.addEventListener('click', () => {
      const prev = parseInt(btn.dataset.prev);
      if (!isNaN(prev)) goToStep(prev);
    });
  });

  // Step indicator dots
  document.querySelectorAll('.step-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const s = parseInt(dot.dataset.step);
      if (!isNaN(s)) goToStep(s);
    });
  });
}

// ===== Form Binding =====
function collectForm() {
  const data = {
    basic_info: {
      club_name: document.getElementById('clubName').value.trim(),
      school_name: document.getElementById('schoolName').value.trim(),
      city: document.getElementById('city').value.trim(),
      founded_year: parseInt(document.getElementById('foundedYear').value) || null,
      short_intro: document.getElementById('shortIntro').value.trim()
    },
    dimensions: {
      organization_stability: {
        numeric: {
          total_members: parseInt(document.getElementById('os_total_members').value) || 0,
          core_members: parseInt(document.getElementById('os_core_members').value) || 0,
          managers_count: parseInt(document.getElementById('os_managers_count').value) || 0
        },
        choice: {
          has_clear_leader: document.getElementById('os_has_clear_leader').checked,
          has_core_group: document.getElementById('os_has_core_group').checked,
          has_fixed_channel: document.getElementById('os_has_fixed_channel').checked,
          has_task_division: document.getElementById('os_has_task_division').checked,
          management_mode: document.getElementById('os_management_mode').value
        },
        text: document.getElementById('os_text').value.trim()
      },
      activity_execution: {
        numeric: {
          activities_last_3_months: parseInt(document.getElementById('ae_activities_last_3').value) || 0,
          activities_last_12_months: parseInt(document.getElementById('ae_activities_last_12').value) || 0,
          average_participants: parseInt(document.getElementById('ae_avg_participants').value) || 0,
          largest_activity_participants: parseInt(document.getElementById('ae_largest_participants').value) || 0
        },
        choice: {
          activity_frequency: document.getElementById('ae_frequency').value,
          has_event_plan: document.getElementById('ae_has_event_plan').checked,
          has_event_review: document.getElementById('ae_has_event_review').checked,
          execution_stability: document.getElementById('ae_execution_stability').value
        },
        text: document.getElementById('ae_text').value.trim()
      },
      member_scale_participation: {
        numeric: {
          total_members: parseInt(document.getElementById('mp_total_members').value) || 0,
          active_members: parseInt(document.getElementById('mp_active_members').value) || 0,
          core_members: parseInt(document.getElementById('mp_core_members').value) || 0,
          average_activity_attendance: parseInt(document.getElementById('mp_avg_attendance').value) || 0,
          members_helped_operations: parseInt(document.getElementById('mp_helped_ops').value) || 0,
          members_presented_or_shared: parseInt(document.getElementById('mp_presented_shared').value) || 0,
          members_submitted_content: parseInt(document.getElementById('mp_submitted').value) || 0
        },
        choice: {
          member_activity_level: document.querySelector('input[name="mp_activity_level"]:checked')?.value || '',
          new_member_integration: document.getElementById('mp_new_member_integration').value,
          participation_pattern: document.getElementById('mp_participation_pattern').value
        },
        text: document.getElementById('mp_text').value.trim()
      },
      content_accumulation: {
        numeric: {
          articles_count: parseInt(document.getElementById('ca_articles').value) || 0,
          recommendations_count: parseInt(document.getElementById('ca_recommendations').value) || 0,
          event_reports_count: parseInt(document.getElementById('ca_reports').value) || 0,
          publication_submissions_count: parseInt(document.getElementById('ca_publications').value) || 0,
          media_outputs_count: parseInt(document.getElementById('ca_media_outputs').value) || 0,
          visual_materials_count: parseInt(document.getElementById('ca_visuals').value) || 0
        },
        choice: {
          has_public_archive: document.getElementById('ca_has_public_archive').checked,
          output_frequency: document.getElementById('ca_output_frequency').value,
          has_representative_work: document.getElementById('ca_has_representative_work').checked
        },
        text: document.getElementById('ca_text').value.trim()
      },
      external_connection: {
        numeric: {
          joint_projects_participated: parseInt(document.getElementById('ec_joint_participated').value) || 0,
          joint_projects_initiated: parseInt(document.getElementById('ec_joint_initiated').value) || 0,
          partner_clubs_count: parseInt(document.getElementById('ec_partner_clubs').value) || 0,
          cross_school_events_count: parseInt(document.getElementById('ec_cross_school_events').value) || 0,
          external_events_count: parseInt(document.getElementById('ec_external_events').value) || 0
        },
        choice: {
          has_external_contact_person: document.getElementById('ec_has_external_contact').checked,
          collaboration_network: document.getElementById('ec_collaboration_network').value,
          willingness_for_future_collab: document.getElementById('ec_willingness').value
        },
        text: document.getElementById('ec_text').value.trim()
      },
      continuity: {
        numeric: {
          founded_year: 0,
          active_years: parseInt(document.getElementById('co_active_years').value) || 0,
          consecutive_active_years: 0,
          leadership_transition_count: parseInt(document.getElementById('co_transition_count').value) || 0
        },
        choice: {
          has_completed_transition: document.getElementById('co_has_completed_transition').checked,
          has_handover_docs: document.getElementById('co_has_handover_docs').checked,
          has_history_records: document.getElementById('co_has_history_records').checked,
          has_yearly_basic_activity: document.getElementById('co_has_yearly_basic_activity').checked,
          dependence_on_single_person: document.getElementById('co_dependence').value,
          continuity_risk_self_assessment: document.getElementById('co_continuity_risk').value
        },
        text: document.getElementById('co_text').value.trim()
      }
    }
  };
  return data;
}

function populateForm(data) {
  const d = data.dimensions;

  // Basic info
  setVal('clubName', data.basic_info.club_name);
  setVal('schoolName', data.basic_info.school_name);
  setVal('city', data.basic_info.city);
  setVal('foundedYear', data.basic_info.founded_year || '');
  setVal('shortIntro', data.basic_info.short_intro);

  // OS
  setVal('os_total_members', d.organization_stability.numeric.total_members);
  setVal('os_core_members', d.organization_stability.numeric.core_members);
  setVal('os_managers_count', d.organization_stability.numeric.managers_count);
  setChecked('os_has_clear_leader', d.organization_stability.choice.has_clear_leader);
  setChecked('os_has_core_group', d.organization_stability.choice.has_core_group);
  setChecked('os_has_fixed_channel', d.organization_stability.choice.has_fixed_channel);
  setChecked('os_has_task_division', d.organization_stability.choice.has_task_division);
  setVal('os_management_mode', d.organization_stability.choice.management_mode);
  setVal('os_text', d.organization_stability.text);

  // AE
  setVal('ae_activities_last_3', d.activity_execution.numeric.activities_last_3_months);
  setVal('ae_activities_last_12', d.activity_execution.numeric.activities_last_12_months);
  setVal('ae_avg_participants', d.activity_execution.numeric.average_participants);
  setVal('ae_largest_participants', d.activity_execution.numeric.largest_activity_participants);
  setChecked('ae_has_event_plan', d.activity_execution.choice.has_event_plan);
  setChecked('ae_has_event_review', d.activity_execution.choice.has_event_review);
  setVal('ae_frequency', d.activity_execution.choice.activity_frequency);
  setVal('ae_execution_stability', d.activity_execution.choice.execution_stability);
  setVal('ae_text', d.activity_execution.text);

  // MP
  setVal('mp_total_members', d.member_scale_participation.numeric.total_members);
  setVal('mp_active_members', d.member_scale_participation.numeric.active_members);
  setVal('mp_core_members', d.member_scale_participation.numeric.core_members);
  setVal('mp_avg_attendance', d.member_scale_participation.numeric.average_activity_attendance);
  setVal('mp_helped_ops', d.member_scale_participation.numeric.members_helped_operations);
  setVal('mp_submitted', d.member_scale_participation.numeric.members_submitted_content);
  setVal('mp_presented_shared', d.member_scale_participation.numeric.members_presented_or_shared);
  const actLevel = d.member_scale_participation.choice.member_activity_level;
  const radio = document.querySelector(`input[name="mp_activity_level"][value="${actLevel}"]`);
  if (radio) radio.checked = true;
  setVal('mp_participation_pattern', d.member_scale_participation.choice.participation_pattern);
  setVal('mp_new_member_integration', d.member_scale_participation.choice.new_member_integration);
  setVal('mp_text', d.member_scale_participation.text);

  // CA
  setVal('ca_articles', d.content_accumulation.numeric.articles_count);
  setVal('ca_reports', d.content_accumulation.numeric.event_reports_count);
  setVal('ca_publications', d.content_accumulation.numeric.publication_submissions_count);
  setVal('ca_visuals', d.content_accumulation.numeric.visual_materials_count);
  setVal('ca_recommendations', d.content_accumulation.numeric.recommendations_count);
  setVal('ca_media_outputs', d.content_accumulation.numeric.media_outputs_count);
  setChecked('ca_has_public_archive', d.content_accumulation.choice.has_public_archive);
  setChecked('ca_has_representative_work', d.content_accumulation.choice.has_representative_work);
  setVal('ca_output_frequency', d.content_accumulation.choice.output_frequency);
  setVal('ca_text', d.content_accumulation.text);

  // EC
  setVal('ec_joint_participated', d.external_connection.numeric.joint_projects_participated);
  setVal('ec_joint_initiated', d.external_connection.numeric.joint_projects_initiated);
  setVal('ec_partner_clubs', d.external_connection.numeric.partner_clubs_count);
  setVal('ec_external_events', d.external_connection.numeric.external_events_count);
  setVal('ec_cross_school_events', d.external_connection.numeric.cross_school_events_count);
  setChecked('ec_has_external_contact', d.external_connection.choice.has_external_contact_person);
  setVal('ec_collaboration_network', d.external_connection.choice.collaboration_network);
  setVal('ec_willingness', d.external_connection.choice.willingness_for_future_collab);
  setVal('ec_text', d.external_connection.text);

  // CO
  setVal('co_active_years', d.continuity.numeric.active_years);
  setVal('co_transition_count', d.continuity.numeric.leadership_transition_count);
  setChecked('co_has_completed_transition', d.continuity.choice.has_completed_transition);
  setChecked('co_has_handover_docs', d.continuity.choice.has_handover_docs);
  setChecked('co_has_history_records', d.continuity.choice.has_history_records);
  setChecked('co_has_yearly_basic_activity', d.continuity.choice.has_yearly_basic_activity);
  setVal('co_dependence', d.continuity.choice.dependence_on_single_person);
  setVal('co_continuity_risk', d.continuity.choice.continuity_risk_self_assessment);
  setVal('co_text', d.continuity.text);
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? '';
}

function setChecked(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = !!val;
}

function resetForm() {
  document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => el.value = '');
  document.querySelectorAll('.form-checkbox, .choice-checkbox, .choice-radio').forEach(el => el.checked = false);
  document.querySelectorAll('input[type="radio"]').forEach(el => el.checked = false);
  goToStep(1);

  document.getElementById('resultPlaceholder').style.display = '';
  document.getElementById('resultContent').style.display = 'none';
}

function loadExampleData() {
  populateForm(EXAMPLE_DATA);
  goToStep(8);
  showToast('示例数据已载入，可以生成了');
}

// ===== Toast =====
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(t._hide);
  t._hide = setTimeout(() => t.classList.remove('visible'), 2500);
}

// ===== Scoring Engine =====

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function getLevel(score) {
  if (score >= 85) return '优化';
  if (score >= 70) return '成熟';
  if (score >= 50) return '规范';
  if (score >= 25) return '基础';
  return '初始';
}

function getRank(avgScore) {
  if (avgScore >= 85) return { rank: 'S', label: '卓越', threshold: 'avg ≥ 85' };
  if (avgScore >= 65) return { rank: 'A', label: '优秀', threshold: 'avg ≥ 65' };
  if (avgScore >= 45) return { rank: 'B', label: '良好', threshold: 'avg ≥ 45' };
  if (avgScore >= 25) return { rank: 'C', label: '一般', threshold: 'avg ≥ 25' };
  return { rank: 'D', label: '待提升', threshold: 'avg < 25' };
}

function getRankLetter(score) {
  return getRank(score).rank;
}

function splitRadarLabel(label) {
  const chars = Array.from(String(label || ''));
  if (chars.length <= 6) return [chars.join('')];
  const firstLineLength = Math.ceil(chars.length / 2);
  return [
    chars.slice(0, firstLineLength).join(''),
    chars.slice(firstLineLength).join('')
  ];
}

function getRankPaint(rank, isDark) {
  const palettes = {
    S: isDark
      ? { fill: '#ff7c78', stroke: '#5b1516', size: 24, weight: 900 }
      : { fill: '#dc4f4c', stroke: '#fff0f0', size: 24, weight: 900 },
    A: isDark
      ? { fill: '#ffa13f', stroke: '#5a2d00', size: 23, weight: 900 }
      : { fill: '#c26b00', stroke: '#fff0df', size: 23, weight: 900 },
    B: isDark
      ? { fill: '#ffd84f', stroke: '#624600', size: 22, weight: 880 }
      : { fill: '#aa7b00', stroke: '#fff6cc', size: 22, weight: 880 },
    C: isDark
      ? { fill: '#e8e5dc', stroke: '#383632', size: 21, weight: 820 }
      : { fill: '#69665f', stroke: '#f7f4ee', size: 21, weight: 820 },
    D: isDark
      ? { fill: '#57baff', stroke: '#092d4b', size: 22, weight: 860 }
      : { fill: '#1c7fc5', stroke: '#e7f5ff', size: 22, weight: 860 }
  };
  return palettes[rank] || palettes.D;
}

function drawRadarRank(ctx, rank, x, y, isDark) {
  const paint = getRankPaint(rank, isDark);
  ctx.save();
  ctx.font = `${paint.weight} ${paint.size}px Georgia, "Times New Roman", "SimSun", "Songti SC", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = paint.fill;
  ctx.fillText(rank, x, y);
  ctx.restore();
}

function drawRadarLabel(ctx, label, x, y, isDark) {
  const lines = splitRadarLabel(label);
  const lineHeight = 16;
  const startY = y - ((lines.length - 1) * lineHeight) / 2;

  ctx.save();
  ctx.font = '700 13px Georgia, "Times New Roman", "SimSun", "Songti SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.76)' : 'rgba(255, 255, 255, 0.8)';
  ctx.shadowBlur = isDark ? 3 : 0;
  ctx.shadowOffsetY = isDark ? 0 : 1;
  ctx.fillStyle = isDark ? '#f5f1ec' : '#3b302b';
  lines.forEach((line, index) => {
    ctx.fillText(line, x, startY + index * lineHeight);
  });
  ctx.restore();
  return lines.length;
}

function calcOrganizationStability(d) {
  const n = d.numeric, c = d.choice;
  const total = n.total_members || 0;
  const core = n.core_members || 0;
  const managers = n.managers_count || 0;
  const coreRatio = total > 0 ? core / total : 0;
  const base = 5;

  // 1. 组织化程度 (max 45) — issue 4 fix: 连续核心比 + 小样本保护
  let coreScore = Math.round(Math.min(coreRatio / 0.50, 1) * 25);
  if (total < 10) coreScore = Math.min(coreScore, 15);
  const managerBonus = Math.min(Math.sqrt(managers) * 4, 10);
  const coreCountBonus = Math.min(core * 1.2, 10);
  const organization = Math.min(coreScore + managerBonus + coreCountBonus, 45);

  // 2. 架构健全度 (max 30)
  let structure = 0;
  if (c.has_clear_leader) structure += 5;
  if (c.has_core_group) structure += 5;
  if (c.has_task_division) structure += 7;
  if (c.has_fixed_channel) structure += 4;
  if (c.management_mode === 'small_core_group') structure += 5;
  else if (c.management_mode === 'distributed_team') structure += 3;
  else if (c.management_mode === 'single_leader') structure -= 4;
  else if (c.management_mode === 'loose_interest_group') structure -= 3;
  if (c.has_clear_leader && c.has_core_group && c.has_task_division) structure += 5;
  if (c.has_fixed_channel && c.has_core_group) structure += 2;
  structure = clamp(structure, 0, 30);

  // 3. 制度完备度 (max 20)
  let institution = 0;
  const hasGoodMode = c.management_mode === 'small_core_group' || c.management_mode === 'distributed_team';
  if (hasGoodMode && c.has_task_division) institution += 8;
  if (hasGoodMode && c.has_core_group) institution += 5;
  if (c.has_task_division && c.has_core_group) institution += 4;
  institution = Math.min(institution, 20);

  return clamp(Math.round(base + organization + structure + institution), 0, 100);
}

function calcActivityExecution(d) {
  const n = d.numeric, c = d.choice;
  const base = 5;

  // 1. 活动活跃度 (max 25) — sqrt递减，拉大高低频差距
  const act12 = n.activities_last_12_months || 0;
  const act3 = n.activities_last_3_months || 0;
  const volume = Math.min(Math.sqrt(act12) * 4, 16) + Math.min(Math.sqrt(act3) * 3, 12);
  const activity = Math.min(volume, 25);

  // 2. 活动质量 (max 30) — 频率+稳定性+策划复盘
  const freqMap = { none: 0, occasional: 3, semester: 6, monthly: 12, high_frequency: 16 };
  const stabilityMap = { often_cancelled: -10, sometimes_completed: -3, mostly_completed: 5, stable: 10 };
  let quality = (freqMap[c.activity_frequency] || 0) + (stabilityMap[c.execution_stability] || 0);
  if (c.has_event_plan) quality += 5;
  if (c.has_event_review) quality += 6;
  if (c.has_event_plan && c.has_event_review) quality += 4;
  quality = clamp(quality, 0, 30);

  // 3. 参与规模 (max 20) — 综合平均+最大参与，上限提高
  const avg = n.average_participants || 0;
  const maxp = n.largest_activity_participants || 0;
  const combined = avg * 0.7 + maxp * 0.3;
  const participation = Math.min(Math.sqrt(combined) * 3, 20);

  // 4. 稳健执行 (max 18) — 稳定性权重大幅提升
  const stable = c.execution_stability === 'stable' || c.execution_stability === 'mostly_completed';
  const frequent = c.activity_frequency === 'monthly' || c.activity_frequency === 'high_frequency';
  let robust = 0;
  if (stable && frequent) robust = 18;
  else if (stable) robust = 10;
  else if (frequent) robust = 5;

  // 5. 覆盖多样性 (max 7) — 从活动频率推断类型覆盖
  const varietyMap = { high_frequency: 7, monthly: 5, semester: 3, occasional: 1, none: 0 };
  const variety = varietyMap[c.activity_frequency] || 0;

  return clamp(Math.round(base + activity + quality + participation + robust + variety), 0, 100);
}

function calcMemberParticipation(d) {
  const n = d.numeric, c = d.choice;
  const total = n.total_members || 0;
  const active = n.active_members || 0;
  const activeRatio = total > 0 ? active / total : 0;
  const base = 5;

  // 1. 活跃度 (max 35)
  let activeScore = 0;
  if (activeRatio >= 0.50) activeScore = 23;
  else if (activeRatio >= 0.30) activeScore = 16;
  else if (activeRatio >= 0.15) activeScore = 10;
  else if (activeRatio >= 0.05) activeScore = 5;
  else activeScore = 1;
  const activityMap = { low: 0, medium: 5, high: 12 };
  activeScore += (activityMap[c.member_activity_level] || 0);
  activeScore = Math.min(activeScore, 35);

  // 2. 参与广度 (max 30)
  const helped = Math.min(Math.sqrt(n.members_helped_operations || 0) * 2.5, 6);
  const submitted = Math.min(Math.sqrt(n.members_submitted_content || 0) * 2.5, 6);
  const presented = Math.min(Math.sqrt(n.members_presented_or_shared || 0) * 2.5, 6);
  const patternMap = { leader_only: -5, core_members_only: 3, core_plus_some: 8, broad_participation: 14 };
  const breadth = Math.min(helped + submitted + presented + (patternMap[c.participation_pattern] || 0), 30);

  // 3. 新成员融入 (max 15)
  const integMap = { difficult: -5, depends_on_acquaintance: 0, has_basic_path: 6, clear_path: 12 };
  let integration = (integMap[c.new_member_integration] || 0);
  if (c.new_member_integration === 'clear_path' && c.participation_pattern !== 'leader_only') integration += 3;
  integration = clamp(integration, -5, 15);

  // 4. 活跃密度奖 (max 15) — issue 3 fix: 替代纯规模分，奖励高密度社团
  const density = Math.round(clamp(activeRatio, 0, 1) * 15);

  return clamp(Math.round(base + activeScore + breadth + integration + density), 0, 100);
}

function calcContentAccumulation(d) {
  const n = d.numeric, c = d.choice;
  const base = 5;

  // 1. 内容产出量 (max 30)
  const articles = Math.min(Math.sqrt(n.articles_count || 0) * 3, 10);
  const reports = Math.min(Math.sqrt(n.event_reports_count || 0) * 3, 8);
  const submissions = Math.min(Math.sqrt(n.publication_submissions_count || 0) * 4, 8);
  const visuals = Math.min(Math.sqrt(n.visual_materials_count || 0) * 1.5, 5);
  const recommends = Math.min(Math.sqrt(n.recommendations_count || 0) * 2, 5);
  const media = Math.min(Math.sqrt(n.media_outputs_count || 0) * 2, 4);
  const content = Math.min(articles + reports + submissions + visuals + recommends + media, 30);

  // 2. 内容质量与归档 (max 30)
  let quality = 0;
  if (c.has_public_archive) quality += 7;
  if (c.has_representative_work) quality += 9;
  const freqMap = { none: 0, occasional: 3, regular: 5, active: 8 };
  quality += (freqMap[c.output_frequency] || 0);
  if (c.has_public_archive && c.has_representative_work) quality += 3;
  if (c.has_public_archive && (c.output_frequency === 'regular' || c.output_frequency === 'active')) quality += 3;
  quality = clamp(quality, 0, 30);

  // 3. 产出持续性 (max 15) — 持续输出而非一次爆发
  let sustainability = 0;
  const hasSustainedFreq = c.output_frequency === 'regular' || c.output_frequency === 'active';
  const hasVolume = (n.articles_count || 0) + (n.event_reports_count || 0) >= 5;
  if (hasSustainedFreq && hasVolume) sustainability += 10;
  if (c.has_public_archive && hasSustainedFreq) sustainability += 5;
  sustainability = Math.min(sustainability, 15);

  // 4. 影响力 (max 20) — 内容被引用/推荐/传播
  let influence = 0;
  influence += Math.min(Math.sqrt(n.recommendations_count || 0) * 4, 8);
  influence += Math.min(Math.sqrt(n.publication_submissions_count || 0) * 4, 7);
  influence += Math.min(Math.sqrt(n.media_outputs_count || 0) * 3, 5);
  influence = Math.min(influence, 20);

  return clamp(Math.round(base + content + quality + sustainability + influence), 0, 100);
}

function calcExternalConnection(d) {
  const n = d.numeric, c = d.choice;
  const base = 5;

  // 1. 合作广度 (max 30) — 联合企划参与+发起+合作伙伴
  const participated = Math.min(Math.sqrt(n.joint_projects_participated || 0) * 5, 12);
  const initiated = Math.min(Math.sqrt(n.joint_projects_initiated || 0) * 7, 12);
  const partners = Math.min(Math.sqrt(n.partner_clubs_count || 0) * 3, 6);
  const breadth = Math.min(participated + initiated + partners, 30);

  // 2. 网络深度 (max 25) — 跨校/外部活动 + 固定联络人
  const totalEvents = (n.external_events_count || 0) + (n.cross_school_events_count || 0);
  const events = Math.min(Math.sqrt(totalEvents) * 4, 10);
  const contactBonus = c.has_external_contact_person ? 8 : 0;
  let depth = Math.min(events + contactBonus, 25);
  if (totalEvents >= 3 && c.has_external_contact_person) depth = Math.min(depth + 5, 25);
  depth = clamp(depth, 0, 25);

  // 3. 主动性 (max 20)
  const collabMap = { none: -2, few_private_contacts: 0, stable_partners: 6, wide_network: 10 };
  const willingMap = { not_now: 0, interested_but_inexperienced: 3, willing_to_join: 6, willing_to_initiate: 10 };
  const willingness = clamp((collabMap[c.collaboration_network] || 0) + (willingMap[c.willingness_for_future_collab] || 0), 0, 20);

  // 4. 合作质量 (max 20) — 深度系数
  let quality = 0;
  const hasGoodNetwork = c.collaboration_network === 'stable_partners' || c.collaboration_network === 'wide_network';
  if (hasGoodNetwork && c.has_external_contact_person) quality += 7;
  if ((n.joint_projects_initiated || 0) >= 1) quality += 7;
  if ((n.joint_projects_initiated || 0) >= 1 && c.has_external_contact_person) quality += 6;
  quality = Math.min(quality, 20);

  return clamp(Math.round(base + breadth + depth + willingness + quality), 0, 100);
}

function calcContinuity(d) {
  const n = d.numeric, c = d.choice;
  const base = 5;

  // 1. 历史积累 (max 30)
  const yearScore = Math.min(Math.sqrt(n.active_years || 0) * 8, 18);
  const transitionScore = Math.min((n.leadership_transition_count || 0) * 4, 12);
  const history = Math.min(yearScore + transitionScore, 30);

  // 2. 传承机制 (max 40)
  let succession = 0;
  if (c.has_completed_transition) succession += 10;
  if (c.has_handover_docs) succession += 14;
  if (c.has_history_records) succession += 8;
  if (c.has_yearly_basic_activity) succession += 5;
  if (c.has_completed_transition && c.has_handover_docs) succession += 5;
  if (c.has_history_records && c.has_yearly_basic_activity) succession += 3;
  succession = clamp(succession, 0, 40);

  // 3. 风险乘数 (0.85 ~ 1.05) — issue 2 fix: 乘法代替减法
  const depMap = { very_high: -10, high: -5, medium: -2, low: 3 };
  const riskMap = { high: -5, medium: -1, low: 2 };
  const riskFactor = 1 + ((depMap[c.dependence_on_single_person] || -2) + (riskMap[c.continuity_risk_self_assessment] || -1)) / 100;

  return clamp(Math.round((base + history + succession) * riskFactor), 0, 100);
}

function validateDimensionData(dims) {
  const errors = [];

  // OS: 自洽性校验
  const os = dims.organization_stability.numeric;
  if (os.core_members > os.total_members)
    errors.push('组织稳定度：核心成员数不能超过总成员数（' + os.core_members + ' > ' + os.total_members + '）');
  if (os.managers_count > os.total_members)
    errors.push('组织稳定度：管理员数不能超过总成员数（' + os.managers_count + ' > ' + os.total_members + '）');

  // MP: 自洽性校验
  const mp = dims.member_scale_participation.numeric;
  if (mp.active_members > mp.total_members)
    errors.push('成员规模与参与度：活跃成员数不能超过总成员数（' + mp.active_members + ' > ' + mp.total_members + '）');
  if (mp.core_members > mp.total_members)
    errors.push('成员规模与参与度：核心成员数不能超过总成员数（' + mp.core_members + ' > ' + mp.total_members + '）');
  if (mp.average_activity_attendance > mp.total_members)
    errors.push('成员规模与参与度：平均活动参与人数不能超过总成员数');

  return errors;
}

function calculateBaseScores(dims) {
  return {
    organization_stability: Math.round(calcOrganizationStability(dims.organization_stability)),
    activity_execution: Math.round(calcActivityExecution(dims.activity_execution)),
    member_scale_participation: Math.round(calcMemberParticipation(dims.member_scale_participation)),
    content_accumulation: Math.round(calcContentAccumulation(dims.content_accumulation)),
    external_connection: Math.round(calcExternalConnection(dims.external_connection)),
    continuity: Math.round(calcContinuity(dims.continuity))
  };
}

function calcScaleOverview(dims) {
  const m = dims.member_scale_participation.numeric;
  return {
    total_members: m.total_members,
    active_members: m.active_members,
    core_members: m.core_members,
    average_activity_attendance: m.average_activity_attendance,
    active_rate: m.total_members > 0 ? Math.round(m.active_members / m.total_members * 100) : 0
  };
}

// ===== Analysis Generation =====
function generateAnalysis(scores, basicInfo) {
  const sorted = DIM_KEYS.slice().sort((a, b) => scores[b] - scores[a]);
  const top = sorted.slice(0, 2);
  const bottom = sorted.slice(-2);

  // Summary
  let summary = '';
  const avg = DIM_KEYS.reduce((s, k) => s + scores[k], 0) / DIM_KEYS.length;
  if (avg >= 70) {
    summary = `该同好会整体趋于成熟`;
  } else if (avg >= 50) {
    summary = `该同好会发展规范`;
  } else if (avg >= 25) {
    summary = `该同好会仍处于基础建设阶段`;
  } else {
    summary = `该同好会处于初始阶段`;
  }

  const topNames = top.map(k => DIM_LABELS[k]).join('和');
  const bottomNames = bottom.map(k => DIM_LABELS[k]).join('和');
  summary += `，${topNames}表现较好`;
  if (bottom.some(k => scores[k] < 50)) {
    summary += `，${bottomNames}仍有提升空间`;
  }
  summary += '。';

  // Strengths (top scoring, above L3 threshold 50)
  const strengths = [];
  top.forEach(k => {
    if (scores[k] >= 50) {
      const s = getStrengthText(k, scores[k]);
      if (s) strengths.push(s);
    }
  });
  if (strengths.length === 0) {
    strengths.push('各维度仍有较大提升空间，建议从基础建设开始');
  }

  // Risks (bottom scoring, below L2 threshold 25)
  const risks = [];
  bottom.forEach(k => {
    if (scores[k] < 25) {
      const r = getRiskText(k, scores[k]);
      if (r) risks.push(r);
    }
  });
  if (risks.length === 0) {
    risks.push('整体发展较为均衡，继续保持');
  }

  // Suggestions
  const suggestions = [];
  bottom.forEach(k => {
    const sug = getSuggestionText(k);
    if (sug) suggestions.push(sug);
  });
  if (suggestions.length < 2) {
    suggestions.push('建议定期回顾发展状态，持续优化');
  }

  return { summary, strengths, risks, suggestions };
}

function getStrengthText(key, score) {
  const map = {
    organization_stability: '组织架构清晰，有稳定的骨干团队',
    activity_execution: '活动执行较稳定，能够持续举办各类活动',
    member_scale_participation: '成员参与度高，有良好的活跃基础',
    content_accumulation: '内容产出丰富，有较好的成果沉淀',
    external_connection: '外部联系活跃，具备合作基础',
    continuity: '传承机制完善，有持续发展的能力'
  };
  return map[key] || '';
}

function getRiskText(key, score) {
  const map = {
    organization_stability: '组织结构较松散，需要补足骨干培养',
    activity_execution: '活动执行不稳定，需要提升策划和落地能力',
    member_scale_participation: '成员参与度偏低，普通成员缺乏参与渠道',
    content_accumulation: '内容产出不足，活动和兴趣未能有效沉淀',
    external_connection: '外部联系较少，缺乏跨校合作经验',
    continuity: '传承机制不够完善，存在人员断层的风险'
  };
  return map[key] || '';
}

function getSuggestionText(key) {
  const map = {
    organization_stability: '建议建立明确的分工和日常事务推进机制，培养核心骨干',
    activity_execution: '建议建立活动策划模板和复盘习惯，逐步提升执行稳定性',
    member_scale_participation: '建议设计更多让普通成员参与的环节，如分享、投稿、协助事务等',
    content_accumulation: '建议建立内容归档习惯，鼓励成员进行作品推荐和活动记录',
    external_connection: '建议主动联系周边高校同好会，从小型合作开始积累经验',
    continuity: '建议整理交接文档和历史记录，降低对核心成员的依赖'
  };
  return map[key] || '';
}

function generateDimensionAnalysis(scores) {
  const analysis = {};
  DIM_KEYS.forEach(k => {
    const s = scores[k];
    let text = '';
    if (s >= 85) text = `${DIM_LABELS[k]}达到优化水平`;
    else if (s >= 70) text = `${DIM_LABELS[k]}趋于成熟`;
    else if (s >= 50) text = `${DIM_LABELS[k]}发展规范，仍有提升空间`;
    else if (s >= 25) text = `${DIM_LABELS[k]}基础薄弱，需要重点关注`;
    else text = `${DIM_LABELS[k]}处于初始阶段`;
    analysis[k] = text;
  });
  return analysis;
}

// ===== Radar Chart (Canvas) =====

/** Cubic-bezier ease-out: P0(0,0) P1(0.16,1) P2(0.3,1) P3(1,1) */
function easeOutBezier(t) {
  const mt = 1 - t;
  return 3 * mt * mt * t + 3 * mt * t * t + t * t * t;
}

function animateRadarChart(canvas, targetScores, duration = 900) {
  const startTime = performance.now();
  const initialScores = {};
  DIM_KEYS.forEach(k => { initialScores[k] = 0; });

  // Draw initial frame immediately (grid only, scores=0)
  drawRadarChart(canvas, initialScores);

  function frame(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutBezier(progress);

    const currentScores = {};
    DIM_KEYS.forEach(k => {
      currentScores[k] = Math.round(targetScores[k] * eased);
    });

    drawRadarChart(canvas, currentScores);

    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

function drawRadarChart(canvas, scores) {
  if (!canvas || !canvas.parentElement) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const size = Math.min(rect.width || 320, 400);
  const dpr = window.devicePixelRatio || 1;

  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const cx = size / 2;
  const cy = size / 2;
  const radius = Math.min(cx, cy) - 84;
  const n = DIM_KEYS.length;
  const angleStep = (Math.PI * 2) / n;

  // Clear
  ctx.clearRect(0, 0, size, size);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.getAttribute('data-theme') &&
     window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Grid (5 concentric hexagons)
  for (let level = 1; level <= 5; level++) {
    const r = (radius / 5) * level;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const angle = -Math.PI / 2 + i * angleStep;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = isDark ? 'rgba(255, 232, 220, 0.15)' : 'rgba(96, 72, 60, 0.18)';
    ctx.lineWidth = level === 5 ? 1.4 : 1;
    ctx.stroke();
  }

  // Axes
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + i * angleStep;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = isDark ? 'rgba(255, 232, 220, 0.13)' : 'rgba(96, 72, 60, 0.15)';
    ctx.stroke();
  }

  // Data polygon
  const dataPoints = [];
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const key = DIM_KEYS[i % n];
    const value = clamp(scores[key] / 100, 0, 1);
    const angle = -Math.PI / 2 + i * angleStep;
    const r = radius * value;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    dataPoints.push({ x, y, key, value });
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, isDark ? 'rgba(116, 100, 91, 0.56)' : 'rgba(150, 124, 108, 0.26)');
  grad.addColorStop(1, isDark ? 'rgba(231, 126, 96, 0.26)' : 'rgba(239, 132, 96, 0.14)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = isDark ? '#ff9b7f' : '#df7358';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Data point dots
  dataPoints.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? '#ffa083' : '#e9785d';
    ctx.fill();
    ctx.strokeStyle = isDark ? '#3a1d18' : '#fff8f3';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  });

  for (let i = 0; i < n; i++) {
    const key = DIM_KEYS[i];
    const score = scores[key];
    const rank = getRankLetter(score);
    const angle = -Math.PI / 2 + i * angleStep;
    const lr = radius + 42;
    const lx = cx + lr * Math.cos(angle);
    const ly = cy + lr * Math.sin(angle);

    // Label
    const labelLines = drawRadarLabel(ctx, DIM_LABELS[key], lx, ly - 14, isDark);
    const labelExtraOffset = (labelLines - 1) * 9;

    // Rank
    drawRadarRank(ctx, rank, lx, ly + 5 + labelExtraOffset, isDark);

    // Score
    const sy = ly + 27 + labelExtraOffset;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isDark ? '#ffad95' : '#a44b38';
    ctx.font = 'bold 12px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(String(scores[key]), lx, sy);
  }
}

// ===== Result Rendering =====
function renderScoreBars(container, scores) {
  container.innerHTML = '';
  DIM_KEYS.forEach(key => {
    const value = scores[key];
    const level = getLevel(value);
    const rank = getRankLetter(value);
    const rankClass = 'score-rank--' + rank.toLowerCase();
    const row = document.createElement('div');
    row.className = 'score-bar-row';
    row.innerHTML = `
      <span class="score-bar-label">${DIM_LABELS[key]}</span>
      <div class="score-bar-track">
        <div class="score-bar-fill" style="width:${value}%"></div>
      </div>
      <span class="score-bar-value">${value}</span>
      <span class="score-bar-rank ${rankClass}">${rank}</span>
      <span class="score-bar-level">${level}</span>
    `;
    container.appendChild(row);
  });
}

function renderScaleOverview(container, scale) {
  container.innerHTML = '';
  Object.entries(scale).forEach(([key, value]) => {
    const item = document.createElement('div');
    item.className = 'scale-item';
    const displayVal = key === 'active_rate' ? value + '<span class="unit">%</span>' : value;
    item.innerHTML = `
      <span class="scale-label">${SCALE_LABELS[key]}</span>
      <span class="scale-value">${displayVal}</span>
    `;
    container.appendChild(item);
  });
}

function renderAnalysis(analysis) {
  document.getElementById('analysisSummary').textContent = analysis.summary;

  const sl = document.getElementById('strengthsList');
  sl.innerHTML = analysis.strengths.map(s => `<li>${s}</li>`).join('');

  const rl = document.getElementById('risksList');
  rl.innerHTML = analysis.risks.map(r => `<li>${r}</li>`).join('');

  const sul = document.getElementById('suggestionsList');
  sul.innerHTML = analysis.suggestions.map(s => `<li>${s}</li>`).join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSafeList(id, values) {
  const el = document.getElementById(id);
  el.innerHTML = (Array.isArray(values) ? values : [])
    .filter(Boolean)
    .map(v => `<li>${escapeHtml(v)}</li>`)
    .join('');
}

function buildAdvisorAnalysis(llmResult, baseScores) {
  if (!llmResult || !llmResult.llm_available || llmResult.llm_error) return null;

  const revisedByDim = {};
  (llmResult.revised_scores || []).forEach(row => {
    if (row && row.dimension) revisedByDim[row.dimension] = row;
  });

  const revisedScores = DIM_KEYS.map(key => {
    const incoming = revisedByDim[key] || {};
    const original = Number.isFinite(Number(incoming.original_score)) ? Number(incoming.original_score) : baseScores[key];
    const adjustment = llmResult.score_adjustment ? Number(llmResult.score_adjustment[key] || 0) : 0;
    const revised = Number.isFinite(Number(incoming.revised_score))
      ? clamp(Number(incoming.revised_score), 0, 100)
      : clamp(original + adjustment, 0, 100);
    const delta = Number.isFinite(Number(incoming.delta)) ? Number(incoming.delta) : revised - original;
    return {
      dimension: key,
      original_score: original,
      revised_score: revised,
      delta,
      confidence: Number.isFinite(Number(incoming.confidence)) ? Number(incoming.confidence) : null,
      reason: incoming.reason || (llmResult.dimension_analysis && llmResult.dimension_analysis[key]) || ''
    };
  });

  return {
    summary: llmResult.advisor_summary || llmResult.summary || llmResult.message || '',
    evaluation_summary: llmResult.evaluation_summary || null,
    advantages: llmResult.advantages || llmResult.strengths || [],
    risks: llmResult.risks || [],
    recommendations: llmResult.recommendations || llmResult.suggestions || [],
    classification_change: llmResult.classification_change || '',
    revised_scores: revisedScores
  };
}

function clearAdvisorContent() {
  renderSafeList('advisorAdvantagesList', []);
  renderSafeList('advisorRisksList', []);
  renderSafeList('advisorRecommendationsList', []);
  document.getElementById('advisorScoreChanges').innerHTML = '';
  document.getElementById('advisorFollowUpContainer').innerHTML = '';
  document.getElementById('advisorFollowUp').style.display = 'none';
  document.getElementById('advisorEvaluation').style.display = 'none';
  document.getElementById('advisorEvaluationLabel').textContent = '';
  document.getElementById('advisorEvaluationLine').textContent = '';
  document.getElementById('advisorEvaluationState').textContent = '';
  document.getElementById('advisorEvaluationObservation').textContent = '';
  document.getElementById('advisorEvaluationNextStep').textContent = '';
  document.getElementById('advisorEvaluationConfidence').textContent = '';
  document.getElementById('advisorClassification').textContent = '';
  document.getElementById('advisorClassification').style.display = 'none';
}

function renderAdvisorEvaluation(summary) {
  const box = document.getElementById('advisorEvaluation');
  if (!box || !summary) return;

  const hasContent = ['portrait_label', 'one_sentence', 'current_state', 'key_observation', 'next_step']
    .some(key => summary[key]);
  if (!hasContent) return;

  document.getElementById('advisorEvaluationLabel').textContent = summary.portrait_label || '运行画像总结';
  document.getElementById('advisorEvaluationLine').textContent = summary.one_sentence || '';
  document.getElementById('advisorEvaluationState').textContent = summary.current_state || '信息不足，暂不做确定判断';
  document.getElementById('advisorEvaluationObservation').textContent = summary.key_observation || '暂无可确认的关键观察';
  document.getElementById('advisorEvaluationNextStep').textContent = summary.next_step || '补充关键信息后再修正画像';
  const confidence = Number.isFinite(Number(summary.confidence))
    ? `${Math.round(Number(summary.confidence) * 100)}%`
    : '未标注';
  document.getElementById('advisorEvaluationConfidence').textContent = confidence;
  box.style.display = 'block';
}

function setAdvisorState(state, message) {
  const section = document.getElementById('advisorSection');
  if (!section) return;

  section.classList.remove('is-loading', 'is-failed', 'is-asking', 'is-empty');
  if (!state) {
    section.style.display = 'none';
    clearAdvisorContent();
    return;
  }

  section.style.display = 'block';
  section.classList.add(`is-${state}`);
  document.getElementById('advisorSummary').textContent = message || '';
  clearAdvisorContent();
}

function getLlmFailureMessage(result) {
  if (!result) return 'AI 顾问暂不可用，本地画像已生成。';
  if (result.message) return result.message;
  if (result.llm_error_type === 'finish_reason_length') return 'AI 输出过长，已使用本地画像。';
  if (result.llm_error_type === 'json_parse_failed') return 'AI 输出格式异常，已使用本地画像。';
  return 'AI 顾问暂不可用，本地画像已生成。';
}

function renderAdvisorQuestions(questions) {
  setAdvisorState('asking', 'AI 已生成补充问题。回答后将生成顾问修正分析。');
  const container = document.getElementById('advisorFollowUpContainer');
  container.innerHTML = questions.map((q, i) => `
    <div class="advisor-follow-up-item">
      <label class="advisor-follow-up-label" for="advisor_q_${i}">${i + 1}. ${escapeHtml(q.question)}</label>
      ${q.reason ? `<p class="advisor-follow-up-reason">${escapeHtml(q.reason)}</p>` : ''}
      <textarea class="form-textarea advisor-follow-up-input" id="advisor_q_${i}" data-qid="${escapeHtml(q.id)}" data-dim="${escapeHtml(q.target_dimension || q.dimension || '')}" placeholder="请补充说明..." rows="3"></textarea>
    </div>
  `).join('');
  document.getElementById('advisorFollowUp').style.display = 'block';
}

function renderAdvisorAnalysis(advisor) {
  const section = document.getElementById('advisorSection');
  if (!section || !advisor) {
    setAdvisorState(null);
    return;
  }

  section.style.display = 'block';
  section.classList.remove('is-loading', 'is-failed', 'is-asking', 'is-empty');
  clearAdvisorContent();
  document.getElementById('advisorSummary').textContent = advisor.summary || '\u987e\u95ee\u5206\u6790\u6682\u65e0\u53ef\u7528\u6458\u8981\u3002';
  renderAdvisorEvaluation(advisor.evaluation_summary);

  const scoreRows = (advisor.revised_scores || [])
    .filter(row => row && row.dimension)
    .map(row => {
      const delta = Number(row.delta || 0);
      const deltaClass = delta > 0 ? 'is-up' : (delta < 0 ? 'is-down' : 'is-flat');
      const deltaText = delta > 0 ? `+${delta}` : String(delta);
      const confidence = row.confidence === null || row.confidence === undefined
        ? ''
        : `\u7f6e\u4fe1\u5ea6 ${Math.round(Number(row.confidence) * 100)}%`;
      return `
        <div class="advisor-score-row">
          <span class="advisor-score-dim">${escapeHtml(DIM_LABELS[row.dimension] || row.dimension)}</span>
          <span class="advisor-score-values">\u539f\u59cb ${escapeHtml(row.original_score)} / \u4fee\u6b63 ${escapeHtml(row.revised_score)}</span>
          <span class="advisor-score-delta ${deltaClass}">${escapeHtml(deltaText)}</span>
          <span class="advisor-score-confidence">${escapeHtml(confidence)}</span>
          <span class="advisor-score-reason">${escapeHtml(row.reason || '')}</span>
        </div>
      `;
    }).join('');
  document.getElementById('advisorScoreChanges').innerHTML = scoreRows;

  renderSafeList('advisorAdvantagesList', advisor.advantages);
  renderSafeList('advisorRisksList', advisor.risks);
  renderSafeList('advisorRecommendationsList', advisor.recommendations);

  const classification = advisor.classification_change || '';
  document.getElementById('advisorClassification').textContent = classification;
  document.getElementById('advisorClassification').style.display = classification ? 'block' : 'none';
}

// ===== Generate Portrait =====
let _pendingAdvisorContext = null;

function setButtonBusy(buttonOrId, busy, busyText) {
  const btn = typeof buttonOrId === 'string' ? document.getElementById(buttonOrId) : buttonOrId;
  if (!btn) return;
  if (!btn.dataset.idleText) btn.dataset.idleText = btn.textContent;
  btn.disabled = !!busy;
  btn.textContent = busy ? busyText : btn.dataset.idleText;
}

function isEmptyClubData(formData) {
  const dims = formData.dimensions;
  const keyFields = [
    dims.organization_stability.numeric.total_members,
    dims.member_scale_participation.numeric.total_members,
    dims.member_scale_participation.numeric.active_members,
    dims.activity_execution.numeric.activities_last_12_months,
    dims.continuity.numeric.active_years
  ];
  return keyFields.every(v => !v);
}

async function generateDirectly() {
  const formData = collectForm();

  if (!formData.basic_info.club_name) {
    showToast('请至少填写同好会名称');
    goToStep(1);
    return;
  }

  if (isEmptyClubData(formData)) {
    showToast('请先填写社团基本信息再生成画像');
    goToStep(2);
    return;
  }

  // 数据自洽性校验 — issue 5 fix
  const validationErrors = validateDimensionData(formData.dimensions);
  if (validationErrors.length > 0) {
    showToast('数据校验不通过：' + validationErrors[0]);
    return;
  }

  const baseScores = calculateBaseScores(formData.dimensions);
  _pendingAdvisorContext = null;
  finalizePortrait(formData, baseScores, null);
}

async function startLlmQa() {
  const formData = collectForm();

  if (!formData.basic_info.club_name) {
    showToast('请至少填写同好会名称');
    goToStep(1);
    return;
  }

  if (isEmptyClubData(formData)) {
    showToast('请先填写社团基本信息再生成画像');
    goToStep(2);
    return;
  }

  // 数据自洽性校验 — issue 5 fix
  const validationErrors = validateDimensionData(formData.dimensions);
  if (validationErrors.length > 0) {
    showToast('数据校验不通过：' + validationErrors[0]);
    return;
  }

  const baseScores = calculateBaseScores(formData.dimensions);
  _pendingAdvisorContext = { formData, baseScores, followUpQuestions: [] };
  finalizePortrait(formData, baseScores, null);
  setAdvisorState('loading', '正在生成 AI 顾问追问');
  showToast('已生成基础画像，正在联系 AI 顾问...');
  setButtonBusy('btnGenerateWithLlm', true, 'AI 追问生成中...');

  const llmResult = await callLlmAnalysis(formData, baseScores);
  setButtonBusy('btnGenerateWithLlm', false);

  if (!llmResult || llmResult.llm_error || !llmResult.llm_available) {
    setAdvisorState('failed', getLlmFailureMessage(llmResult));
    showToast('AI 顾问暂不可用，已保留本地画像');
    return;
  }

  if (!llmResult.follow_up_questions || llmResult.follow_up_questions.length === 0) {
    setAdvisorState('empty', 'AI 顾问未发现需要追问的明显矛盾，当前先保留本地画像。');
    return;
  }

  _pendingAdvisorContext.followUpQuestions = llmResult.follow_up_questions;
  _pendingAdvisorContext.initialLlmResult = llmResult;
  renderAdvisorQuestions(llmResult.follow_up_questions);
}

async function submitLlmAnswersAndGenerate() {
  return submitAdvisorAnswers();
}

async function submitAdvisorAnswers() {
  const ctx = _pendingAdvisorContext;
  if (!ctx) return;

  const inputs = document.querySelectorAll('#advisorFollowUpContainer .advisor-follow-up-input');
  const answers = {};
  inputs.forEach(inp => { if (inp.value.trim()) answers[inp.dataset.qid] = inp.value.trim(); });

  showToast('正在生成顾问修正分析...');
  setButtonBusy('btnAdvisorSubmit', true, '正在修正...');
  setButtonBusy('btnAdvisorRetry', true, '请稍候...');
  let correction = null;
  try {
    const resp = await fetch('api/index.php?action=llm-correction/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        basic_info: ctx.formData.basic_info,
        dimensions: ctx.formData.dimensions,
        base_scores: ctx.baseScores,
        follow_up_questions: ctx.followUpQuestions || [],
        initial_analysis: ctx.initialLlmResult || null,
        follow_up_answers: answers
      })
    });
    correction = resp.ok ? await resp.json() : null;
  } catch (e) {
    correction = null;
  }

  setButtonBusy('btnAdvisorSubmit', false);
  setButtonBusy('btnAdvisorRetry', false);

  if (!correction || correction.llm_error || !correction.llm_available) {
    const section = document.getElementById('advisorSection');
    section.classList.remove('is-loading', 'is-asking', 'is-empty');
    section.classList.add('is-failed');
    document.getElementById('advisorSummary').textContent = getLlmFailureMessage(correction);
    document.getElementById('advisorFollowUp').style.display = 'block';
    showToast('AI 修正暂不可用，可稍后重试');
    return;
  }

  _pendingAdvisorContext = null;
  finalizePortrait(ctx.formData, ctx.baseScores, correction);
}

function skipLlmAndGenerate() {
  const ctx = _pendingAdvisorContext;
  _pendingAdvisorContext = null;
  if (ctx) {
    finalizePortrait(ctx.formData, ctx.baseScores, null);
  } else {
    setAdvisorState(null);
  }
}

async function retryAdvisorQuestions() {
  const ctx = _pendingAdvisorContext;
  if (!ctx) return;
  setAdvisorState('loading', '正在重新生成 AI 顾问追问');
  setButtonBusy('btnAdvisorRetry', true, '重试中...');
  setButtonBusy('btnAdvisorSubmit', true, '请稍候...');
  const llmResult = await callLlmAnalysis(ctx.formData, ctx.baseScores);
  setButtonBusy('btnAdvisorRetry', false);
  setButtonBusy('btnAdvisorSubmit', false);

  if (!llmResult || llmResult.llm_error || !llmResult.llm_available) {
    setAdvisorState('failed', getLlmFailureMessage(llmResult));
    showToast('AI 顾问仍不可用');
    return;
  }

  if (!llmResult.follow_up_questions || llmResult.follow_up_questions.length === 0) {
    setAdvisorState('empty', 'AI 顾问未发现需要追问的明显矛盾，当前先保留本地画像。');
    return;
  }

  ctx.followUpQuestions = llmResult.follow_up_questions;
  ctx.initialLlmResult = llmResult;
  renderAdvisorQuestions(llmResult.follow_up_questions);
}

async function callLlmAnalysis(formData, baseScores) {
  try {
    const resp = await fetch('api/index.php?action=llm-correction/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ basic_info: formData.basic_info, dimensions: formData.dimensions, base_scores: baseScores })
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    return null;
  }
}

function finalizePortrait(formData, baseScores, llmResult) {
  const advisor = buildAdvisorAnalysis(llmResult, baseScores);
  let finalScores = { ...baseScores };
  const analysis = generateAnalysis(finalScores, formData.basic_info);

  if (advisor && advisor.revised_scores) {
    advisor.revised_scores.forEach(row => {
      if (row.dimension && Number.isFinite(Number(row.revised_score))) {
        finalScores[row.dimension] = clamp(Math.round(Number(row.revised_score)), 0, 100);
      }
    });
  } else if (llmResult && llmResult.score_adjustment) {
    DIM_KEYS.forEach(key => {
      finalScores[key] = clamp(baseScores[key] + (llmResult.score_adjustment[key] || 0), 0, 100);
    });
  }

  const scaleOverview = calcScaleOverview(formData.dimensions);
  lastGeneratedConfig = { basic_info: formData.basic_info, scores: finalScores, scaleOverview, analysis, advisor };
  renderResults(formData, finalScores, scaleOverview, analysis, advisor);
}

function renderResults(formData, finalScores, scaleOverview, analysis, advisor) {
  document.getElementById('resultClubName').textContent = formData.basic_info.club_name;
  document.getElementById('resultSchool').textContent = formData.basic_info.school_name + (formData.basic_info.city ? ' · ' + formData.basic_info.city : '');
  document.getElementById('resultIntro').textContent = formData.basic_info.short_intro || '';

  renderScoreBars(document.getElementById('scoreBars'), finalScores);
  renderScaleOverview(document.getElementById('scaleOverview'), scaleOverview);
  renderAnalysis(analysis);
  renderAdvisorAnalysis(advisor);

  document.getElementById('resultPlaceholder').style.display = 'none';
  document.getElementById('resultContent').style.display = 'block';

  const canvas = document.getElementById('radarChart');
  animateRadarChart(canvas, finalScores);

  if (window.innerWidth < 768) {
    setTimeout(() => { document.getElementById('resultArea').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
  }

  showToast('画像生成完成');
}

// ===== Pre-fill from main site =====
function fillBasicInfoFromClub(club) {
  if (!club) return;
  if (club.display_name || club.name) setVal('clubName', club.display_name || club.name);
  if (club.school) setVal('schoolName', club.school);
  if (club.city || club.province) setVal('city', club.city || club.province);
  if (club.founded_year) setVal('foundedYear', club.founded_year);
  if (club.remark) setVal('shortIntro', club.remark);
}

function renderPrefillClubSelector(clubs) {
  const group = document.getElementById('prefillGroup');
  const select = document.getElementById('prefillClubSelect');
  const hint = document.getElementById('prefillHint');
  if (!group || !select) return;

  prefillClubs = Array.isArray(clubs) ? clubs.filter(Boolean) : [];
  if (prefillClubs.length === 0) {
    group.style.display = 'none';
    return;
  }

  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '不使用预填，手动填写';
  select.appendChild(placeholder);

  prefillClubs.forEach((club, index) => {
    const option = document.createElement('option');
    const countryLabel = club.country === 'japan' ? '日本' : '中国';
    option.value = String(index);
    option.textContent = `${club.display_name || club.name || '未命名同好会'} · ${countryLabel}`;
    select.appendChild(option);
  });

  select.value = '';
  group.style.display = '';
  if (hint) hint.textContent = '选择后仅回填基础信息，所有字段仍可手动修改。';
}

async function tryPrefill() {
  try {
    const resp = await fetch('api/index.php?action=prefill');
    if (!resp.ok) return;
    const data = await resp.json();
    const clubs = Array.isArray(data.clubs) ? data.clubs : (data.club ? [data.club] : []);
    renderPrefillClubSelector(clubs);
  } catch (e) {
    // 静默失败，不影响用户体验
    console.log('预填服务不可用');
  }
}

function bindPrefillSelector() {
  const select = document.getElementById('prefillClubSelect');
  if (!select) return;
  select.addEventListener('change', function() {
    if (this.value === '') return;
    const club = prefillClubs[Number(this.value)];
    fillBasicInfoFromClub(club);
    showToast('已填入所选同好会的基础信息');
  });
}

function bindThemeToggle() {
  applyTheme(getPreferredTheme());
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', function() {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next, true);
    try {
      localStorage.setItem('themePreference', next);
    } catch (e) {
      // Ignore storage failures; the current page still switches theme.
    }
  });
}

// ===== Share: Copy =====
function formatAdvisorEvaluation(summary) {
  if (!summary) return '';
  const lines = [];
  if (summary.portrait_label) lines.push(`画像标签：${summary.portrait_label}`);
  if (summary.one_sentence) lines.push(`一句话总结：${summary.one_sentence}`);
  if (summary.current_state) lines.push(`当前状态：${summary.current_state}`);
  if (summary.key_observation) lines.push(`关键观察：${summary.key_observation}`);
  if (summary.next_step) lines.push(`下一步：${summary.next_step}`);
  if (Number.isFinite(Number(summary.confidence))) {
    lines.push(`置信度：${Math.round(Number(summary.confidence) * 100)}%`);
  }
  return lines.join('\n');
}

function copyAnalysis() {
  if (!lastGeneratedConfig) {
    showToast('请先生成画像');
    return;
  }
  const c = lastGeneratedConfig;
  const advisorEvaluation = c.advisor ? formatAdvisorEvaluation(c.advisor.evaluation_summary) : '';
  const advisorText = c.advisor ? `\n\n\u2501\u2501 \u987e\u95ee\u4fee\u6b63\u5206\u6790 \u2501\u2501\n${c.advisor.summary || ''}${advisorEvaluation ? `\n\n总结模板:\n${advisorEvaluation}` : ''}\n\n\u8bc4\u5206\u4fee\u6b63:\n${(c.advisor.revised_scores || []).map(row => `${DIM_LABELS[row.dimension] || row.dimension}: ${row.original_score} -> ${row.revised_score} (${row.delta > 0 ? '+' : ''}${row.delta}) ${row.reason || ''}`).join('\n')}\n\n\u987e\u95ee\u4f18\u52bf:\n${(c.advisor.advantages || []).map(s => '\u00b7 ' + s).join('\n')}\n\n\u987e\u95ee\u98ce\u9669:\n${(c.advisor.risks || []).map(s => '\u00b7 ' + s).join('\n')}\n\n\u5b9e\u65bd\u5efa\u8bae:\n${(c.advisor.recommendations || []).map(s => '\u00b7 ' + s).join('\n')}` : '';
  const text = `同好会：${c.basic_info.club_name}
学校：${c.basic_info.school_name}
${c.basic_info.short_intro ? '介绍：' + c.basic_info.short_intro : ''}

━━━ 维度评分 ━━━
${DIM_KEYS.map(k => `${DIM_LABELS[k]}：${c.scores[k]}分（${getLevel(c.scores[k])}）`).join('\n')}

━━━ 分析摘要 ━━━
${c.analysis.summary}

优势：
${c.analysis.strengths.map(s => '· ' + s).join('\n')}

风险：
${c.analysis.risks.map(r => '· ' + r).join('\n')}

建议：
${c.analysis.suggestions.map(s => '· ' + s).join('\n')}

—— 同好会运行画像生成器 · VNFest`;

  const finalText = advisorText ? text.replace(/\n\n([^\n]*VNFest)$/, `\n${advisorText}\n\n$1`) : text;
  navigator.clipboard.writeText(finalText).then(() => {
    showToast('分析文案已复制');
  }).catch(() => {
    showToast('复制失败，请手动复制');
  });
}

// ===== Share: Screenshot =====
function screenshotCard() {
  if (!lastGeneratedConfig) {
    showToast('请先生成画像');
    return;
  }

  const card = document.getElementById('resultCard');

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  script.onload = function() {
    html2canvas(card, {
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--md-surface').trim() || '#0a0a0a',
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = `同好会画像-${lastGeneratedConfig.basic_info.club_name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('截图已保存');
    }).catch(() => {
      showToast('截图生成失败');
    });
  };
  script.onerror = function() {
    showToast('截图库加载失败，请检查网络');
  };
  document.body.appendChild(script);
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', function() {
  bindThemeToggle();
  bindPrefillSelector();
  bindStepNav();

  document.getElementById('btnReset').addEventListener('click', resetForm);
  document.getElementById('btnExample').addEventListener('click', loadExampleData);
  document.getElementById('btnGenerateDirect').addEventListener('click', generateDirectly);
  document.getElementById('btnGenerateWithLlm').addEventListener('click', startLlmQa);
  document.getElementById('btnSubmitLlmAndGenerate').addEventListener('click', submitLlmAnswersAndGenerate);
  document.getElementById('btnSkipLlm').addEventListener('click', skipLlmAndGenerate);
  document.getElementById('btnAdvisorSubmit').addEventListener('click', submitAdvisorAnswers);
  document.getElementById('btnAdvisorRetry').addEventListener('click', retryAdvisorQuestions);
  document.getElementById('btnCopy').addEventListener('click', copyAnalysis);
  document.getElementById('btnScreenshot').addEventListener('click', screenshotCard);

  // 尝试从主站预填同好会信息
  tryPrefill();

  // Observe theme changes for radar chart redraw
  const observer = new MutationObserver(() => {
    if (lastGeneratedConfig && document.getElementById('resultContent').style.display !== 'none') {
      const canvas = document.getElementById('radarChart');
      animateRadarChart(canvas, lastGeneratedConfig.scores, 400);
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
});
