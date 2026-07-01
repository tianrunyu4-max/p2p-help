<template>
  <div class="hub-page">

    <!-- 顶部 -->
    <div class="hub-header">
      <div class="hub-title">AI 智能助手</div>
      <div class="hub-subtitle">家庭医生 · 彩票选号，随时随叫</div>
    </div>

    <!-- App 图标网格（两格） -->
    <div class="hub-grid">

      <!-- 🦀 养生虾 HealthX -->
      <div class="hub-app-card" @click="$router.push('/healthx')">
        <div class="hub-app-icon hx-icon">
          <img src="/healthx-avatar.jpg" class="hub-icon-img" alt="HealthX" />
        </div>
        <div class="hub-app-name">养生虾</div>
        <div class="hub-app-tag">家庭医生</div>
        <div class="hub-app-desc">养生 · 睡眠 · 健康</div>
        <div class="hub-app-badge hx-badge">🦀 HealthX</div>
      </div>

      <!-- 🎱 彩球博士 -->
      <div class="hub-app-card" @click="$router.push('/lottery-ai')">
        <div class="hub-app-icon lottery-icon">
          <span class="hub-emoji-icon">🎱</span>
        </div>
        <div class="hub-app-name">彩球博士</div>
        <div class="hub-app-tag">AI智能选号</div>
        <div class="hub-app-desc">福彩3D · 快乐8选4</div>
        <div class="hub-app-badge lottery-badge">🎱 DeepSeek</div>
      </div>

    </div>

    <!-- 使用说明 -->
    <div class="hub-diff-card">
      <div class="hub-diff-title">💡 使用方式</div>
      <div class="hub-diff-rows">
        <div class="hub-diff-row">
          <div class="hub-diff-icon health">🦀</div>
          <div class="hub-diff-body">
            <div class="hub-diff-label">@养生虾 · 家庭医生</div>
            <div class="hub-diff-desc">在社区聊天中 @养生虾 发问，或点击上方卡片进入专属对话。养生调理、睡眠、异乡健康全包。</div>
          </div>
        </div>
        <div class="hub-diff-row">
          <div class="hub-diff-icon lottery">🎱</div>
          <div class="hub-diff-body">
            <div class="hub-diff-label">@彩球 · AI智能选号</div>
            <div class="hub-diff-desc">在社区聊天中 @彩球 3D选号 / @彩球 快乐8，DeepSeek算力矩阵秒出推荐。</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 社区群聊入口 -->
    <div class="hub-community-btn" @click="$router.push('/')">
      <span class="hub-community-icon">💬</span>
      <div>
        <div class="hub-community-title">UAE Sourcing · AI Community</div>
        <div class="hub-community-sub">@彩球 选号 · @养生虾 问健康 · 公开群聊</div>
      </div>
      <span class="hub-community-arrow">›</span>
    </div>

  </div>
</template>

<script setup>
</script>

<style scoped>
.hub-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0d0d1a 0%, #1a1a2e 30%, #f5f6fa 30%);
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  padding-bottom: 32px;
}

/* ── 顶部 ── */
.hub-header {
  padding: 48px 20px 24px;
  text-align: center;
}
.hub-title {
  font-size: 28px; font-weight: 800; color: #FFD700;
  text-shadow: 0 2px 12px rgba(247,181,0,0.5);
  letter-spacing: 2px;
}
.hub-subtitle {
  font-size: 13px; color: rgba(255,255,255,0.55); margin-top: 6px;
}


/* ── App 图标网格（2格居中） ── */
.hub-grid {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 14px; padding: 16px 16px 0;
  max-width: 340px; margin: 0 auto;
}

.hub-app-card {
  background: #fff;
  border-radius: 20px;
  padding: 18px 12px 14px;
  text-align: center;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}
.hub-app-card:active { transform: scale(0.95); }
.hub-app-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }

/* 图标 */
.hub-app-icon {
  width: 64px; height: 64px; border-radius: 18px; margin: 0 auto 10px;
  display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.hx-icon      { background: linear-gradient(135deg, #1b4332, #2d6a4f); }
.lottery-icon { background: linear-gradient(135deg, #1a0d2e, #3b0764); }

.hub-icon-img { width: 100%; height: 100%; object-fit: cover; }
.hub-emoji-icon { font-size: 36px; }

/* 名字 */
.hub-app-name { font-size: 15px; font-weight: 700; color: #1a1a2e; margin-bottom: 2px; }
.hub-app-tag  { font-size: 11px; color: #888; margin-bottom: 6px; }
.hub-app-desc { font-size: 10px; color: #aaa; }

/* 徽章 */
.hub-app-badge {
  position: absolute; top: 10px; right: -2px;
  font-size: 9px; font-weight: 700; padding: 2px 8px;
  border-radius: 8px 0 0 8px;
}
.hx-badge      { background: #d8f3dc; color: #1b4332; }
.lottery-badge { background: #ede9fe; color: #4c1d95; }

/* ── 使用说明 ── */
.hub-diff-card {
  margin: 16px 16px 0;
  background: linear-gradient(135deg, #1a1a2e, #2d2d5e);
  border-radius: 20px; padding: 18px 16px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}
.hub-diff-title {
  font-size: 14px; font-weight: 700; color: #FFD700; margin-bottom: 14px;
}
.hub-diff-rows { display: flex; flex-direction: column; gap: 12px; }
.hub-diff-row { display: flex; align-items: flex-start; gap: 12px; }
.hub-diff-icon {
  width: 40px; height: 40px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; flex-shrink: 0;
}
.hub-diff-icon.health  { background: rgba(82,183,136,0.2); border: 1px solid rgba(82,183,136,0.4); }
.hub-diff-icon.lottery { background: rgba(124,58,237,0.2); border: 1px solid rgba(124,58,237,0.4); }
.hub-diff-body { flex: 1; }
.hub-diff-label { font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 3px; }
.hub-diff-desc { font-size: 12px; color: rgba(255,255,255,0.6); line-height: 1.5; }

/* ── 社区入口 ── */
.hub-community-btn {
  margin: 12px 16px 0;
  background: linear-gradient(135deg, #1a1a2e, #2d2d5e);
  border-radius: 16px; padding: 14px 16px;
  display: flex; align-items: center; gap: 12px;
  cursor: pointer; transition: all 0.2s;
}
.hub-community-btn:active { transform: scale(0.98); }
.hub-community-icon { font-size: 28px; flex-shrink: 0; }
.hub-community-title { font-size: 14px; font-weight: 700; color: #FFD700; }
.hub-community-sub  { font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 2px; }
.hub-community-arrow { font-size: 24px; color: rgba(255,255,255,0.3); margin-left: auto; }
</style>
