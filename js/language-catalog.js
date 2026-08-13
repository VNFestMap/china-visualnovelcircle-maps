(function () {
  'use strict';

  var zh = {
    'common.chinese': '简体中文',
    'common.japanese': '日本語',
    'common.save': '保存',
    'common.cancel': '取消',
    'common.retry': '重新加载',
    'common.loading': '加载中…',
    'common.saving': '保存中…',
    'common.saved': '已保存',
    'common.close': '关闭',
    'common.confirm': '确认',
    'common.delete': '删除',
    'common.edit': '编辑',
    'common.view': '查看',
    'common.back': '返回',
    'common.search': '搜索',
    'common.empty': '暂无数据',
    'navigation.overview': '总览',
    'navigation.account': '账户',
    'navigation.preferences': '偏好设置',
    'navigation.clubs': '同好会',
    'navigation.notifications': '通知',
    'preferences.title': '偏好设置',
    'preferences.browserOnly': '主题、地图操作和壁纸保存在当前浏览器；语言偏好会跟随账号同步。',
    'preferences.language.title': '语言',
    'preferences.language.description': '选择网站界面语言。该设置会保存到账号并同步到其他设备。',
    'preferences.language.current': '当前语言：{language}',
    'preferences.language.saved': '语言设置已保存',
    'preferences.language.saveFailed': '语言设置保存失败，已恢复之前的选择。',
    'preferences.appearance.title': '外观',
    'preferences.map.title': '地图操作',
    'preferences.wallpaper.title': '壁纸',
    'errors.unknown': '操作失败，请稍后重试。',
    'errors.invalidLanguage': '语言设置无效。',
    'errors.loginRequired': '请先登录后再修改语言。',
    'errors.saveLanguage': '语言设置保存失败，请稍后重试。'
  };

  var ja = {
    'common.chinese': '簡体字中国語',
    'common.japanese': '日本語',
    'common.save': '保存',
    'common.cancel': '取消',
    'common.retry': '再読込',
    'common.loading': '読込中…',
    'common.saving': '保存中…',
    'common.saved': '保存済み',
    'common.close': '閉じる',
    'common.confirm': '確認',
    'common.delete': '削除',
    'common.edit': '編集',
    'common.view': '表示',
    'common.back': '戻る',
    'common.search': '検索',
    'common.empty': 'データはありません',
    'navigation.overview': '概要',
    'navigation.account': 'アカウント',
    'navigation.preferences': '環境設定',
    'navigation.clubs': '同好会',
    'navigation.notifications': '通知',
    'preferences.title': '環境設定',
    'preferences.browserOnly': 'テーマ、地図操作、壁紙は現在のブラウザに保存され、言語はアカウント間で同期されます。',
    'preferences.language.title': '言語',
    'preferences.language.description': 'サイトの表示言語を選択します。設定はアカウントに保存され、他の端末にも同期されます。',
    'preferences.language.current': '現在の言語：{language}',
    'preferences.language.saved': '言語設定を保存しました',
    'preferences.language.saveFailed': '言語設定を保存できなかったため、直前の選択に戻しました。',
    'preferences.appearance.title': '外観',
    'preferences.map.title': '地図操作',
    'preferences.wallpaper.title': '壁紙',
    'errors.unknown': '操作に失敗しました。時間を置いて再度お試しください。',
    'errors.invalidLanguage': '言語設定が無効です。',
    'errors.loginRequired': '言語を変更するにはログインが必要です。',
    'errors.saveLanguage': '言語設定を保存できませんでした。時間を置いて再度お試しください。'
  };

  var zhApi = {
    '仅支持 POST 请求': '仅支持 POST 请求',
    '语言设置无效': '语言设置无效',
    '语言设置保存失败': '语言设置保存失败',
    '请先登录': '请先登录',
    '权限不足': '权限不足',
    '登录成功': '登录成功',
    '已退出登录': '已退出登录'
  };

  var jaApi = {
    '仅支持 POST 请求': 'POST リクエストのみ対応しています。',
    '语言设置无效': '言語設定が無効です。',
    '语言设置保存失败': '言語設定を保存できませんでした。',
    '请先登录': 'ログインが必要です。',
    '权限不足': '権限がありません。',
    '登录成功': 'ログインしました。',
    '已退出登录': 'ログアウトしました。'
  };

  function register() {
    if (!window.VNFLanguage || typeof window.VNFLanguage.register !== 'function') return;
    window.VNFLanguage.register('zh', zh, zhApi);
    window.VNFLanguage.register('ja', ja, jaApi);
  }

  register();
  window.addEventListener('vnfest:language-runtime-ready', register, { once: true });
})();
