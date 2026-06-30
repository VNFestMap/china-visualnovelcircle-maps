// src/game/handlers/arcs.js
import { clamp } from '../../utils/math.js';
import { applyRes, touchDetail, addLog, applyStat } from '../../state/mutations.js';

export const arcHandlers = {
  kyoko_listen(s) {
    const m = s.members.find((x) => x.name === '杏子');
    if (m) { m.trust = clamp(m.trust + 6); m.heat = clamp(m.heat + 3); }
    addLog(s, '杏子被你认真对待了,她开始能讲出真正的担忧。', 'arc');
  },
  kyoko_encourage(s) {
    const m = s.members.find((x) => x.name === '杏子');
    if (m) { m.trust = clamp(m.trust + 1); m.fatigue = clamp(m.fatigue + 4); }
    addLog(s, '杏子点了点头,但看起来她还在想些什么。', 'arc');
  },
  kyoko_plan(s) {
    applyStat(s, { succession: 4, content: 2 });
    touchDetail(s, { docs: 4, permission: 2, juniors: 2 });
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), '杏子'];
    addLog(s, '你和杏子一起写下了交接清单。这是她留给同好会最后的东西。', 'arc');
  },
  kyoko_relieve(s) {
    const m = s.members.find((x) => x.name === '杏子');
    if (m) { m.heat = clamp(m.heat + 5); m.fatigue = clamp(m.fatigue - 6); }
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), '杏子'];
    addLog(s, '杏子露出了很久没见的轻松表情。', 'arc');
  },
  laypark_invite(s) {
    const m = s.members.find((x) => x.name === '液泡眼');
    if (m) { m.trust = clamp(m.trust + 4); m.growth = clamp(m.growth + 2); }
    addLog(s, '液泡眼在私下讨论里话变多了,平台迭代有了方向。', 'arc');
  },
  laypark_public(s) {
    const m = s.members.find((x) => x.name === '液泡眼');
    if (m) { m.heat = clamp(m.heat + 3); m.trust = clamp(m.trust + 1); }
    addLog(s, '群里有人接着讨论平台的方向,液泡眼冒了几个气泡。', 'arc');
  },
  hanata_official(s) {
    applyStat(s, { succession: 3, content: 2 });
    touchDetail(s, { archive: 3, docs: 2 });
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), '花田'];
    addLog(s, '花田的索引被纳入官方文档。她的细致,正在成为同好会的底座。', 'arc');
  },
  hanata_mentor(s) {
    const m = s.members.find((x) => x.name === '花田');
    if (m) { m.growth = clamp(m.growth + 3); m.heat = clamp(m.heat + 2); }
    s.common.newcomer = clamp(s.common.newcomer + 2);
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), '花田'];
    addLog(s, '花田开始带新人。新人观察的人数在悄悄增加。', 'arc');
  },
  ob_listen(s) {
    applyStat(s, { succession: 2, org: 1 });
    const m = s.members.find((x) => x.name === '老会长');
    if (m) { m.trust = clamp(m.trust + 4); }
    addLog(s, '老会长分享了去年换届前后的故事。有些坑可以提前避开。', 'arc');
  },
  ob_handover(s) {
    applyStat(s, { succession: 5 });
    touchDetail(s, { docs: 5, permission: 3, obSupport: 4 });
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), '老会长'];
    addLog(s, '老会长帮我们重写了交接包的核心章节。这是她留给同好会的最后一份文档。', 'arc');
  },
  baizhi_feedback(s) {
    const m = s.members.find((x) => x.name === '白纸');
    if (m) { m.growth = clamp(m.growth + 4); m.trust = clamp(m.trust + 2); }
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), '白纸'];
    addLog(s, '白纸的看板改完第二版后稳定了。她的眼睛亮了一下。', 'arc');
  },
  baizhi_encourage(s) {
    const m = s.members.find((x) => x.name === '白纸');
    if (m) { m.heat = clamp(m.heat + 3); m.growth = clamp(m.growth + 1); }
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), '白纸'];
    addLog(s, '白纸把看板贴了出去。有点害羞,但也很高兴。', 'arc');
  },
  beichuang_read(s) {
    const m = s.members.find((x) => x.name === '北窗');
    if (m) { m.growth = clamp(m.growth + 4); m.heat = clamp(m.heat + 2); }
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), '北窗'];
    addLog(s, '你和北窗一起读完了开场脚本。她会接着改的。', 'arc');
  },
  beichuang_share(s) {
    const m = s.members.find((x) => x.name === '北窗');
    if (m) { m.heat = clamp(m.heat + 4); m.fatigue = clamp(m.fatigue + 3); }
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), '北窗'];
    addLog(s, '北窗的脚本在组内试读。她收到了具体的反馈,这是她第一次。', 'arc');
  },
  kyoko_graduation(s) {
    applyStat(s, { succession: 6, org: 3 });
    touchDetail(s, { docs: 5, permission: 4, archive: 3 });
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), 'kyoko_3'];
    addLog(s, '杏子的交接仪式简单但正式。她把责任交到了下一届手上。', 'arc');
  },
  kyoko_farewell(s) {
    applyStat(s, { succession: 4, content: 3 });
    touchDetail(s, { docs: 6, archive: 4 });
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), 'kyoko_3'];
    addLog(s, '你和杏子核对了每一份文档。她的细致,都在这些纸页里了。', 'arc');
  },
  laypark_rebuild(s) {
    touchDetail(s, { platform: 8, docs: 3 });
    applyStat(s, { content: 4, exec: 2 });
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), '液泡眼', 'laypark_2'];
    addLog(s, '液泡眼重构了平台底层。技术债偿清后,迭代速度快了很多。', 'arc');
  },
  laypark_proto(s) {
    touchDetail(s, { platform: 5, design: 4 });
    applyStat(s, { content: 3 });
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), '液泡眼', 'laypark_2'];
    addLog(s, '液泡眼的原型验证通过。她有了更清晰的方向。', 'arc');
  },
  hanata_system(s) {
    touchDetail(s, { archive: 6, docs: 5, juniors: 3 });
    applyStat(s, { org: 4, succession: 2 });
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), 'hanata_2'];
    addLog(s, '花田主导的文档体系开始运转。同好会的知识不再只存在于个人笔记里。', 'arc');
  },
  hanata_spread(s) {
    touchDetail(s, { archive: 4, docs: 3, division: 2 });
    s.common.newcomer = clamp(s.common.newcomer + 3);
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), 'hanata_2'];
    addLog(s, '花田的方法在社内推广开来。新成员 onboarding 效率提高了。', 'arc');
  },
  ob_farewell(s) {
    applyStat(s, { succession: 4, org: 2 });
    touchDetail(s, { obSupport: 4, docs: 3 });
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), 'ob_2'];
    addLog(s, '老会长说了很多做会长才知道的事。有些路,你才知道自己不是一个人走的。', 'arc');
  },
  ob_writing(s) {
    applyStat(s, { succession: 5, content: 2 });
    touchDetail(s, { docs: 6, archive: 3, obSupport: 5 });
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), 'ob_2'];
    addLog(s, '老会长的经验被写成了文档。她说这是她留给同好会最好的礼物。', 'arc');
  },
  baizhi_full(s) {
    const m = s.members.find((x) => x.name === '白纸');
    if (m) { m.growth = clamp(m.growth + 6); m.trust = clamp(m.trust + 3); }
    s.culture.creative = clamp(s.culture.creative + 3);
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), 'baizhi_2'];
    addLog(s, '白纸独立完成了看板全流程。她的设计越来越自信了。', 'arc');
  },
  baizhi_independent(s) {
    const m = s.members.find((x) => x.name === '白纸');
    if (m) { m.growth = clamp(m.growth + 5); m.heat = clamp(m.heat + 3); }
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), 'baizhi_2'];
    addLog(s, '白纸自己搞定了所有视觉物料。她开始主动发表意见了。', 'arc');
  },
  beichuang_review(s) {
    const m = s.members.find((x) => x.name === '北窗');
    if (m) { m.growth = clamp(m.growth + 5); m.heat = clamp(m.heat + 3); }
    applyStat(s, { content: 4 });
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), 'beichuang_2'];
    addLog(s, '第二次试读会上,北窗听到了更多具体的意见。她的脚本在一点点变好。', 'arc');
  },
  beichuang_revise(s) {
    const m = s.members.find((x) => x.name === '北窗');
    if (m) { m.growth = clamp(m.growth + 4); }
    touchDetail(s, { projectOutput: 3 });
    s.stats.__arcsResolved = [...(s.stats.__arcsResolved || []), 'beichuang_2'];
    addLog(s, '北窗根据反馈改完了脚本。她的写作节奏开始稳定了。', 'arc');
  },
};
