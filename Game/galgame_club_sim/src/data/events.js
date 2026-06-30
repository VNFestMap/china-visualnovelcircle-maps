export const eventPool = [
  {
    id: 'magazine_delay',
    when: { project: 'magazine' },
    title: '投稿进度告急',
    text: '社刊企划里有人迟迟没交稿。你要怎么处理？',
    choices: [
      { label: '延期一周，保证完整度', fnRef: 'extendMagazine' },
      { label: '删减部分版块，按时推进', fnRef: 'trimMagazine' },
    ],
  },
  {
    id: 'core_fatigue',
    when: { minAvgFatigue: 48 },
    title: '核心成员有点低落',
    text: '负责推进的核心成员明显疲惫了。',
    choices: [
      { label: '本周先缓一下', fnRef: 'restCore' },
      { label: '继续推进，咬牙顶过去', fnRef: 'pushCore' },
    ],
  },
  {
    id: 'joint_invite',
    title: '外校发来联动邀请',
    text: '另一个学校想一起做线上推荐会。',
    choices: [
      { label: '接下邀请', fnRef: 'acceptJoint' },
      { label: '礼貌婉拒，先稳住内部', fnRef: 'declineJoint' },
    ],
  },
  {
    id: 'campus_festival',
    when: { seasons: ['spring', 'autumn'] },
    title: '校园文化节邀请',
    text: '校学生会希望同好会在文化节做一个微展位。',
    choices: [
      { label: '接下，做个小型展位', fnRef: 'acceptBooth' },
      { label: '婉拒，优先做企划', fnRef: 'declineBooth' },
    ],
  },
  {
    id: 'funding_audit',
    title: '经费审查通知',
    text: '校团委发来通知，要求下周三之前提交同好会经费使用明细和下学期预算计划。',
    choices: [
      { label: '认真核对账目，本周花时间整理', fnRef: 'auditCareful' },
      { label: '把模板发给财务的同学去填', fnRef: 'auditDelegate' },
    ],
  },
  {
    id: 'member_attrition',
    title: '成员流失预警',
    text: '几个普通成员私下说这学期课业太重，可能没法继续参加活动了。',
    choices: [
      { label: '逐一私聊了解情况,尽力挽留', fnRef: 'retainMembers' },
      { label: '放宽考勤,说随时可以回来', fnRef: 'loosenAttendance' },
    ],
  },
  {
    id: 'server_outage',
    when: { minPlatform: 28 },
    title: '服务器宕机',
    text: '同好会自建的平台服务器突然无法访问。数据库和文件没有备份提示。',
    choices: [
      { label: '立刻排查问题,找人修复', fnRef: 'fixServer' },
      { label: '联系学校IT部门协助恢复', fnRef: 'callIT' },
    ],
  },
  {
    id: 'expo_invite',
    when: { seasons: ['summer', 'winter'], minCulturePublication: 5 },
    title: '漫展合作邀请',
    text: '本地同人展组委会邀请同好会在展会上做一个迷你展示区——提供场地和基础物料。',
    choices: [
      { label: '接下邀请,准备展示内容', fnRef: 'acceptExpo' },
      { label: '推荐给其他学校的同好会', fnRef: 'referExpo' },
    ],
  },
  {
    id: 'first_offline_meetup',
    when: { minCommonTotal: 20, maxCommonTotal: 55 },
    title: '第一次真正坐满教室',
    text: '报名表第一次超过了核心成员能逐个照顾的范围。有人建议分成新人与老成员两桌。',
    choices: [
      { label: '安排破冰和引导员', fnRef: 'guidedMeetup' },
      { label: '保持自由交流', fnRef: 'openMeetup' },
    ],
  },
  {
    id: 'publication_orders',
    when: { minCulturePublication: 12 },
    title: '社刊出现追加订单',
    text: '活动结束后还有人询问能否购买社刊。追加印刷可以带来收入，但会占用核心组精力。',
    choices: [
      { label: '小批量追加印刷', fnRef: 'reprintMagazine' },
      { label: '发布电子版，停止加印', fnRef: 'releaseDigital' },
    ],
  },
  {
    id: 'hundred_member_management',
    when: { minCommonTotal: 100 },
    title: '百人群的管理危机',
    text: '群聊消息越来越快，新人提问被淹没，也有人抱怨活动信息找不到。',
    choices: [
      { label: '建立分区、FAQ 和新人引导', fnRef: 'structureCommunity' },
      { label: '保持一个大群的自由气氛', fnRef: 'keepOneGroup' },
    ],
  },
  {
    id: 'topic_conflict',
    when: { minCommonTotal: 45 },
    title: '讨论方向发生分歧',
    text: '一部分成员希望多办轻松活动，另一部分成员希望继续深度研讨和创作。',
    choices: [
      { label: '建立不同活动支线', fnRef: 'splitTracks' },
      { label: '集中资源维持主线', fnRef: 'focusTrack' },
    ],
  },
];
