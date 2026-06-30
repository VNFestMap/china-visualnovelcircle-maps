export const statNames = {
  org: '组织稳定度',
  exec: '活动执行力',
  part: '成员参与度',
  content: '内容沉淀力',
  external: '外部连接力',
  succession: '传承持续力',
};

export const statShort = {
  org: '组织',
  exec: '执行',
  part: '参与',
  content: '内容',
  external: '外联',
  succession: '传承',
};

export const detailDefs = {
  org: { label: '组织稳定度', keys: ['schedule', 'division', 'finance', 'compliance'] },
  exec: { label: '活动执行力', keys: ['planning', 'materials', 'publicity', 'offline'] },
  part: { label: '成员参与度', keys: ['newcomer', 'retention', 'chat', 'review'] },
  content: { label: '内容沉淀力', keys: ['articles', 'archive', 'design', 'projectOutput'] },
  external: { label: '外部连接力', keys: ['crossTrust', 'eventLink', 'platform', 'schoolLink'] },
  succession: { label: '传承持续力', keys: ['docs', 'juniors', 'permission', 'obSupport'] },
};

export const actionDetailMap = {
  campus_wall: ['publicity', 'newcomer', 'chat'],
  fresh_poster: ['publicity', 'materials', 'offline', 'newcomer'],
  regular_meeting: ['schedule', 'division', 'chat', 'retention', 'juniors'],
  tea: ['offline', 'newcomer', 'retention', 'chat'],
  seminar: ['articles', 'review', 'chat', 'archive'],
  online_game: ['chat', 'retention', 'newcomer'],
  mascot_goods: ['design', 'materials', 'publicity', 'retention'],
  magazine: ['articles', 'archive', 'design', 'planning', 'projectOutput', 'crossTrust'],
  booth: ['eventLink', 'materials', 'publicity', 'planning', 'crossTrust'],
  joint: ['crossTrust', 'platform', 'planning', 'review'],
  platform: ['platform', 'archive', 'publicity', 'docs'],
  vn: ['projectOutput', 'design', 'planning', 'division', 'articles'],
  handover: ['docs', 'permission', 'juniors', 'obSupport', 'division'],
  funding: ['finance', 'compliance', 'archive', 'review'],
  rest: [],
};
