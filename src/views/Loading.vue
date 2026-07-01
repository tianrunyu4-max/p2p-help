<template>
  <div class="loading-container">
    <!-- 金色太极图 -->
    <div class="taiji-container">
      <div class="taiji">
        <div class="taiji-yin"></div>
        <div class="taiji-yang"></div>
        <div class="taiji-dot taiji-dot-yin"></div>
        <div class="taiji-dot taiji-dot-yang"></div>
      </div>
    </div>
    
    <!-- 加载文字 -->
    <div class="loading-text">易经能量场连接中...</div>
  </div>
</template>

<script>
export default {
  name: 'Loading'
}
</script>

<style scoped>
.loading-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: #000000;
}

/* 太极图容器 */
.taiji-container {
  width: 120px;
  height: 120px;
  margin-bottom: 40px;
}

/* 太极图主体 */
.taiji {
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: 50%;
  background: linear-gradient(to right, #D4AF37 0%, #D4AF37 50%, transparent 50%, transparent 100%);
  animation: rotate 3s linear infinite;
}

/* 阴（左半部分，透明） */
.taiji-yin {
  position: absolute;
  left: 0;
  top: 0;
  width: 50%;
  height: 100%;
  background-color: transparent;
  border-radius: 100% 0 0 100%;
}

/* 阳（右半部分，金色） */
.taiji-yang {
  position: absolute;
  right: 0;
  top: 0;
  width: 50%;
  height: 100%;
  background-color: #D4AF37;
  border-radius: 0 100% 100% 0;
}

/* 阴中的小圆点（金色） */
.taiji-dot-yin {
  position: absolute;
  left: 25%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  background-color: #D4AF37;
  border-radius: 50%;
}

/* 阳中的小圆点（透明/黑色） */
.taiji-dot-yang {
  position: absolute;
  right: 25%;
  top: 50%;
  transform: translate(50%, -50%);
  width: 20px;
  height: 20px;
  background-color: #000000;
  border-radius: 50%;
}

/* 旋转动画 */
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 加载文字样式 */
.loading-text {
  color: #D4AF37;
  font-size: 18px;
  font-weight: 300;
  letter-spacing: 2px;
  animation: pulse 2s ease-in-out infinite;
}

/* 文字脉冲动画 */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>

