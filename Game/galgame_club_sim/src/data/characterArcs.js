export const characterArcs = {
  '杏子': [
    {
      id: 'kyoko_1', title: '副会长的疑虑',
      text: '杏子最近话少了一些。她在群聊里发了一段话："会长，我有时候会怀疑我们做的事情到底有没有人真的在意。"',
      require: { 'trust': { gte: 60 }, 'heat': { gte: 60 }, 'week': { gte: 12, lte: 30 } },
      choices: [
        { label: '认真听她说完，约一次一对一', fnRef: 'kyoko_listen' },
        { label: '鼓励她再坚持一下，会好起来的', fnRef: 'kyoko_encourage' },
      ],
    },
    {
      id: 'kyoko_2', title: '交接前的夜谈',
      text: '学期末的夜晚，杏子主动找到你。她说："我下学期要准备留学申请，但我想把这里的东西交好再走。"',
      require: { 'trust': { gte: 75 }, 'heat': { gte: 70 }, 'week': { gte: 32 },
        'fn:notResolved': { fn: (s) => !s.stats.__arcsResolved?.includes('杏子') } },
      choices: [
        { label: '一起写交接清单', fnRef: 'kyoko_plan' },
        { label: '让她先顾自己，我们再想', fnRef: 'kyoko_relieve' },
      ],
    },
    {
      id: 'kyoko_3', title: '毕业前的正式交接仪式',
      text: '毕业季临近。杏子整理好所有交接文档找到你："会长,我准备了一份详细的交接手册,你看看还有什么要补充的。"',
      require: { 'trust': { gte: 80 }, 'heat': { gte: 70 }, 'week': { gte: 40 },
        'fn:resolvedKyoko': { fn: (s) => s.stats.__arcsResolved?.includes('杏子') } },
      choices: [
        { label: '正式举办一次交接仪式', fnRef: 'kyoko_graduation' },
        { label: '和她一起核对最后的文档', fnRef: 'kyoko_farewell' },
      ],
    },
  ],
  '液泡眼': [
    {
      id: 'laypark_1', title: '沉默的伙伴',
      text: '液泡眼把写好的平台初版丢到群里，没说一句话就下线了。你看到她在群里基本不主动发言。',
      require: { 'trust': { gte: 50 }, 'growth': { gte: 55 }, 'week': { gte: 14, lte: 28 } },
      choices: [
        { label: '私下约她讨论平台迭代', fnRef: 'laypark_invite' },
        { label: '在群里公开肯定她的初版', fnRef: 'laypark_public' },
      ],
    },
    {
      id: 'laypark_2', title: '平台重构计划',
      text: '液泡眼提交了一份平台重构草案,标注了所有已知的技术债。"如果能让我放手做,下个月可以出一版新的。"',
      require: { 'growth': { gte: 65 }, 'week': { gte: 30 },
        'fn:layparkPlatform': { fn: (s) => s.detail?.platform >= 40 } },
      choices: [
        { label: '支持她全面重构平台', fnRef: 'laypark_rebuild' },
        { label: '让她先做原型验证', fnRef: 'laypark_proto' },
      ],
    },
  ],
  '花田': [
    {
      id: 'hanata_1', title: '档案角的常客',
      text: '花田整理了去年所有的研讨会录音，写了一份厚厚的"推荐书目索引"。她说："我想让下届一接手就能用。"',
      require: { 'trust': { gte: 55 }, 'growth': { gte: 55 }, 'week': { gte: 20 },
        'fn:hanataArchive': { fn: (s) => s.detail?.archive >= 40 } },
      choices: [
        { label: '把她的索引纳入官方文档', fnRef: 'hanata_official' },
        { label: '安排她带一位新成员', fnRef: 'hanata_mentor' },
      ],
    },
    {
      id: 'hanata_2', title: '文档体系蓝图',
      text: '花田拿着一个笔记本来找你,里面画了一张"同好会知识库"的结构图。"如果按这个来,以后每个人都能快速找到需要的资料。"',
      require: { 'growth': { gte: 60 }, 'week': { gte: 35 },
        'fn:hanataArchive2': { fn: (s) => s.detail?.archive >= 50 },
        'fn:resolvedHanata': { fn: (s) => s.stats.__arcsResolved?.includes('花田') } },
      choices: [
        { label: '让她主导文档体系建设', fnRef: 'hanata_system' },
        { label: '把她的方法推广给全社', fnRef: 'hanata_spread' },
      ],
    },
  ],
  '老会长': [
    {
      id: 'ob_1', title: '毕业前的话',
      text: '老会长提着一袋奶茶来同好会活动室："会长，我有几句话想跟你说。其实我去年这时候也在想类似的事情。"',
      require: { 'trust': { gte: 65 }, 'heat': { gte: 60 }, 'week': { gte: 30 } },
      choices: [
        { label: '坐下来听她讲当年的事', fnRef: 'ob_listen' },
        { label: '请她帮我们看看交接包', fnRef: 'ob_handover' },
      ],
    },
    {
      id: 'ob_2', title: '最后的留言',
      text: '老会长毕业答辩结束后来到活动室:"会长,我有些话想单独跟你说说。关于做会长的那些事,有些我现在才能讲。"',
      require: { 'week': { gte: 42 } },
      choices: [
        { label: '认真听她的毕业留言', fnRef: 'ob_farewell' },
        { label: '请她把经验写成文档', fnRef: 'ob_writing' },
      ],
    },
  ],
  '白纸': [
    {
      id: 'baizhi_1', title: '第一份看板',
      text: '白纸熬夜画完了迎新看板的初版，但有些犹豫要不要直接拿去用。',
      require: { 'growth': { gte: 45 }, 'week': { gte: 6, lte: 16 } },
      choices: [
        { label: '陪她看一遍,给出具体反馈', fnRef: 'baizhi_feedback' },
        { label: '直接鼓励她,新人就要敢试', fnRef: 'baizhi_encourage' },
      ],
    },
    {
      id: 'baizhi_2', title: '独立负责看板',
      text: '白纸说她想独立负责下一次活动的全部视觉设计。"从构思到落地,我想试一次完整的流程。"',
      require: { 'growth': { gte: 55 }, 'week': { gte: 28 } },
      choices: [
        { label: '陪她走完完整流程', fnRef: 'baizhi_full' },
        { label: '让她独立完成,给予信任', fnRef: 'baizhi_independent' },
      ],
    },
  ],
  '北窗': [
    {
      id: 'beichuang_1', title: '脚本的第一次',
      text: '北窗把 视觉小说 的开场脚本写了出来,但反复改了好几版。她问："这样会不会太套路了?"',
      require: { 'growth': { gte: 40 }, 'heat': { gte: 55 }, 'week': { gte: 18, lte: 34 } },
      choices: [
        { label: '一起读一遍,给她具体的反馈', fnRef: 'beichuang_read' },
        { label: '安排一次组内试读', fnRef: 'beichuang_share' },
      ],
    },
    {
      id: 'beichuang_2', title: '试读反馈之后',
      text: '北窗拿着试读反馈记录坐在你旁边:"大家的意见我都记下来了,但有些地方我不知道该怎么改比较合适。"',
      require: { 'heat': { gte: 65 }, 'week': { gte: 32 },
        'fn:resolvedBeichuang': { fn: (s) => s.stats.__arcsResolved?.includes('北窗') } },
      choices: [
        { label: '组织第二次试读会', fnRef: 'beichuang_review' },
        { label: '让她根据反馈自行修改', fnRef: 'beichuang_revise' },
      ],
    },
  ],
};
