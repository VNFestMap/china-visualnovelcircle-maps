// 49张角色卡
// passive: [{ trigger: { type, actionTags?, stat?, op? }, effect: { ... }, desc }]

// === 原作保留 (8) ===
const legacy = [
  { name: '老会长', grade: '四年级', role: '顾问 / 摊位经验', tags: ['摊位', '组织', '宣传'], heat: 52, fatigue: 22, trust: 60, growth: 70, trait: '经验丰富但即将毕业', skill: 'booth_veteran',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['摊位'] }, effect: { res: { relations: 4, funds: 30 } }, desc: '出摊后外联与经费提升' }],
    weakness: { condition: { op: 'gt', val: 75 }, effect: { memberFatigue: 3 }, desc: '年纪大了，压力过高时体力消耗加剧' } },
  { name: '杏子', grade: '三年级', role: '副会长 / 文案主持', tags: ['文案', '主持', '组织'], heat: 72, fatigue: 18, trust: 54, growth: 58, trait: '热情但容易燃尽', skill: 'taoyuan_meet',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['茶会', '团建'] }, effect: { common: { mood: 4 } }, desc: '线下攒局后气氛提升' }],
    weakness: { condition: { op: 'gt', val: 70 }, effect: { memberHeat: -3 }, desc: '热情燃尽时容易失去动力' } },
  { name: '液泡眼', grade: '二年级', role: '前端 / 宣传', tags: ['前端', '宣传', '资料整理'], heat: 62, fatigue: 14, trust: 48, growth: 50, trait: '能力强但不主动', skill: 'open_source_vn',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['前端', '平台'] }, effect: { detail: { platform: 4 } }, desc: '维护平台额外获得经验' }],
    weakness: { condition: { op: 'lt', val: 40 }, effect: { memberGrowth: -2 }, desc: '信任不足时会消极怠工' } },
  { name: '花田', grade: '二年级', role: '日语 / 校对', tags: ['日语', '校对', '文案'], heat: 60, fatigue: 12, trust: 46, growth: 52, trait: '稳定可靠', skill: 'music_director',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['音乐', '创作'] }, effect: { common: { mood: 4 } }, desc: '音乐活动后气氛提升' }],
    weakness: { condition: { stat: 'participation', op: 'lt', val: 50 }, effect: { res: { influence: -2 } }, desc: '参与度低时创作效果打折扣' } },
  { name: '白纸', grade: '一年级', role: '绘图 / 排版新人', tags: ['绘图', '排版'], heat: 66, fatigue: 10, trust: 38, growth: 35, trait: '新人但成长快', skill: 'layout'},
  { name: '北窗', grade: '一年级', role: '脚本 / 音乐兴趣', tags: ['脚本', '音乐'], heat: 58, fatigue: 8, trust: 34, growth: 32, trait: '创作欲高但抗压低', skill: 'proto'},
  { name: '月见', grade: '二年级', role: '组织 / 资料整理', tags: ['组织', '主持', '资料整理'], heat: 60, fatigue: 9, trust: 26, growth: 30, trait: '愿意接锅但需要引导', skill: 'succ'},
  { name: '青柠', grade: '一年级', role: '美术', tags: ['绘图', '排版'], heat: 64, fatigue: 6, trust: 28, growth: 22, trait: '安静但很会画', skill: 'layout'},
];

// === 日本例外 SSR (2) ===
const japanSSR = [
  { name: '苇船', grade: '三年级', role: '年度活动主办 / 外联中枢', tags: ['外联', '主持', '组织', '宣传'], heat: 82, fatigue: 16, trust: 58, growth: 64, trait: '跨校交流的编织者', skill: 'hakugai_ren',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['展会', '联动', '刊物'] }, effect: { res: { relations: 4 } }, desc: '大型活动后外联额外提升' }],
    weakness: { condition: { op: 'lt', val: 50 }, effect: { res: { pressure: 6 } }, desc: '组织不稳时大型活动带来额外压力' } },
  { name: '亚茨', grade: '三年级', role: '总编辑 / 企划发起人', tags: ['文案', '校对', '组织', '外联'], heat: 80, fatigue: 18, trust: 56, growth: 60, trait: '页数变厚不是事故而是热情', skill: 'contract_book',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['刊物', '联动'] }, effect: { project: { quality: 3 } }, desc: '联合刊物项目质量提升' }],
    weakness: { condition: { op: 'gt', val: 70 }, effect: { res: { pressure: 5 } }, desc: '项目负荷过高时页数膨胀失控' } },
];

// === 中国高校 SSR (6) ===
const cnSSR = [
  { name: '国文', grade: '三年级', role: '翻译协调 / 档案留存', tags: ['文案', '翻译', '资料整理', '外联'], heat: 78, fatigue: 15, trust: 54, growth: 62, trait: '把对话转化为可继承的档案', skill: 'bridge_archive',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['刊物', '平台', '交接'] }, effect: { detail: { archive: 4, docs: 3 } }, desc: '文档类行动后档案积累' }],
    weakness: { condition: { op: 'gt', val: 68 }, effect: { memberFatigue: 4 }, desc: '连续文字工作后疲劳累积加速' } },
  { name: '栞月', grade: '三年级', role: '温暖创始人 / 动漫社桥梁', tags: ['组织', '主持', '文案'], heat: 82, fatigue: 14, trust: 62, growth: 56, trait: '只是想找个能投入故事的地方', skill: 'story_seed',
    passive: [{ trigger: { type: 'onWeekEnd' }, effect: { common: { mood: 3 } }, desc: '创始温度持续温暖同好会' }],
    weakness: { condition: { stat: 'actionCat', op: 'is', val: '展会' }, effect: { stats: { exec: -3 } }, desc: '不擅长大型商业化活动' } },
  { name: '封寒修', grade: '三年级', role: '川渝联动发动机 / 萌战推手', tags: ['组织', '外联', '宣传', '摊位'], heat: 88, fatigue: 17, trust: 56, growth: 66, trait: 'No Man Is An Island', skill: 'moe_war',
    passive: [{ trigger: { type: 'onSeasonStart', season: 'autumn' }, effect: { common: { total: 3, newcomer: 4 } }, desc: '秋季招新规格提升' }],
    weakness: { condition: { op: 'gt', val: 3 }, effect: { res: { pressure: 4 } }, desc: '同时推进多个项目时分身乏术' } },
  { name: '木台', grade: '二年级', role: '刊物文案 / 原创视觉小说叙事', tags: ['文案', '脚本', '校对'], heat: 80, fatigue: 13, trust: 52, growth: 58, trait: '热情要怎样才会转化为作品？', skill: 'story_writer',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['刊物', '创作', '研讨'] }, effect: { detail: { articles: 3 } }, desc: '内容创作后自动生成文章' }],
    weakness: { condition: { op: 'lt', val: 50 }, effect: { project: { progress: -8 } }, desc: '组织低于50时项目推进困难' } },
  { name: '嗨呐', grade: '二年级', role: '刊物美工排版 / 命名天才', tags: ['排版', '绘图', '文案'], heat: 78, fatigue: 14, trust: 54, growth: 60, trait: '头上有犄角身后有旮旯', skill: 'masterpiece_name',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['刊物', '创作'] }, effect: { project: { load: -4 } }, desc: '制作刊物时项目负荷降低' }],
    weakness: { condition: { stat: 'multiProject', op: 'gt', val: 1 }, effect: { memberFatigue: 8 }, desc: '被多项目依赖时疲劳加倍' } },
  { name: '子夜', grade: '二年级', role: '行动力新群主 / 评选制度设计者', tags: ['组织', '主持', '宣传'], heat: 88, fatigue: 16, trust: 58, growth: 64, trait: '只有聊天不够，活动要真的办起来', skill: 'rule_reform',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['评选', '投票'] }, effect: { stats: { succession: 4 } }, desc: '投票评选后传承力提升' }],
    weakness: { condition: { stat: 'docs', op: 'lt', val: 30 }, effect: { res: { pressure: 4 } }, desc: '文档不足时规则复杂易出错' } },
];

// === 中国高校 SR (19) ===
const cnSR = [
  { name: '格林', grade: '二年级', role: '扩容协调者 / 外联大使', tags: ['外联', '组织', '文案'], heat: 76, fatigue: 13, trust: 50, growth: 55, trait: '这么好的企划不能浪费', skill: 'expansion_drive',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['刊物', '联动'] }, effect: { project: { quality: 4 } }, desc: '联合企划后项目质量提升' }],
    weakness: { condition: { op: 'gt', val: 70 }, effect: { project: { risk: 10 } }, desc: '压力过高时工作量不可控' } },
  { name: '琪努诺', grade: '一年级', role: '情绪动员 / 角色纪念活动', tags: ['音乐', '主持', '组织'], heat: 95, fatigue: 16, trust: 46, growth: 48, trait: '喜欢到极限的时候就该把它唱出来', skill: 'star_matsuri',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['角色纪念', '音乐'] }, effect: { common: { mood: 6 }, stats: { part: 3 } }, desc: '纪念活动后士气与参与度大增' }],
    weakness: { condition: { stat: 'planning', op: 'lt', val: 40 }, effect: { project: { risk: 8 } }, desc: '情绪上头时容易忽视流程' } },
  { name: '美咲', grade: '二年级', role: '主题活动策划 / 教室占领者', tags: ['组织', '主持', '文案'], heat: 84, fatigue: 14, trust: 52, growth: 56, trait: '来办峰城祭吧', skill: 'flower_fes',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['研讨', '纪念'] }, effect: { res: { fame: 4 } }, desc: '主题活动后知名度提升' }],
    weakness: { condition: { stat: 'newcomer', op: 'lt', val: 30 }, effect: { stats: { part: -6 } }, desc: '新人少时题材门槛太高' } },
  { name: '方达', grade: '三年级', role: '开源框架程序员 / 技术担当', tags: ['脚本', '前端', '资料整理'], heat: 68, fatigue: 15, trust: 52, growth: 50, trait: '框架先跑起来故事才有地方发生', skill: 'oss_framework',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['创作'] }, effect: { project: { progress: 2 } }, desc: '原创视觉小说每周自动推进' }],
    weakness: { condition: { stat: 'content', op: 'lt', val: 30 }, effect: { memberGrowth: -3 }, desc: '剧情美术未就绪时技能效果打折' } },
  { name: '奶蒲', grade: '二年级', role: '总音监 / 氛围掌控者', tags: ['音乐', '脚本', '校对'], heat: 76, fatigue: 12, trust: 48, growth: 52, trait: '故事的温度藏在第一段旋律里', skill: 'music_director',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['音乐', '创作'] }, effect: { common: { mood: 4 } }, desc: '音乐活动后气氛提升' }],
    weakness: { condition: { stat: 'actionCat', op: 'is', val: '招新' }, effect: { stats: { part: -4 } }, desc: '对招新和合规帮助较少' } },
  { name: '西木', grade: '三年级', role: '群主 / 失败企划复盘者', tags: ['组织', '文案', '资料整理'], heat: 80, fatigue: 18, trust: 54, growth: 60, trait: '一个人的热情不足以温暖全场', skill: 'rebuild',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['复盘', '交接'] }, effect: { project: { risk: -10 } }, desc: '复盘后同类企划风险大幅降低' }],
    weakness: { condition: { stat: 'consecutivePressure', op: 'gt', val: 2 }, effect: { memberHeat: -8 }, desc: '连续高压行动热情快速下降' } },
  { name: '禾平', grade: '二年级', role: '初代群主 / 宽松入口设计者', tags: ['组织', '宣传', '主持'], heat: 66, fatigue: 10, trust: 52, growth: 48, trait: '先给大家一个能聊共同兴趣的地方', skill: 'easy_entry',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['招新'] }, effect: { common: { total: 2 } }, desc: '招新后普通成员增长' }],
    weakness: { condition: { stat: 'total', op: 'gt', val: 200 }, effect: { common: { mood: -4 } }, desc: '成员过多时浓度失控' } },
  { name: '天海恋香', grade: '二年级', role: '展会契机提供者 / 地区活动引线', tags: ['外联', '摊位', '组织'], heat: 82, fatigue: 15, trust: 52, growth: 56, trait: '要不要来展会上见一面？', skill: 'only_invite',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['展会', '出摊'] }, effect: { res: { relations: 5 } }, desc: '展会类行动外联额外提升' }],
    weakness: { condition: { op: 'lt', val: 1 }, effect: { project: { progress: -12 } }, desc: '没有可售制品时展会收益打折扣' } },
  { name: '风涧月', grade: '四年级', role: '毕业学长 / 约定兑现者', tags: ['文案', '组织', '资料整理'], heat: 76, fatigue: 20, trust: 58, growth: 62, trait: '说出来的事就得尽力去完成', skill: 'graduation_vow',
    passive: [{ trigger: { type: 'onSeasonStart', season: 'spring' }, effect: { stats: { succession: 5 } }, desc: '毕业季传承力提升' }],
    weakness: { condition: { op: 'gt', val: 30 }, effect: { memberHeat: -5 }, desc: '每学期末可用度递减' } },
  { name: '橘小柚', grade: '一年级', role: '同好会形象 / 招新门面', tags: ['绘图', '宣传', '排版'], heat: 78, fatigue: 10, trust: 44, growth: 46, trait: '欢迎回到放课后的同好会', skill: 'orange_beacon',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['招新', '宣传'] }, effect: { res: { fame: 2 } }, desc: '宣传招新后知名度提升' }],
    weakness: { condition: { stat: 'design', op: 'lt', val: 30 }, effect: { res: { fame: -4 } }, desc: '视觉资产断更时品牌效应递减' } },
  { name: '绪方恋香', grade: '三年级', role: '地区展会策划 / 法律系协调者', tags: ['外联', '组织', '文案'], heat: 78, fatigue: 16, trust: 54, growth: 58, trait: '把同好会带到现实场地才知道协调有多复杂', skill: 'cq_expo',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['展会', '联动'] }, effect: { project: { risk: -6 } }, desc: '展会联动时项目风险降低' }],
    weakness: { condition: { op: 'gt', val: 70 }, effect: { res: { pressure: 3 } }, desc: '展会筹备期压力上升较快' } },
  { name: '柯米', grade: '三年级', role: '老牌同好会起点叙述者', tags: ['文案', '组织', '资料整理'], heat: 68, fatigue: 14, trust: 54, growth: 52, trait: '老同好会的起点往往像一次意外', skill: 'kirmy_origin',
    passive: [{ trigger: { type: 'onWeekEnd' }, effect: { detail: { archive: 2 } }, desc: '老同好会档案持续积累' }],
    weakness: { condition: { stat: 'actionCat', op: 'is', val: '招新' }, effect: { stats: { part: -4 } }, desc: '短期招新爆发力不足' } },
  { name: '犀安路鉴赏家', grade: '二年级', role: '铁道主题同好会叙述者', tags: ['文案', '组织', '资料整理'], heat: 70, fatigue: 11, trust: 48, growth: 54, trait: '同好会也可以有自己的路线图', skill: 'railway_route',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['规划', '平台'] }, effect: { detail: { planning: 4 } }, desc: '规划类行动后统筹力提升' }],
    weakness: { condition: { stat: 'actionCat', op: 'is', val: '宣传' }, effect: { stats: { exec: -3 } }, desc: '短期宣传爆发力低' } },
  { name: '优希', grade: '二年级', role: '鸟白岛叙述者 / 远方同好会连接', tags: ['文案', '外联', '主持'], heat: 72, fatigue: 11, trust: 48, growth: 52, trait: '每个学校都有自己的鸟白岛', skill: 'island_letter',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['研讨', '联动'] }, effect: { common: { mood: 3 } }, desc: '研讨联动后气氛提升' }],
    weakness: { condition: { op: 'lt', val: 40 }, effect: { stats: { content: -3 } }, desc: '缺少主题作品配合时效果一般' } },
  { name: '小京', grade: '三年级', role: '老牌群系年表管理员', tags: ['资料整理', '组织', '文案'], heat: 74, fatigue: 16, trust: 56, growth: 58, trait: '能活过十年的同好会靠的不只是热情', skill: 'decade_log',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['传统', '评选'] }, effect: { detail: { archive: 3 } }, desc: '传统活动后档案持续积累' }],
    weakness: { condition: { op: 'gt', val: 5 }, effect: { common: { newcomer: -3 } }, desc: '历史包袱重新人融入难' } },
  { name: '芙蕾', grade: '二年级', role: '文学化同好会叙述者', tags: ['文案', '校对', '主持'], heat: 72, fatigue: 12, trust: 48, growth: 52, trait: '同好会是一首合唱每个人都该有自己的声部', skill: 'sakura_chorus',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['研讨', '刊物'] }, effect: { detail: { articles: 4 } }, desc: '研讨刊物后文章质量提升' }],
    weakness: { condition: { op: 'gt', val: 60 }, effect: { project: { progress: -4 } }, desc: '执行推进较慢' } },
  { name: '重晴浮星韵', grade: '一年级', role: '抒情记录者 / 情谊存档师', tags: ['文案', '校对', '资料整理'], heat: 74, fatigue: 10, trust: 44, growth: 50, trait: '如果同好会情谊有回响那一定是星尘', skill: 'stardust_echo',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['刊物', '交接'] }, effect: { common: { mood: 4 } }, desc: '文档交接后气氛提升' }],
    weakness: { condition: { op: 'gt', val: 40 }, effect: { memberFatigue: 3 }, desc: '情感投入多时自身易疲劳' } },
  { name: '阿飞', grade: '二年级', role: '独立同好会史记录者', tags: ['组织', '文案', '资料整理'], heat: 66, fatigue: 13, trust: 50, growth: 52, trait: '从小群到独立同好会边界是慢慢长出来的', skill: 'rubber_duck',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['合规', '交接'] }, effect: { res: { credit: 3 } }, desc: '合规交接后同好会信用提升' }],
    weakness: { condition: { op: 'gt', val: 100 }, effect: { res: { funds: -15 } }, desc: '独立初期资源不足经费紧张' } },
  { name: '古明地雷', grade: '二年级', role: '研究会型介绍者 / 深度讨论', tags: ['文案', '校对', '主持'], heat: 68, fatigue: 12, trust: 48, growth: 50, trait: '如果叫研究会那就认真把作品研究下去', skill: 'research_stance',
    passive: [{ trigger: { type: 'onActionComplete', actionTags: ['研讨', '刊物'] }, effect: { detail: { articles: 4, review: 3 } }, desc: '研讨刊物后文章深度提升' }],
    weakness: { condition: { stat: 'actionCat', op: 'is', val: '团建' }, effect: { stats: { part: -4 } }, desc: '轻松团建参与度较低' } },
];

// === 中国高校 R (12) ===
const cnR = [
  { name: '薇尔', grade: '一年级', role: '人物美术', tags: ['绘图', '排版'], heat: 72, fatigue: 12, trust: 34, growth: 36, trait: '角色站起来之后企划才像真的开始了', skill: 'layout'},
  { name: '安枫有希', grade: '一年级', role: '场景美术', tags: ['绘图'], heat: 68, fatigue: 10, trust: 32, growth: 34, trait: '背景不是装饰是同好会故事发生的地方', skill: 'layout'},
  { name: '秋冷朔月', grade: '一年级', role: 'UI美术', tags: ['绘图', '前端'], heat: 66, fatigue: 11, trust: 34, growth: 36, trait: '按钮也要有故事感', skill: 'layout'},
  { name: '邮宝娘画师', grade: '一年级', role: '社娘绘制 / 视觉资产', tags: ['绘图', '宣传'], heat: 70, fatigue: 9, trust: 36, growth: 34, trait: '先让同好会有一张能被记住的脸', skill: 'layout'},
  { name: '百川白大褂少女', grade: '二年级', role: '同好会形象 / 研究感门面', tags: ['文案', '宣传', '绘图'], heat: 72, fatigue: 10, trust: 42, growth: 38, trait: '我们研究的不只是作品还有喜欢作品的人', skill: 'archive'},
  { name: '日和', grade: '一年级', role: '贴吧招新型创始人', tags: ['宣传', '主持'], heat: 66, fatigue: 8, trust: 36, growth: 32, trait: '一开始只是贴吧里的一个入口', skill: 'ice'},
  { name: '鲑铃', grade: '一年级', role: '活动记录者 / 观察者', tags: ['文案', '资料整理'], heat: 62, fatigue: 7, trust: 34, growth: 34, trait: '知道得晚也没关系记录下来就能补上空白', skill: 'archive'},
  { name: '泡泡', grade: '一年级', role: '陪伴式记录者', tags: ['文案', '资料整理'], heat: 62, fatigue: 8, trust: 36, growth: 36, trait: '不是元老也可以把自己见过的路写下来', skill: 'archive'},
  { name: '傻子望天', grade: '一年级', role: '新同好会命名者 / 三人起步', tags: ['文案', '组织'], heat: 70, fatigue: 9, trust: 38, growth: 40, trait: '三个喜欢的作品也能拼出一个同好会名', skill: 'ice'},
  { name: '败火', grade: '三年级', role: '关系沉淀型记录者', tags: ['文案', '组织'], heat: 68, fatigue: 14, trust: 50, growth: 46, trait: '有些关系已经不是同好两个字能概括的了', skill: 'succ'},
  { name: '雪风', grade: '二年级', role: '命名拖延但最终定稿者', tags: ['文案', '资料整理'], heat: 64, fatigue: 10, trust: 42, growth: 36, trait: '名字可以拖很久但终究要给同好会一个归处', skill: 'archive'},
  { name: '一具躯壳', grade: '二年级', role: '朴素民间同好会代表', tags: ['主持', '组织'], heat: 60, fatigue: 11, trust: 44, growth: 38, trait: '名字朴素一点也没关系能让大家找到地方就好', skill: 'ice'},
];

// === 用户追加 SSR (2) ===
const userSSR = [
  { name: '时月照笛', grade: '三年级', role: '核心作者 / 外联中枢 / 人才发现', tags: ['外联', '文案', '组织', '宣传'], heat: 84, fatigue: 15, trust: 58, growth: 64, trait: '樱缘星华，发现每个人的光芒', skill: 'star_diplomacy',
    passive: [
      { trigger: { type: 'onActionComplete', actionTags: ['招新', '茶会'] }, effect: { common: { newcomer: 3 }, member: { growth: 4 } }, desc: '发现人才潜力' },
      { trigger: { type: 'onActionComplete', actionTags: ['联动', '外联'] }, effect: { res: { relations: 3 } }, desc: '姊妹校外交加成' },
    ],
    weakness: { condition: { stat: 'total', op: 'gt', val: 250 }, effect: { res: { pressure: 4 } }, desc: '同好会规模过大时组织难度上升' } },
  { name: '欧啊比', grade: '二年级', role: '姊妹同好会桥梁 / 运营达人 / 对外交流', tags: ['外联', '组织', '宣传', '主持'], heat: 86, fatigue: 13, trust: 60, growth: 58, trait: '格子衫配lcyee，走到哪都被大家喜欢', skill: 'sister_bond',
    passive: [
      { trigger: { type: 'onActionComplete', actionTags: ['联动', '展会'] }, effect: { res: { relations: 5, fame: 4 } }, desc: '运营与联动力翻倍' },
      { trigger: { type: 'onActionComplete', actionTags: ['茶会', '团建'] }, effect: { common: { mood: 6 } }, desc: '人缘好气氛佳' },
    ],
    weakness: { condition: { stat: 'actionCat', op: 'is', val: '校内' }, effect: { stats: { exec: -3 } }, desc: '对校内事务投入相对不足' } },
];

const aptitudeActionsByTag = {
  '宣传': ['campus_wall', 'fresh_poster', 'mascot_goods', 'platform'],
  '文案': ['campus_wall', 'seminar', 'magazine', 'funding'],
  '绘图': ['fresh_poster', 'mascot_goods', 'magazine', 'vn'],
  '摊位': ['fresh_poster', 'booth'],
  '主持': ['regular_meeting', 'tea', 'seminar', 'online_game'],
  '组织': ['regular_meeting', 'tea', 'joint', 'booth', 'funding', 'handover'],
  '排版': ['mascot_goods', 'magazine'],
  '校对': ['seminar', 'magazine', 'handover'],
  '日语': ['seminar', 'magazine'],
  '脚本': ['vn', 'seminar'],
  '音乐': ['vn', 'online_game'],
  '前端': ['vn', 'platform'],
  '资料整理': ['platform', 'handover', 'funding'],
  '外联': ['joint', 'booth', 'funding'],
  '翻译': ['seminar', 'magazine', 'joint'],
  '休整': ['rest'],
};

const actionIds = [
  'campus_wall', 'fresh_poster', 'regular_meeting', 'tea', 'seminar',
  'online_game', 'mascot_goods', 'magazine', 'joint', 'booth', 'vn',
  'platform', 'handover', 'funding', 'rest',
];

function addAptitudes(member) {
  const scores = Object.fromEntries(actionIds.map((id) => [id, 34]));
  member.tags.forEach((tag, tagIndex) => {
    (aptitudeActionsByTag[tag] || []).forEach((id) => {
      scores[id] += tagIndex === 0 ? 28 : tagIndex === 1 ? 22 : 16;
    });
  });
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  ranked.forEach(([id, value], index) => {
    scores[id] = Math.min(96, value + (index === 0 ? 18 : index === 1 ? 8 : 0));
  });
  scores[ranked[0][0]] = Math.max(88, scores[ranked[0][0]]);
  if (['ice', 'taoyuan_meet', 'music_director', 'star_matsuri', 'flower_fes'].includes(member.skill)) {
    scores.online_game = Math.max(88, scores.online_game);
  }
  scores.rest = Math.max(scores.rest, 48 + Math.round((100 - member.fatigue) * 0.12));
  return { ...member, aptitudes: scores };
}

// === 组装 ===
const rawCoreSeed = [
  ...legacy.filter(m => ['老会长', '杏子', '液泡眼', '花田', '白纸', '北窗'].includes(m.name)),
  ...japanSSR,
  ...cnSSR.slice(0, 2),
  ...userSSR,
];

const rawRecruitPool = [
  ...legacy.filter(m => !['老会长', '杏子', '液泡眼', '花田', '白纸', '北窗'].includes(m.name)),
  ...cnSSR.slice(2),
  ...cnSR,
  ...cnR,
];

export const coreSeed = rawCoreSeed.map(addAptitudes);
export const recruitPool = rawRecruitPool.map(addAptitudes);
export const allMembers = [...coreSeed, ...recruitPool];
