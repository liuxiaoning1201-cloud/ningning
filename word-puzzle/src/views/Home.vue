<template>
  <div class="home-page page">
    <header class="hero animate-fade-in">
      <div class="hero-icon">🧩</div>
      <h1 class="hero-title">中文填字接龍</h1>
      <p class="hero-subtitle">詞語、成語與語句練習，和朋友一起挑戰吧 ✨</p>
    </header>

    <div class="mode-cards">
      <div class="mode-card card" :style="{ animationDelay: '0.1s' }">
        <div class="mode-icon">📝</div>
        <div class="mode-info">
          <h2 class="mode-title">練習模式</h2>
          <p class="mode-desc">選擇題目，自行練習填字</p>
        </div>
        <RouterLink to="/play" class="btn btn-primary mode-btn">開始</RouterLink>
      </div>

      <div class="mode-card card" :style="{ animationDelay: '0.25s' }">
        <div class="mode-icon">⚔️</div>
        <div class="mode-info">
          <h2 class="mode-title">本地對戰</h2>
          <p class="mode-desc">兩人同機，即時競技</p>
        </div>
        <RouterLink to="/play" class="btn btn-primary mode-btn">開始</RouterLink>
      </div>

      <div class="mode-card card" :style="{ animationDelay: '0.4s' }">
        <div class="mode-icon">🌐</div>
        <div class="mode-info">
          <h2 class="mode-title">遠程對戰</h2>
          <p class="mode-desc">線上房間，班級比賽</p>
        </div>
        <RouterLink to="/play/remote" class="btn btn-primary mode-btn">開始</RouterLink>
      </div>
    </div>

    <footer class="home-footer animate-fade-in" style="animation-delay: 0.55s">
      <RouterLink to="/settings" class="footer-link">
        <span class="footer-icon">⚙️</span>
        <span>設定</span>
      </RouterLink>
    </footer>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding-top: 3rem;
  padding-bottom: 2rem;
}

/* ── Hero ── */
.hero {
  text-align: center;
  margin-bottom: 2.5rem;
}

.hero-icon {
  font-size: 3.5rem;
  margin-bottom: 0.5rem;
  animation: sparkle 2s ease-in-out infinite;
}

.hero-title {
  font-family: var(--font-heading);
  font-size: 2.25rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.5rem;
}

.hero-subtitle {
  color: var(--text-muted);
  font-size: 1rem;
  line-height: 1.6;
}

/* ── Mode Cards ── */
.mode-cards {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2.5rem;
}

.mode-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  animation: fadeIn 0.5s ease both;
}

.mode-icon {
  font-size: 2.25rem;
  flex-shrink: 0;
  width: 3.5rem;
  height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #FFF0F3 0%, #F5EDFF 100%);
  border-radius: 14px;
}

.mode-info {
  flex: 1;
  min-width: 0;
}

.mode-title {
  font-family: var(--font-heading);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.15rem;
}

.mode-desc {
  font-size: 0.88rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.mode-btn {
  flex-shrink: 0;
  padding: 0.6rem 1.4rem;
  font-size: 0.95rem;
  text-decoration: none;
}

.mode-btn:hover {
  text-decoration: none;
}

/* ── Footer ── */
.home-footer {
  margin-top: auto;
  display: flex;
  justify-content: center;
  gap: 2rem;
  padding-top: 1.5rem;
  border-top: 1.5px solid var(--border);
}

.footer-link {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-muted);
  font-size: 0.95rem;
  text-decoration: none;
  transition: color 0.2s ease;
}

.footer-link:hover {
  color: var(--primary);
  text-decoration: none;
}

.footer-icon {
  font-size: 1.15rem;
}
</style>
