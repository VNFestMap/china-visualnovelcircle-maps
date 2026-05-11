<!-- admin_events.php - 管理员审核活动页面 -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>活动审核 - 管理后台</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 2px solid #e0e0e0;
        }
        
        h1 {
            color: #333;
            font-size: 24px;
        }
        
        .login-form {
            background: white;
            padding: 24px;
            border-radius: 16px;
            max-width: 400px;
            margin: 100px auto;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .login-form input {
            width: 100%;
            padding: 12px;
            margin-bottom: 16px;
            border: 1px solid #ddd;
            border-radius: 8px;
        }
        
        .login-form button {
            width: 100%;
            padding: 12px;
            background: #e74c3c;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
        }
        
        .tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
        }
        
        .tab-btn {
            padding: 10px 20px;
            background: #e0e0e0;
            border: none;
            border-radius: 8px;
            cursor: pointer;
        }
        
        .tab-btn.active {
            background: #e74c3c;
            color: white;
        }
        
        .submissions-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        
        .submission-card {
            background: white;
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-left: 4px solid #f39c12;
        }
        
        .submission-card.approved {
            border-left-color: #27ae60;
        }
        
        .submission-card.rejected {
            border-left-color: #e74c3c;
            opacity: 0.7;
        }
        
        .submission-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            flex-wrap: wrap;
            gap: 8px;
        }
        
        .event-name {
            font-size: 18px;
            font-weight: 700;
            color: #333;
        }
        
        .status-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
        }
        
        .status-pending {
            background: #f39c12;
            color: white;
        }
        
        .status-approved {
            background: #27ae60;
            color: white;
        }
        
        .status-rejected {
            background: #e74c3c;
            color: white;
        }
        
        .submission-details {
            margin: 12px 0;
            padding: 12px;
            background: #f8f8f8;
            border-radius: 8px;
        }
        
        .detail-row {
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .detail-label {
            font-weight: 600;
            color: #666;
            min-width: 80px;
            display: inline-block;
        }
        
        .action-buttons {
            display: flex;
            gap: 12px;
            margin-top: 16px;
        }
        
        .btn-approve {
            background: #27ae60;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
        }
        
        .btn-reject {
            background: #e74c3c;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
        }
        
        .empty-text {
            text-align: center;
            padding: 40px;
            color: #999;
        }
        
        .refresh-btn {
            background: #3498db;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="container" id="app">
        <div class="header">
            <h1>📋 活动审核管理</h1>
            <button class="refresh-btn" onclick="loadSubmissions()">🔄 刷新</button>
        </div>
        
        <div class="tabs">
            <button class="tab-btn active" data-tab="pending">待审核</button>
            <button class="tab-btn" data-tab="approved">已通过</button>
            <button class="tab-btn" data-tab="rejected">已拒绝</button>
        </div>
        
        <div id="submissionsList" class="submissions-list">
            <div class="empty-text">加载中...</div>
        </div>
    </div>
    
    <script>
        let submissions = [];
        let currentTab = 'pending';

        // 检查管理员登录（session 认证）
        async function checkAuth() {
            try {
                const resp = await fetch('../api/auth.php?action=me', { credentials: 'same-origin' });
                const data = await resp.json();
                if (!data.logged_in) {
                    window.location.href = '../index.html?need_login=1';
                    return false;
                }
                const roleLevel = { visitor: 0, member: 1, manager: 2, representative: 3, super_admin: 4 };
                if ((roleLevel[data.user.role] ?? -1) < 2) {
                    alert('权限不足');
                    window.location.href = '../index.html';
                    return false;
                }
                return true;
            } catch {
                window.location.href = '../index.html';
                return false;
            }
        }
        
        // 加载提交记录
        async function loadSubmissions() {
            try {
                const response = await fetch('../data/submissions_event.json?t=' + Date.now());
                if (response.ok) {
                    submissions = await response.json();
                } else {
                    submissions = [];
                }
            } catch (e) {
                console.error('加载失败:', e);
                submissions = [];
            }
            renderList();
        }
        
        // 保存提交记录
        async function saveSubmissions() {
            try {
                await fetch('../api/submit_event.php?action=save', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(submissions)
                });
            } catch (e) {
                console.error('保存失败:', e);
            }
        }
        
        // 审核通过
        async function approveSubmission(id) {
            const index = submissions.findIndex(s => s.id === id);
            if (index !== -1) {
                submissions[index].status = 'approved';
                await saveSubmissions();
                
                // 同时添加到正式活动列表
                const eventData = {
                    id: submissions[index].id,
                    event: submissions[index].event,
                    date: submissions[index].date,
                    image: submissions[index].image || '',
                    raw_text: submissions[index].clubName + (submissions[index].location ? ' @ ' + submissions[index].location : ''),
                    offical: 0,
                    description: submissions[index].description,
                    link: submissions[index].link || ''
                };
                
                // 调用正式活动API（使用 action=add 追加，避免覆盖已有活动）
                await fetch('../api/events.php?action=add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(eventData)
                });
                
                loadSubmissions();
            }
        }
        
        // 拒绝
        async function rejectSubmission(id) {
            if (!confirm('确定拒绝这个活动吗？')) return;
            const index = submissions.findIndex(s => s.id === id);
            if (index !== -1) {
                submissions[index].status = 'rejected';
                await saveSubmissions();
                loadSubmissions();
            }
        }
        
        // 删除
        async function deleteSubmission(id) {
            if (!confirm('确定删除这条记录吗？')) return;
            submissions = submissions.filter(s => s.id !== id);
            await saveSubmissions();
            loadSubmissions();
        }
        
        // 渲染列表
        function renderList() {
            const filtered = submissions.filter(s => s.status === currentTab);
            const container = document.getElementById('submissionsList');
            
            if (filtered.length === 0) {
                container.innerHTML = '<div class="empty-text">暂无记录</div>';
                return;
            }
            
            container.innerHTML = filtered.map(item => `
                <div class="submission-card ${item.status}">
                    <div class="submission-header">
                        <span class="event-name">${escapeHtml(item.event)}</span>
                        <span class="status-badge status-${item.status}">
                            ${item.status === 'pending' ? '待审核' : (item.status === 'approved' ? '已通过' : '已拒绝')}
                        </span>
                    </div>
                    <div class="submission-details">
                        <div class="detail-row">
                            <span class="detail-label">📅 日期：</span>${escapeHtml(item.date)}
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">🏫 主办：</span>${escapeHtml(item.clubName)}
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">📍 地点：</span>${escapeHtml(item.location || '未填写')}
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">🔗 链接：</span>
                            ${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank">${escapeHtml(item.link)}</a>` : '未填写'}
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">📝 简介：</span><br>${escapeHtml(item.description)}
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">📧 提交者：</span>${escapeHtml(item.submitter || '匿名')}
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">⏰ 提交时间：</span>${escapeHtml(item.submitted_at || '')}
                        </div>
                    </div>
                    <div class="action-buttons">
                        ${item.status === 'pending' ? `
                            <button class="btn-approve" onclick="approveSubmission(${item.id})">✓ 通过</button>
                            <button class="btn-reject" onclick="rejectSubmission(${item.id})">✗ 拒绝</button>
                        ` : ''}
                        <button class="btn-reject" onclick="deleteSubmission(${item.id})">🗑️ 删除</button>
                    </div>
                </div>
            `).join('');
        }
        
        function escapeHtml(str) {
            if (!str) return '';
            return String(str).replace(/[&<>]/g, function(m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
        }
        
        // 切换标签
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentTab = btn.dataset.tab;
                renderList();
            });
        });
        
        // 初始化
        (async () => {
            if (await checkAuth()) {
                loadSubmissions();
            }
        })();
    </script>
</body>
</html>