(function () {
  'use strict';

  var $ = $vote;
  var esc = escVote;
  var api = apiVote;
  var toast = function (message) { toastVote($('toast'), message); };

  var STAGE_LABELS = {
    bracket: '淘汰赛',
    final: '决赛'
  };
  var STATUS_LABELS = {
    pending: '待开始',
    open: '投票中',
    locked: '已锁定',
    reviewing: '待裁定',
    settled: '已结算'
  };

  var STATE = {
    projectId: 0,
    project: null,
    stages: [],
    stageBundles: {},
    currentStageId: 0,
    userSelectedStage: false,
    pollTimer: null,
    view: {
      zoom: 1,
      minZoom: 0.56,
      maxZoom: 1.7,
      panX: 0,
      panY: 0,
      ready: false,
      dragging: false,
      moved: false,
      startX: 0,
      startY: 0,
      startPanX: 0,
      startPanY: 0
    }
  };

  function projectIdFromUrl() {
    var params = new URLSearchParams(window.location.search);
    return Number(params.get('project_id') || params.get('id') || params.get('contest_id') || 0);
  }

  function stageLabel(stage) {
    if (!stage) return '对阵阶段';
    return stage.title || STAGE_LABELS[stage.stage_type] || stage.stage_type || '对阵阶段';
  }

  function statusLabel(status) {
    return STATUS_LABELS[status] || status || '未知';
  }

  function matchHasBothSlots(match) {
    return Number(match.slot_a_entry_id || 0) > 0 && Number(match.slot_b_entry_id || 0) > 0;
  }

  function displayName(match, side) {
    var prefix = side === 'a' ? 'slot_a' : 'slot_b';
    return match[prefix + '_title_cn'] || match[prefix + '_title'] || '待定';
  }

  function displayImage(match, side) {
    var prefix = side === 'a' ? 'slot_a' : 'slot_b';
    return match[prefix + '_image'] || '';
  }

  function entryId(match, side) {
    return Number(match[side === 'a' ? 'slot_a_entry_id' : 'slot_b_entry_id'] || 0);
  }

  function entrySideForMatch(match, entryId) {
    if (Number(match.slot_a_entry_id || 0) === Number(entryId || 0)) return 'a';
    if (Number(match.slot_b_entry_id || 0) === Number(entryId || 0)) return 'b';
    return '';
  }

  function slotInfo(match, side) {
    if (!match || !side) return null;
    return {
      id: entryId(match, side),
      name: displayName(match, side),
      image: displayImage(match, side)
    };
  }

  function mergeMatchStats(matches, stats) {
    var map = {};
    (stats || []).forEach(function (row) {
      map[Number(row.id)] = row;
    });
    return (matches || []).map(function (match) {
      var copy = Object.assign({}, match);
      var stat = map[Number(match.id)];
      if (stat) {
        if (Object.prototype.hasOwnProperty.call(stat, 'slot_a_votes')) copy.slot_a_votes = Number(stat.slot_a_votes || 0);
        if (Object.prototype.hasOwnProperty.call(stat, 'slot_b_votes')) copy.slot_b_votes = Number(stat.slot_b_votes || 0);
        if (Object.prototype.hasOwnProperty.call(stat, 'total_votes')) copy.total_votes = Number(stat.total_votes || 0);
        if (Object.prototype.hasOwnProperty.call(stat, 'winner_entry_id')) copy.winner_entry_id = Number(stat.winner_entry_id || 0);
        if (Object.prototype.hasOwnProperty.call(stat, 'winner_title')) copy.winner_title = stat.winner_title;
        if (Object.prototype.hasOwnProperty.call(stat, 'winner_title_cn')) copy.winner_title_cn = stat.winner_title_cn;
      }
      return copy;
    });
  }

  function loadMatches(stage) {
    return api('../api/moe_matches.php?action=list&stage_id=' + encodeURIComponent(stage.id)).then(function (data) {
      if (!data || !data.success) throw new Error((data && data.message) || '对阵加载失败');
      return data.data || [];
    });
  }

  function loadResults(stage) {
    return api('../api/moe_votes.php?action=results&stage_id=' + encodeURIComponent(stage.id)).then(function (data) {
      if (!data || !data.success) return { data: [], match_results: [], rank_visible: false, metrics_visible: false };
      return data;
    }).catch(function () {
      return { data: [], match_results: [], rank_visible: false, metrics_visible: false };
    });
  }

  function sortStages(stages) {
    return stages.slice().sort(function (a, b) {
      var ao = Number(a.sort_order || 0);
      var bo = Number(b.sort_order || 0);
      if (ao !== bo) return ao - bo;
      return Number(a.id || 0) - Number(b.id || 0);
    });
  }

  function chooseStage(candidates, bundles) {
    if (STATE.userSelectedStage && STATE.currentStageId) {
      var selected = candidates.find(function (stage) { return Number(stage.id) === Number(STATE.currentStageId); });
      if (selected) return selected;
    }
    var open = candidates.find(function (stage) { return stage.status === 'open'; });
    if (open) return open;
    var reviewing = candidates.find(function (stage) { return stage.status === 'reviewing'; });
    if (reviewing) return reviewing;
    for (var i = candidates.length - 1; i >= 0; i--) {
      var bundle = bundles[Number(candidates[i].id)];
      if (bundle && bundle.matches && bundle.matches.length) return candidates[i];
    }
    return candidates[candidates.length - 1] || null;
  }

  function loadAllData() {
    if (!STATE.projectId) {
      renderMissingId();
      return Promise.resolve();
    }

    setStatus('<span class="mb-pill">加载中</span>');
    return Promise.all([
      api('../api/moe_contests.php?action=get&project_id=' + encodeURIComponent(STATE.projectId)),
      api('../api/moe_stages.php?action=list&project_id=' + encodeURIComponent(STATE.projectId))
    ]).then(function (responses) {
      var projectResponse = responses[0] || {};
      var stagesResponse = responses[1] || {};
      if (!projectResponse.success || !projectResponse.data) throw new Error(projectResponse.message || '活动不存在');
      STATE.project = projectResponse.data;
      STATE.stages = sortStages((stagesResponse && stagesResponse.data) || []).filter(function (stage) {
        return stage.stage_type === 'bracket' || stage.stage_type === 'final';
      });
      updateChrome();

      if (!STATE.stages.length) {
        STATE.stageBundles = {};
        STATE.currentStageId = 0;
        renderStageTabs();
        renderNoStage();
        return;
      }

      return Promise.all(STATE.stages.map(function (stage) {
        return loadMatches(stage).then(function (matches) {
          return { stage: stage, matches: matches };
        }).catch(function () {
          return { stage: stage, matches: [] };
        });
      })).then(function (bundles) {
        var map = {};
        bundles.forEach(function (bundle) {
          map[Number(bundle.stage.id)] = {
            stage: bundle.stage,
            matches: bundle.matches,
            result: null
          };
        });
        STATE.stageBundles = map;
        var chosen = chooseStage(STATE.stages, map);
        STATE.currentStageId = chosen ? Number(chosen.id) : 0;
        renderStageTabs();
        if (!chosen) {
          renderNoStage();
          return;
        }
        return loadCurrentStageResult();
      });
    }).catch(function (error) {
      renderError(error.message || '加载失败');
    });
  }

  function loadCurrentStageResult() {
    var bundle = STATE.stageBundles[Number(STATE.currentStageId)];
    if (!bundle) {
      renderNoStage();
      return Promise.resolve();
    }
    return loadResults(bundle.stage).then(function (result) {
      bundle.result = result;
      bundle.matches = mergeMatchStats(bundle.matches, result.match_results || []);
      renderBracket(bundle.stage, bundle.matches, result);
    });
  }

  function updateChrome() {
    var title = STATE.project ? STATE.project.title : '萌战实时赛程';
    $('mbPageTitle').textContent = title || '萌战实时赛程';
    $('mbPageSub').textContent = '实时观察淘汰赛、决赛与结算状态';
    $('mbBackLink').href = 'contest.html?id=' + encodeURIComponent(STATE.projectId);
    $('mbContestLink').href = 'contest.html?id=' + encodeURIComponent(STATE.projectId);
    if (window.ActivityTheme && STATE.project) {
      window.ActivityTheme.applyContestWallpaper(STATE.project, 0.34);
    }
  }

  function updateStageHeader(stage, matches, bracketSize) {
    var title = STATE.project && STATE.project.title ? STATE.project.title : '萌战活动';
    if (!stage) {
      $('mbPageTitle').textContent = title;
      $('mbPageSub').textContent = '等待负责人生成对阵';
      return;
    }
    if (stage.stage_type === 'final') {
      $('mbPageTitle').textContent = title + ' · 萌王决赛对阵表';
      $('mbPageSub').textContent = '冠军赛与季军赛独立展示，结果按后端结算状态公开。';
      return;
    }
    $('mbPageTitle').textContent = title + ' · ' + Number(bracketSize || 0) + ' 强正赛对阵表';
    $('mbPageSub').textContent = '左右半区镜像对阵，胜者向中心晋级。';
  }

  function renderStageTabs() {
    var wrap = $('mbStageTabs');
    wrap.innerHTML = '';
    if (!STATE.stages.length) return;
    STATE.stages.forEach(function (stage) {
      var bundle = STATE.stageBundles[Number(stage.id)] || { matches: [] };
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mb-stage-tab' + (Number(stage.id) === Number(STATE.currentStageId) ? ' active' : '');
      btn.textContent = stageLabel(stage) + ' · ' + statusLabel(stage.status) + ' · ' + Number((bundle.matches || []).length) + '场';
      btn.addEventListener('click', function () {
        STATE.userSelectedStage = true;
        STATE.currentStageId = Number(stage.id);
        renderStageTabs();
        loadCurrentStageResult();
      });
      wrap.appendChild(btn);
    });
  }

  function setStatus(html) {
    $('mbStatusStrip').innerHTML = html;
  }

  function renderStatus(stage, matches, result, bracketSize) {
    var visibility = (result && result.result_visibility) || stage.result_visibility || 'live_rank_only';
    var rankVisible = !!(result && result.rank_visible);
    var metricsVisible = !!(result && result.metrics_visible);
    var help = stage.stage_type === 'final'
      ? '决赛阶段展示冠军争夺战与季军争夺战，结算后显示最终名次。'
      : '淘汰赛按左右半区推进，中间展示通往决赛阶段的席位。';
    var html =
      '<span class="mb-pill">' + esc(STAGE_LABELS[stage.stage_type] || stage.stage_type) + '</span>' +
      '<span class="mb-pill ' + esc(stage.status || '') + '">' + esc(statusLabel(stage.status)) + '</span>' +
      '<span class="mb-pill">' + Number(bracketSize || 0) + '强</span>' +
      '<span class="mb-pill">对阵 ' + Number((matches || []).length) + ' 场</span>' +
      '<span class="mb-pill">' + esc(visibility) + '</span>' +
      '<span class="mb-pill" id="mbPollStatus">自动刷新 30s</span>' +
      '<div class="mb-status-copy">' + esc(help) + ' 排名' + (rankVisible ? '已公开' : '未公开') + '，票数' + (metricsVisible ? '已公开' : '未公开') + '。</div>';
    setStatus(html);
  }

  function renderMissingId() {
    $('mbPageTitle').textContent = '缺少活动 ID';
    $('mbPageSub').textContent = '请从萌战活动详情页进入实时对阵表';
    setStatus('<span class="mb-pill error">缺少 project_id</span>');
    renderBoardEmpty('缺少活动 ID');
  }

  function renderNoStage() {
    setStatus('<span class="mb-pill">等待对阵阶段</span><div class="mb-status-copy">当前活动还没有淘汰赛或决赛阶段。</div>');
    renderBoardEmpty('还没有 1v1 对阵阶段');
  }

  function renderError(message) {
    setStatus('<span class="mb-pill error">加载失败</span><div class="mb-status-copy">' + esc(message) + '</div>');
    renderBoardEmpty('加载失败');
    toast(message);
  }

  function renderBoardEmpty(message) {
    var board = $('mbBracketBoard');
    board.className = 'mb-bracket-board final-only';
    board.innerHTML = '<div class="mb-empty">' + esc(message) + '</div>';
    centerView(true);
  }

  function groupByRound(matches) {
    var grouped = {};
    (matches || []).forEach(function (match) {
      var round = Number(match.round_no || 1);
      if (!grouped[round]) grouped[round] = [];
      grouped[round].push(match);
    });
    Object.keys(grouped).forEach(function (round) {
      grouped[round].sort(function (a, b) { return Number(a.match_no || 0) - Number(b.match_no || 0); });
    });
    return grouped;
  }

  function maxRound(matches) {
    var max = 1;
    (matches || []).forEach(function (match) {
      max = Math.max(max, Number(match.round_no || 1));
    });
    return max;
  }

  function roundCountFromSize(bracketSize) {
    var size = Math.max(4, Number(bracketSize || 4));
    return Math.max(2, Math.ceil(Math.log(size) / Math.log(2)) - 1);
  }

  function expectedSideMatches(roundNo, bracketSize) {
    var size = Math.max(4, Number(bracketSize || 4));
    return Math.max(1, Math.floor(size / Math.pow(2, Number(roundNo || 1) + 1)));
  }

  function bracketSizeFromMatches(stage, matches) {
    if (stage.stage_type === 'final') return 4;
    var firstRound = (matches || []).filter(function (match) { return Number(match.round_no || 1) === 1; });
    if (firstRound.length) return firstRound.length * 2;
    var config = parseConfigVote(stage.config_json);
    return Number(config.bracket_size || 0) || 2;
  }

  function roundLabel(roundNo, bracketSize, stageType) {
    if (stageType === 'final') return '决赛';
    var size = Math.max(2, Math.floor(Number(bracketSize || 2) / Math.pow(2, Math.max(0, Number(roundNo || 1) - 1))));
    if (size === 4) return '半决赛';
    if (size === 2) return '决赛席位';
    return size + '强';
  }

  function splitRound(grouped, roundNo, side, bracketSize) {
    var matches = (grouped[roundNo] || []).slice();
    var expected = expectedSideMatches(roundNo, bracketSize);
    var sideMatches = side === 'left' ? matches.slice(0, expected) : matches.slice(expected, expected * 2);
    while (sideMatches.length < expected) sideMatches.push(null);
    return sideMatches;
  }

  function renderSlot(match, side, result) {
    var id = entryId(match, side);
    var winnerId = Number(match.winner_entry_id || 0);
    var canShowWinner = !!(result && result.rank_visible);
    var isWinner = canShowWinner && id > 0 && winnerId > 0 && id === winnerId;
    var image = displayImage(match, side);
    var votes = '';
    if (result && result.metrics_visible && Object.prototype.hasOwnProperty.call(match, side === 'a' ? 'slot_a_votes' : 'slot_b_votes')) {
      votes = Number(match[side === 'a' ? 'slot_a_votes' : 'slot_b_votes'] || 0) + '票';
    }
    var label = isWinner ? '晋级' : (votes || (id ? '' : '待定'));
    return '<div class="mb-slot' + (isWinner ? ' winner' : '') + (!canShowWinner && winnerId ? ' hidden-winner' : '') + '">' +
      '<span class="mb-avatar">' + (image ? '<img src="' + esc(image) + '" alt="">' : '人') + '</span>' +
      '<span class="mb-name">' + esc(displayName(match, side)) + '</span>' +
      '<span class="mb-slot-state">' + esc(label) + '</span>' +
      '</div>';
  }

  function renderMatch(match, index, result) {
    if (!match) {
      return '<article class="mb-match-card pending"><div class="mb-slot"><span class="mb-avatar">人</span><span class="mb-name">待定</span><span class="mb-slot-state">待定</span></div><div class="mb-slot"><span class="mb-avatar">人</span><span class="mb-name">待定</span><span class="mb-slot-state">待定</span></div><div class="mb-match-meta"><span>席位 ' + Number(index || 1) + '</span><span>待定</span></div></article>';
    }
    var cls = 'mb-match-card ' + esc(match.status || 'pending') + (match.status === 'reviewing' ? ' reviewing' : '');
    return '<article class="' + cls + '" data-match-id="' + Number(match.id || 0) + '">' +
      renderSlot(match, 'a', result) +
      renderSlot(match, 'b', result) +
      '<div class="mb-match-meta"><span>R' + Number(match.round_no || 1) + ' · M' + Number(match.match_no || index || 1) + '</span><span>' + esc(statusLabel(match.status)) + '</span></div>' +
      '</article>';
  }

  function renderRoundColumn(grouped, roundNo, side, bracketSize, stage, result) {
    var matches = splitRound(grouped, roundNo, side, bracketSize);
    return '<section class="mb-round-column" data-side="' + esc(side) + '" data-round="' + Number(roundNo) + '">' +
      '<div class="mb-round-title">' + esc(roundLabel(roundNo, bracketSize, stage.stage_type)) + '</div>' +
      '<div class="mb-round-stack">' + matches.map(function (match, index) {
        return renderMatch(match, index + 1, result);
      }).join('') + '</div>' +
      '</section>';
  }

  function renderSide(grouped, side, rounds, bracketSize, stage, result) {
    var order = [];
    for (var i = 1; i <= rounds; i++) order.push(i);
    return '<div class="mb-bracket-side ' + esc(side) + '" style="--round-count:' + Number(rounds) + '">' +
      order.map(function (roundNo) { return renderRoundColumn(grouped, roundNo, side, bracketSize, stage, result); }).join('') +
      '</div>';
  }

  function winnersForRound(matches, roundNo, result) {
    var roundMatches = (matches || []).filter(function (match) {
      return Number(match.round_no || 0) === Number(roundNo || 0);
    });
    var winners = [];
    roundMatches.forEach(function (match) {
      var winnerId = Number(match.winner_entry_id || 0);
      if (winnerId > 0) {
        var side = entrySideForMatch(match, winnerId);
        var info = side ? slotInfo(match, side) : null;
        if (info && info.id > 0) winners.push(info);
      }
    });
    if (!winners.length && result && result.rank_visible) {
      winners = roundMatches.filter(function (match) {
        return Number(match.winner_entry_id || 0) > 0;
      }).map(function (match) {
        return {
          id: Number(match.winner_entry_id),
          name: match.winner_title_cn || match.winner_title || '待定',
          image: ''
        };
      });
    }
    return winners;
  }

  function losersForRound(matches, roundNo) {
    var losers = [];
    (matches || []).filter(function (match) {
      return Number(match.round_no || 0) === Number(roundNo || 0);
    }).forEach(function (match) {
      var winnerId = Number(match.winner_entry_id || 0);
      if (winnerId === 0) return;
      var winnerSide = entrySideForMatch(match, winnerId);
      var loserSide = winnerSide === 'a' ? 'b' : (winnerSide === 'b' ? 'a' : '');
      var info = loserSide ? slotInfo(match, loserSide) : null;
      if (info && info.id > 0) losers.push(info);
    });
    return losers;
  }

  function renderCenterSlot(info, label, fallback) {
    var item = info && info.id ? info : { id: 0, name: fallback || '待定', image: '' };
    var avatar = item.image
      ? '<img src="' + esc(item.image) + '" alt="">'
      : (item.id ? '人' : '?');
    return '<div class="mb-slot' + (item.id ? '' : ' pending') + '">' +
      '<span class="mb-avatar">' + avatar + '</span>' +
      '<span class="mb-name">' + esc(item.name) + '</span>' +
      '<span class="mb-slot-state">' + esc(label) + '</span>' +
      '</div>';
  }

  function renderCenter(stage, matches, rounds, result) {
    var finalists = winnersForRound(matches, rounds, result);
    var thirdPlace = losersForRound(matches, rounds);
    while (finalists.length < 2) finalists.push({ name: result && result.rank_visible ? '等待产生' : '暂未公开' });
    while (thirdPlace.length < 2) thirdPlace.push({ name: '待定' });
    var crownSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 3.3a.6.6 0 0 1 1 0l2.2 4.4 4.9.7a.6.6 0 0 1 .3 1l-3.5 3.4.8 4.8a.6.6 0 0 1-.9.6L12 15.9l-4.3 2.3a.6.6 0 0 1-.9-.6l.8-4.8-3.5-3.4a.6.6 0 0 1 .3-1l4.9-.7 2.2-4.4Z"/></svg>';
    return '<div class="mb-center-track">' +
      '<div class="mb-champion-card"><div class="mb-champion-seal">' + crownSvg + '</div><span>决赛席位</span><strong>' + esc(finalists[0].name) + ' / ' + esc(finalists[1].name) + '</strong></div>' +
      '<div class="mb-center-card" data-final-slot="1"><span class="mb-center-label">冠军争夺战</span>' + renderCenterSlot(finalists[0], '席位1') + renderCenterSlot(finalists[1], '席位2') + '</div>' +
      '<div class="mb-center-card"><span class="mb-center-label">季军赛</span>' + renderCenterSlot(thirdPlace[0], '席位3') + renderCenterSlot(thirdPlace[1], '席位4') + '</div>' +
      '</div>';
  }

  function championFromRows(rows) {
    var sorted = (rows || []).slice().sort(function (a, b) {
      return Number(a.rank_no || 9999) - Number(b.rank_no || 9999);
    });
    return sorted[0] || null;
  }

  function renderFinal(stage, matches, result) {
    var board = $('mbBracketBoard');
    var champion = result && result.rank_visible ? championFromRows(result.data || []) : null;
    var championName = champion ? (champion.title_cn || champion.title || '萌王') : (result && result.rank_visible ? '等待决赛结算' : '暂未公开');
    var finalMatch = matches[0] || null;
    var thirdMatch = matches[1] || null;
    var crownSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 3.3a.6.6 0 0 1 1 0l2.2 4.4 4.9.7a.6.6 0 0 1 .3 1l-3.5 3.4.8 4.8a.6.6 0 0 1-.9.6L12 15.9l-4.3 2.3a.6.6 0 0 1-.9-.6l.8-4.8-3.5-3.4a.6.6 0 0 1 .3-1l4.9-.7 2.2-4.4Z"/></svg>';
    board.className = 'mb-bracket-board final-only';
    board.innerHTML = '<div class="mb-center-track">' +
      '<div class="mb-champion-card"><div class="mb-champion-seal">' + crownSvg + '</div><span>萌王</span><strong>' + esc(championName) + '</strong></div>' +
      '<div class="mb-center-card"><span class="mb-center-label">冠军争夺战</span>' + renderMatch(finalMatch, 1, result) + '</div>' +
      '<div class="mb-center-card"><span class="mb-center-label">季军赛</span>' + renderMatch(thirdMatch, 2, result) + '</div>' +
      '</div>';
    centerView(true);
  }

  function renderBracket(stage, matches, result) {
    var bracketSize = bracketSizeFromMatches(stage, matches);
    updateStageHeader(stage, matches, bracketSize);
    renderStatus(stage, matches, result, bracketSize);
    if (!matches.length) {
      renderBoardEmpty('对阵尚未生成');
      return;
    }
    if (stage.stage_type === 'final') {
      renderFinal(stage, matches, result);
      return;
    }

    var grouped = groupByRound(matches);
    var rounds = Math.max(maxRound(matches), roundCountFromSize(bracketSize));
    var board = $('mbBracketBoard');
    board.className = 'mb-bracket-board';
    board.style.setProperty('--round-count', rounds);
    applyBoardLayout(rounds, bracketSize);
    board.innerHTML =
      renderSide(grouped, 'left', rounds, bracketSize, stage, result) +
      renderCenter(stage, matches, rounds, result) +
      renderSide(grouped, 'right', rounds, bracketSize, stage, result);
    syncViewAfterRender(!STATE.view.ready);
    requestAnimationFrame(drawConnectors);
  }

  function applyBoardLayout(rounds, bracketSize) {
    var board = $('mbBracketBoard');
    var roundMin = 168;
    var gap = 12;
    var centerMin = 232;
    var sideMin = rounds * roundMin + Math.max(0, rounds - 1) * gap;
    var total = sideMin * 2 + centerMin + gap * 2 + 28;
    var available = Math.max(320, $('mbBoardViewport').clientWidth);
    var minScale = window.innerWidth < 900 ? 0.68 : 0.82;
    var maxScale = window.innerWidth < 900 ? 0.9 : 1.08;
    var scale = Math.max(minScale, Math.min(maxScale, available / total));
    var scaledRound = Math.round(roundMin * scale);
    var scaledGap = Math.round(gap * scale);
    var scaledCenter = Math.round(centerMin * scale);
    var scaledSide = rounds * scaledRound + Math.max(0, rounds - 1) * scaledGap;
    var scaledTotal = scaledSide * 2 + scaledCenter + scaledGap * 2 + 28;
    board.style.setProperty('--mb-round-min', scaledRound + 'px');
    board.style.setProperty('--mb-center-min', scaledCenter + 'px');
    board.style.setProperty('--mb-gap', scaledGap + 'px');
    board.style.gridTemplateColumns = 'minmax(' + scaledSide + 'px,1fr) minmax(' + scaledCenter + 'px,.42fr) minmax(' + scaledSide + 'px,1fr)';
    board.style.minWidth = scaledTotal + 'px';
    board.style.minHeight = Math.max(540, Math.ceil(bracketSize / 2) * 54) + 'px';
  }

  function drawConnectors() {
    var board = $('mbBracketBoard');
    if (!board || board.classList.contains('final-only')) return;
    var old = board.querySelector('.mb-bracket-lines');
    if (old) old.remove();
    var boardRect = board.getBoundingClientRect();
    var paths = [];
    ['left', 'right'].forEach(function (side) {
      var columns = Array.prototype.slice.call(board.querySelectorAll('.mb-round-column[data-side="' + side + '"]'));
      for (var i = 0; i < columns.length - 1; i++) {
        var current = Array.prototype.slice.call(columns[i].querySelectorAll('.mb-match-card'));
        var next = Array.prototype.slice.call(columns[i + 1].querySelectorAll('.mb-match-card'));
        next.forEach(function (target, targetIndex) {
          [current[targetIndex * 2], current[targetIndex * 2 + 1]].forEach(function (source) {
            if (!source || !target) return;
            var from = connectorPoint(source.getBoundingClientRect(), boardRect, side);
            var to = connectorPoint(target.getBoundingClientRect(), boardRect, side === 'left' ? 'right' : 'left');
            var mid = (from.x + to.x) / 2;
            paths.push('<path class="' + esc(side) + '" d="M ' + from.x.toFixed(1) + ' ' + from.y.toFixed(1) + ' H ' + mid.toFixed(1) + ' V ' + to.y.toFixed(1) + ' H ' + to.x.toFixed(1) + '"/>');
          });
        });
      }
      var finalTarget = board.querySelector('[data-final-slot="1"]');
      var lastColumn = columns[columns.length - 1];
      if (finalTarget && lastColumn) {
        Array.prototype.slice.call(lastColumn.querySelectorAll('.mb-match-card')).forEach(function (source) {
          var from = connectorPoint(source.getBoundingClientRect(), boardRect, side);
          var to = connectorPoint(finalTarget.getBoundingClientRect(), boardRect, side === 'left' ? 'right' : 'left');
          var mid = (from.x + to.x) / 2;
          paths.push('<path class="' + esc(side) + '" d="M ' + from.x.toFixed(1) + ' ' + from.y.toFixed(1) + ' H ' + mid.toFixed(1) + ' V ' + to.y.toFixed(1) + ' H ' + to.x.toFixed(1) + '"/>');
        });
      }
    });
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'mb-bracket-lines');
    svg.setAttribute('viewBox', '0 0 ' + boardRect.width.toFixed(1) + ' ' + boardRect.height.toFixed(1));
    svg.innerHTML = paths.join('');
    board.prepend(svg);
  }

  function connectorPoint(rect, boardRect, side) {
    return {
      x: side === 'right' ? rect.left - boardRect.left : rect.right - boardRect.left,
      y: rect.top - boardRect.top + rect.height / 2
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function applyView() {
    var view = STATE.view;
    $('mbBoardCanvas').style.transform = 'translate(' + view.panX + 'px, ' + view.panY + 'px) scale(' + view.zoom + ')';
    $('mbZoomValue').textContent = Math.round(view.zoom * 100) + '%';
  }

  function clampView() {
    var viewport = $('mbBoardViewport');
    var canvas = $('mbBoardCanvas');
    var view = STATE.view;
    var vw = viewport.clientWidth;
    var vh = viewport.clientHeight;
    var cw = canvas.offsetWidth * view.zoom;
    var ch = canvas.offsetHeight * view.zoom;
    var pad = 18;
    view.panX = cw <= vw - pad * 2 ? (vw - cw) / 2 : clamp(view.panX, vw - cw - pad, pad);
    view.panY = ch <= vh - pad * 2 ? (vh - ch) / 2 : clamp(view.panY, vh - ch - pad, pad);
  }

  function centerView(resetZoom) {
    var viewport = $('mbBoardViewport');
    var canvas = $('mbBoardCanvas');
    var view = STATE.view;
    if (resetZoom) view.zoom = 1;
    view.panX = (viewport.clientWidth - canvas.offsetWidth * view.zoom) / 2;
    view.panY = (viewport.clientHeight - canvas.offsetHeight * view.zoom) / 2;
    clampView();
    canvas.style.transition = 'none';
    applyView();
    void canvas.offsetWidth;
    canvas.style.transition = '';
    view.ready = true;
  }

  function syncViewAfterRender(forceCenter) {
    requestAnimationFrame(function () {
      if (forceCenter || !STATE.view.ready) centerView(false);
      else {
        clampView();
        applyView();
      }
    });
  }

  function setZoom(nextZoom, clientX, clientY) {
    var viewport = $('mbBoardViewport');
    var rect = viewport.getBoundingClientRect();
    var view = STATE.view;
    var x = typeof clientX === 'number' ? clientX - rect.left : rect.width / 2;
    var y = typeof clientY === 'number' ? clientY - rect.top : rect.height / 2;
    var oldZoom = view.zoom;
    var newZoom = clamp(nextZoom, view.minZoom, view.maxZoom);
    var worldX = (x - view.panX) / oldZoom;
    var worldY = (y - view.panY) / oldZoom;
    view.zoom = newZoom;
    view.panX = x - worldX * newZoom;
    view.panY = y - worldY * newZoom;
    clampView();
    applyView();
  }

  function installViewControls() {
    var viewport = $('mbBoardViewport');
    viewport.addEventListener('wheel', function (event) {
      event.preventDefault();
      setZoom(STATE.view.zoom * (event.deltaY < 0 ? 1.08 : 0.92), event.clientX, event.clientY);
    }, { passive: false });

    viewport.addEventListener('pointerdown', function (event) {
      if (event.button !== 0) return;
      event.preventDefault();
      var selection = window.getSelection && window.getSelection();
      if (selection && selection.removeAllRanges) selection.removeAllRanges();
      STATE.view.dragging = true;
      STATE.view.startX = event.clientX;
      STATE.view.startY = event.clientY;
      STATE.view.startPanX = STATE.view.panX;
      STATE.view.startPanY = STATE.view.panY;
      viewport.classList.add('is-dragging');
      try { viewport.setPointerCapture(event.pointerId); } catch (_) {}
    });

    viewport.addEventListener('pointermove', function (event) {
      if (!STATE.view.dragging) return;
      STATE.view.panX = STATE.view.startPanX + event.clientX - STATE.view.startX;
      STATE.view.panY = STATE.view.startPanY + event.clientY - STATE.view.startY;
      clampView();
      applyView();
      event.preventDefault();
    });

    function endDrag(event) {
      if (!STATE.view.dragging) return;
      STATE.view.dragging = false;
      viewport.classList.remove('is-dragging');
      try { viewport.releasePointerCapture(event.pointerId); } catch (_) {}
    }

    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    $('mbZoomOut').addEventListener('click', function () { setZoom(STATE.view.zoom * 0.88); });
    $('mbZoomIn').addEventListener('click', function () { setZoom(STATE.view.zoom * 1.12); });
    $('mbZoomReset').addEventListener('click', function () { centerView(true); });

    $('mbFullscreen').addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
      else viewport.requestFullscreen().catch(function () {});
    });
    $('mbExitFullscreen').addEventListener('click', function () {
      document.exitFullscreen().catch(function () {});
    });
    document.addEventListener('fullscreenchange', function () {
      var isFullscreen = !!document.fullscreenElement;
      viewport.classList.toggle('is-fullscreen', isFullscreen);
      $('mbFullscreen').setAttribute('aria-label', isFullscreen ? '退出全屏' : '全屏展开对阵图');
      $('mbFullscreenIcon').innerHTML = isFullscreen
        ? '<path d="M8 3v3H5m14 0h-3V3M3 16h3v3m12-3h3v3"/>'
        : '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>';
      STATE.view.ready = false;
      requestAnimationFrame(function () {
        centerView(false);
        requestAnimationFrame(drawConnectors);
      });
    });
  }

  function startPolling() {
    stopPolling();
    STATE.pollTimer = setInterval(loadAllData, 30000);
  }

  function stopPolling() {
    if (STATE.pollTimer) clearInterval(STATE.pollTimer);
    STATE.pollTimer = null;
  }

  function updatePollStatus(paused) {
    var el = $('mbPollStatus');
    if (el) el.textContent = paused ? '暂停自动刷新' : '自动刷新 30s';
  }

  function init() {
    STATE.projectId = projectIdFromUrl();
    installViewControls();
    loadAllData().then(startPolling);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopPolling();
        updatePollStatus(true);
      } else {
        loadAllData().then(startPolling);
        updatePollStatus(false);
      }
    });
    window.addEventListener('resize', function () {
      if (STATE.currentStageId) loadCurrentStageResult();
      else centerView(false);
    });
  }

  init();
})();
