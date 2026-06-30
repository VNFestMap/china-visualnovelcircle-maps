// src/game/handlers/events.js
import { clamp } from '../../utils/math.js';
import { applyRes, touchDetail, addLog, applyStat, boostProjectType } from '../../state/mutations.js';
import { currentMember } from '../lifecycle.js';

const cm = (s) => currentMember(s);

export const eventHandlers = {
  extendMagazine(s) {
    applyRes(s, { pressure: -2 });
    touchDetail(s, { docs: 2, archive: 1 });
    addLog(s, '你决定延期一周，保住了质量，但节奏变慢了。', 'major');
  },
  trimMagazine(s) {
    applyRes(s, { pressure: 2, credit: 1 });
    boostProjectType(s, 'magazine', { progress: 10, quality: -2, load: -2 });
    addLog(s, '你砍掉了边缘版块，刊物得以继续推进。', 'major');
  },
  restCore(s) {
    const m = cm(s);
    m.fatigue = clamp(m.fatigue - 12);
    m.heat = clamp(m.heat + 4);
    applyRes(s, { pressure: -4 });
    addLog(s, `${m.name} 得到了休整，状态恢复了一些。`, 'major');
  },
  pushCore(s) {
    const m = cm(s);
    m.fatigue = clamp(m.fatigue + 8);
    applyRes(s, { pressure: 5 });
    addLog(s, `${m.name} 继续顶着做，但疲劳又上升了。`, 'major');
  },
  acceptJoint(s) {
    applyStat(s, { external: 4, exec: 1 });
    applyRes(s, { relations: 6, pressure: 4, fame: 2 });
    s.culture.alliance = clamp(s.culture.alliance + 4);
    addLog(s, '你接下了联动邀请，同好会外联进一步扩张。', 'major');
  },
  declineJoint(s) {
    applyStat(s, { org: 2, succession: 1 });
    applyRes(s, { pressure: -2 });
    addLog(s, '你选择先稳住内部节奏，避免把同好会拖进过载状态。', 'major');
  },
  acceptBooth(s) {
    applyRes(s, { funds: 40, fame: 4, credit: 1, pressure: 4 });
    applyStat(s, { external: 2 });
    s.culture.campus = clamp(s.culture.campus + 2);
    addLog(s, '你接下了文化节展位,同好会在校内的存在感变强了。', 'major');
  },
  declineBooth(s) {
    applyRes(s, { pressure: -3 });
    addLog(s, '你婉拒了展位,把时间留给正在推进的企划。', 'major');
  },
  auditCareful(s) {
    applyRes(s, { pressure: 3, credit: 4 });
    touchDetail(s, { finance: 5, compliance: 4, docs: 2 });
    applyStat(s, { org: 2 });
    addLog(s, '你花时间整理了详细账目,团委那边对同好会的印象变好了。', 'major');
  },
  auditDelegate(s) {
    applyRes(s, { pressure: 1 });
    touchDetail(s, { compliance: 1 });
    addLog(s, '你让财务的同学去处理了审查,报告勉强通过。', 'major');
  },
  retainMembers(s) {
    applyRes(s, { pressure: 3, fame: -1 });
    s.common.active = clamp(s.common.active + 2);
    s.common.mood = clamp(s.common.mood + 3);
    addLog(s, '你主动联系了想退出的成员,有几个人愿意再留一阵。', 'major');
  },
  loosenAttendance(s) {
    applyRes(s, { pressure: -2 });
    s.common.active = clamp(s.common.active - 2);
    s.common.newcomer = clamp(s.common.newcomer - 1);
    addLog(s, '你放宽了出勤要求,短期内不会有人退出,但到场人数会少一些。', 'major');
  },
  fixServer(s) {
    applyRes(s, { pressure: 6, fame: -2 });
    touchDetail(s, { platform: -3 });
    s.common.mood = clamp(s.common.mood - 4);
    addLog(s, '服务器恢复了,但有一些资料没找回。核心成员跟着熬了一夜。', 'major');
  },
  callIT(s) {
    applyRes(s, { pressure: 2 });
    touchDetail(s, { platform: 1, docs: 2 });
    addLog(s, 'IT部门帮忙恢复了服务器。虽然问了很多问题,但资料没丢。', 'major');
  },
  acceptExpo(s) {
    applyRes(s, { fame: 6, relations: 4, pressure: 6, funds: 60 });
    applyStat(s, { external: 3, exec: 1 });
    s.culture.publication = clamp(s.culture.publication + 3);
    addLog(s, '你们在迷你展区展示了自己的社刊和视觉小说 demo。有人拍了照发到SNS上。', 'major');
  },
  referExpo(s) {
    applyRes(s, { relations: 3 });
    addLog(s, '你把机会推荐给了友校同好会。对方很高兴,关系变得更好了一些。', 'major');
  },
  guidedMeetup(s) {
    applyStat(s, { org: 3, part: 3 });
    touchDetail(s, { newcomer: 5, retention: 4 });
    s.common.active = clamp(s.common.active + 3, 0, s.common.total);
    s.common.mood = clamp(s.common.mood + 4);
    addLog(s, '引导员把第一次来的成员带进了讨论，活动结束后仍有人留在教室里交换联系方式。', 'major');
  },
  openMeetup(s) {
    applyRes(s, { pressure: -2 });
    s.common.mood = clamp(s.common.mood + 2);
    s.common.silent = Math.max(0, (s.common.silent || 0) + 2);
    addLog(s, '自由交流让熟人聊得很开心，但几位新人安静地提前离开了。', 'major');
  },
  reprintMagazine(s) {
    applyRes(s, { funds: 120, fame: 4, pressure: 5 });
    applyStat(s, { content: 2, exec: 2 });
    addLog(s, '追加印刷很快售完，刊物第一次成为可以持续回收成本的成果。', 'major');
  },
  releaseDigital(s) {
    applyRes(s, { fame: 7, influence: 5, pressure: -1 });
    touchDetail(s, { platform: 3, archive: 3 });
    addLog(s, '电子版在多个社群里被转发，传播范围超过了原本的线下活动。', 'major');
  },
  structureCommunity(s) {
    applyStat(s, { org: 5, succession: 2 });
    touchDetail(s, { docs: 5, newcomer: 5, retention: 5 });
    applyRes(s, { pressure: 3 });
    s.common.active = clamp(s.common.active + 5, 0, s.common.total);
    addLog(s, '分区和新人指引上线后，重要信息终于不再被聊天记录淹没。', 'major');
  },
  keepOneGroup(s) {
    applyRes(s, { pressure: -2 });
    s.common.mood = clamp(s.common.mood - 4);
    s.common.silent = Math.max(0, (s.common.silent || 0) + 6);
    addLog(s, '大群仍然热闹，但越来越多新人只看消息，不再主动参与。', 'major');
  },
  splitTracks(s) {
    applyStat(s, { org: 3, part: 4, content: 2 });
    touchDetail(s, { division: 4, planning: 3 });
    applyRes(s, { pressure: 3 });
    addLog(s, '轻松活动与创作研讨各自形成节奏，成员开始按兴趣找到自己的位置。', 'major');
  },
  focusTrack(s) {
    applyStat(s, { exec: 4, content: 3 });
    s.common.active = clamp(s.common.active - 2, 0, s.common.total);
    applyRes(s, { pressure: -1 });
    addLog(s, '主线推进更集中，但一部分只想轻松参与的成员逐渐沉默。', 'major');
  },
};
