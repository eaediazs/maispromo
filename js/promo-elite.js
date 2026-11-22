/**
 * js/promo-elite.js — Módulo de Funcionalidades Premium
 *
 * Cobre os Pilares 2 e 4 completos:
 *  - Dark Mode com persistência no localStorage
 *  - Ripple effect em todos os botões
 *  - Skeleton Loaders para KPIs e Transações
 *  - Confetti na celebração de nível / saque
 *  - Feedback de rede offline
 *  - Prompt de instalação PWA
 *  - Menu hambúrguer mobile
 *  - Animações de reveal no scroll
 *
 * COMO USAR (adicionar no <body> de TODAS as páginas):
 *   <script type="module" src="../js/promo-elite.js"></script>
 *   (para index.html: src="/js/promo-elite.js")
 */

// ─────────────────────────────────────────────
// 1. DARK MODE — Switch completo com persistência
// ─────────────────────────────────────────────

const THEME_KEY = 'promo-theme';

function applyTheme(isDark) {
  document.documentElement.classList.toggle('dark', isDark);
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
}

function initDarkMode() {
  // 1. Verificar preferência salva
  const saved = localStorage.getItem(THEME_KEY);
  // 2. Ou preferência do sistema operacional
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved ? saved === 'dark' : prefersDark;

  applyTheme(isDark);

  // Ouvir o toggle na navbar
  document.addEventListener('change', (e) => {
    if (e.target.id === 'theme-toggle') {
      applyTheme(e.target.checked);
    }
  });

  // Sincronizar o checkbox com o estado atual
  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.checked = isDark;

  // Ouvir mudança de preferência do sistema em tempo real
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(THEME_KEY)) {
      applyTheme(e.matches);
    }
  });
}

// ─────────────────────────────────────────────
// 2. RIPPLE EFFECT — efeito material design nos botões
//
// ANTES: botões sem feedback visual de clique
// DEPOIS: onda que emana do ponto exato do clique
// ─────────────────────────────────────────────

function createRipple(e) {
  const btn = e.currentTarget;
  const existing = btn.querySelector('.ripple-wave');
  if (existing) existing.remove();

  const rect   = btn.getBoundingClientRect();
  const size   = Math.max(rect.width, rect.height) * 2;
  const x      = e.clientX - rect.left - size / 2;
  const y      = e.clientY - rect.top  - size / 2;

  const ripple = document.createElement('span');
  ripple.className = 'ripple-wave';
  Object.assign(ripple.style, {
    width:  `${size}px`,
    height: `${size}px`,
    left:   `${x}px`,
    top:    `${y}px`,
  });

  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
}

function initRipple() {
  // Aplica em todos os botões existentes e futuros (MutationObserver)
  const apply = (el) => {
    if (el.classList?.contains('btn') && !el.dataset.ripple) {
      el.addEventListener('click', createRipple);
      el.dataset.ripple = '1';
    }
  };

  document.querySelectorAll('.btn').forEach(apply);

  new MutationObserver((mutations) => {
    mutations.forEach(m =>
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          apply(node);
          node.querySelectorAll?.('.btn').forEach(apply);
        }
      })
    );
  }).observe(document.body, { childList: true, subtree: true });
}

// ─────────────────────────────────────────────
// 3. SKELETON LOADERS
//
// Uso no dashboard.html, ANTES de onSnapshot retornar dados:
//   import { showSkeletons, hideSkeletons } from './promo-elite.js';
//
//   // Logo após autenticação confirmar (linha ~1049 dashboard.html):
//   showSkeletons();
//
//   onSnapshot(userRef, snap => {
//     hideSkeletons();  // ← add esta linha
//     updateUI(snap.data());
//   });
// ─────────────────────────────────────────────

export function showSkeletons() {
  // KPI cards
  const kpiIds = ['kpi-cashback','kpi-milhas','kpi-gasto','kpi-nivel'];
  kpiIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.dataset.originalText = el.textContent;
      el.innerHTML = `<div class="skeleton skeleton-kpi-val" style="margin:0"></div>`;
    }
  });

  // Barras de gráfico
  const barChart = document.getElementById('bar-chart');
  if (barChart) {
    barChart.innerHTML = Array.from({ length: 6 }, (_, i) => {
      const heights = [40, 60, 35, 70, 50, 80];
      return `
        <div class="bar-w">
          <div class="skeleton skeleton-bar-item" style="height:${heights[i]}px"></div>
          <div class="skeleton" style="height:10px;width:24px;border-radius:4px;margin-top:4px"></div>
        </div>`;
    }).join('');
  }

  // Transações
  const txList = document.getElementById('tx-list-dash');
  if (txList) {
    txList.innerHTML = Array.from({ length: 4 }).map(() => `
      <div class="skeleton-tx">
        <div class="skeleton skeleton-tx-icon"></div>
        <div class="skeleton-tx-lines">
          <div class="skeleton skeleton-tx-name"></div>
          <div class="skeleton skeleton-tx-date"></div>
        </div>
        <div class="skeleton-tx-val">
          <div class="skeleton skeleton-tx-amount"></div>
          <div class="skeleton skeleton-tx-cash"></div>
        </div>
      </div>`).join('');
  }
}

export function hideSkeletons() {
  // Os skeletons são substituídos pelos dados reais via updateUI()
  // Esta função existe para casos de erro ou cancelamento
  const elements = document.querySelectorAll('.skeleton');
  elements.forEach(el => {
    if (el.dataset.originalText) {
      el.textContent = el.dataset.originalText;
    }
    el.classList.remove('skeleton');
  });
}

// ─────────────────────────────────────────────
// 4. CONFETTI — celebração de nível / saque
//
// Uso:
//   import { lançarConfetti } from './promo-elite.js';
//   lançarConfetti(); // após saque aprovado ou subida de nível
// ─────────────────────────────────────────────

export function lançarConfetti(opts = {}) {
  const {
    duration  = 3000,
    particles = 120,
    colors    = ['#F7C500','#E0B000','#18B96A','#FFFFFF','#1A1A1A'],
  } = opts;

  // Criar canvas
  let canvas = document.getElementById('confetti-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.style.cssText = `
      position:fixed;inset:0;pointer-events:none;z-index:9997;
      width:100%;height:100%;`;
    document.body.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  // Partículas
  const parts = Array.from({ length: particles }, () => ({
    x:    Math.random() * canvas.width,
    y:    Math.random() * canvas.height * -1, // começa acima da tela
    r:    Math.random() * 8 + 4,
    d:    Math.random() * particles,
    color: colors[Math.floor(Math.random() * colors.length)],
    tilt:  Math.random() * 10 - 10,
    tiltAngle: 0,
    tiltSpeed: Math.random() * 0.1 + 0.05,
    speed:     Math.random() * 3 + 2,
    opacity:   1,
    shape:     Math.random() > 0.5 ? 'rect' : 'circle',
  }));

  let frame;
  const start = performance.now();

  const draw = (now) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    parts.forEach(p => {
      p.tiltAngle += p.tiltSpeed;
      p.y += p.speed;
      p.tilt = Math.sin(p.tiltAngle) * 15;

      // Fade out nos últimos 500ms
      if (elapsed > duration - 500) {
        p.opacity = Math.max(0, 1 - (elapsed - (duration - 500)) / 500);
      }

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle   = p.color;
      ctx.translate(p.x + p.tilt, p.y);
      ctx.rotate(p.tiltAngle * 0.3);

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      }

      ctx.restore();

      // Reset quando sair da tela
      if (p.y > canvas.height) {
        p.y = -10;
        p.x = Math.random() * canvas.width;
      }
    });

    if (elapsed < duration) {
      frame = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.remove();
    }
  };

  frame = requestAnimationFrame(draw);

  // Cleanup se usuário sair da página
  return () => {
    cancelAnimationFrame(frame);
    canvas.remove();
  };
}

// ─────────────────────────────────────────────
// 5. FEEDBACK DE REDE OFFLINE
//    Banner vermelho no rodapé quando sem conexão
// ─────────────────────────────────────────────

function initOfflineDetection() {
  let bar = document.getElementById('offline-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id        = 'offline-bar';
    bar.className = 'offline-bar';
    bar.textContent = ' Você está sem conexão — os dados exibidos podem estar desatualizados.';
    document.body.appendChild(bar);
  }

  const show = () => bar.classList.add('visible');
  const hide = () => bar.classList.remove('visible');

  window.addEventListener('online',  hide);
  window.addEventListener('offline', show);

  if (!navigator.onLine) show();
}

// ─────────────────────────────────────────────
// 6. PROMPT DE INSTALAÇÃO PWA
//    Aparece como banner elegante na 3ª visita
// ─────────────────────────────────────────────

function initPWAInstall() {
  let deferredPrompt;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Mostrar só depois de 3 visitas e se não foi dispensado
    const visits    = parseInt(localStorage.getItem('promo-visits') || '0') + 1;
    const dismissed = localStorage.getItem('promo-pwa-dismissed');
    localStorage.setItem('promo-visits', visits);

    if (visits >= 3 && !dismissed) {
      showInstallBanner(deferredPrompt);
    }
  });

  // Detectar instalação concluída
  window.addEventListener('appinstalled', () => {
    hidePWABanner();
    localStorage.setItem('promo-pwa-dismissed', 'installed');
    // Import dinâmico para não circularizar
    import('./promo-elite.js').then(m => m.lançarConfetti({ duration: 2000, particles: 80 }));
  });
}

function showInstallBanner(prompt) {
  const existing = document.getElementById('pwa-install-banner');
  if (existing) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:#1A1A1A;color:#fff;border-radius:16px;
    padding:16px 20px;display:flex;align-items:center;gap:14px;
    box-shadow:0 8px 32px rgba(0,0,0,.4);z-index:9000;
    max-width:380px;width:90vw;animation:toastIn .3s ease;`;
  banner.innerHTML = `
    <div style="font-size:28px"></div>
    <div>
      <div style="font-family:'Nunito',sans-serif;font-size:14px;font-weight:800;margin-bottom:3px">
        Instalar +Promo
      </div>
      <div style="font-size:12px;color:#aaa">
        Adicione à tela inicial e acesse mais rápido
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0">
      <button id="pwa-install-btn" style="background:var(--yellow);border:none;
        border-radius:50px;padding:8px 16px;font-family:'Nunito',sans-serif;
        font-size:13px;font-weight:800;cursor:pointer;color:#1A1A1A">
        Instalar
      </button>
      <button id="pwa-dismiss-btn" style="background:transparent;border:1px solid #333;
        border-radius:50px;padding:8px 12px;font-size:13px;cursor:pointer;color:#777">
        
      </button>
    </div>`;
  document.body.appendChild(banner);

  document.getElementById('pwa-install-btn').addEventListener('click', async () => {
    hidePWABanner();
    if (!prompt) return;
    const result = await prompt.prompt();
    if (result.outcome === 'accepted') {
      localStorage.setItem('promo-pwa-dismissed', 'installed');
    }
  });

  document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
    hidePWABanner();
    localStorage.setItem('promo-pwa-dismissed', 'dismissed');
  });
}

function hidePWABanner() {
  document.getElementById('pwa-install-banner')?.remove();
}

// ─────────────────────────────────────────────
// 7. MENU HAMBÚRGUER MOBILE
// ─────────────────────────────────────────────

// initMobileMenu removido pois causava conflito de overlay e cancelava navegação das tags <a> na sidebar do Dashboard. A lógica correta e oficial reside em dashboard/main.js e na landing page via index.html.
// ─────────────────────────────────────────────
// 8. ANIMAÇÕES DE REVEAL NO SCROLL
// ─────────────────────────────────────────────

function initReveal() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    }),
    { threshold: 0.15 }
  );
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

// ─────────────────────────────────────────────
// 9. KPI VALUE FLASH — animação quando valor muda
// ─────────────────────────────────────────────

export function flashKPI(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.classList.remove('updated');
  void el.offsetWidth; // reflow para reiniciar animação
  el.classList.add('updated');
}

// ─────────────────────────────────────────────
// INICIALIZAÇÃO — roda tudo quando o DOM estiver pronto
// ─────────────────────────────────────────────

function init() {
  initDarkMode();
  initRipple();
  initOfflineDetection();
  initPWAInstall();
  initReveal();

  // Registrar Service Worker
  if ('serviceWorker' in navigator) {
    // Detecta a raiz correta independente do nível de pasta
    const swPath = location.pathname.includes('/pages/') ? '../sw.js' : '/sw.js';
    navigator.serviceWorker.register(swPath)
      .then(r => console.log('[+Promo SW] Registrado:', r.scope))
      .catch(e => console.warn('[+Promo SW] Falha:', e));
  }
}

// Rodar após DOM estar pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
