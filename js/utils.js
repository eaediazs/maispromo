/**
 * js/utils.js — Módulo de Utilitários Centrais do +PROMO
 *
 * ANTES: moeda(), toast(), esc() e PLAN_RATES duplicados em
 *        dashboard.html, simulador.html e index.html.
 *
 * DEPOIS: fonte única da verdade. Qualquer mudança de taxa
 *         ou formatação propaga para todo o app imediatamente.
 *
 * COMO USAR EM QUALQUER PÁGINA:
 *   import { moeda, toast, esc, PLAN_RATES, getPlanRates } from '../js/utils.js';
 */

// ─────────────────────────────────────────────
// 1. TABELA DE TAXAS — fonte única da verdade
//    ANTES: ternários repetidos 9× no dashboard.html
//    DEPOIS: um objeto, zero repetição
// ─────────────────────────────────────────────
export const PLAN_RATES = {
  basic: {
    super: 0.02, farm: 0.04, rest: 0.02,
    comb:  0.02, moda: 0.03, tech: 0.02,
  },
  plus: {
    super: 0.04, farm: 0.08, rest: 0.06,
    comb:  0.03, moda: 0.08, tech: 0.04,
  },
  premium: {
    super: 0.06, farm: 0.08, rest: 0.08,
    comb:  0.04, moda: 0.10, tech: 0.05,
  },
};

/** Retorna as taxas do plano, com fallback seguro para 'basic' */
export const getPlanRates = (plano) =>
  PLAN_RATES[plano] ?? PLAN_RATES.basic;

/** Calcula cashback total dado um objeto de gastos e um plano */
export const calcCashback = (gastos, plano) => {
  const r = getPlanRates(plano);
  return Object.entries(gastos).reduce(
    (total, [cat, valor]) => total + (valor * (r[cat] ?? 0)),
    0
  );
};

// ─────────────────────────────────────────────
// 2. FORMATAÇÃO DE MOEDA
//    Usa Intl.NumberFormat (nativo, preciso, respeitoso com locale)
//    ANTES: 'R$ ' + v.toFixed(2).replace('.', ',')
//    DEPOIS: formatação nativa que lida com números grandes e negativos
// ─────────────────────────────────────────────
const _fmt = new Intl.NumberFormat('pt-BR', {
  style:    'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});
export const moeda = (v) => _fmt.format(Number(v) || 0);

// ─────────────────────────────────────────────
// 3. SANITIZAÇÃO XSS
//    Previne injeção de HTML via dados do Firestore
// ─────────────────────────────────────────────
export const esc = (str) => {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// ─────────────────────────────────────────────
// 4. TOAST SYSTEM — com deduplicação e acessibilidade
//    ANTES: cria elementos repetidos sem limite
//    DEPOIS: máx 3 toasts, aria-live para leitores de tela
// ─────────────────────────────────────────────
const _toastQueue = new Set();

export const toast = (msg, type = '') => {
  if (_toastQueue.has(msg)) return; // deduplicação
  _toastQueue.add(msg);

  const container = document.getElementById('toast-container');
  if (!container) return;

  // Limitar a 3 toasts simultâneos
  const existing = container.querySelectorAll('.toast');
  if (existing.length >= 3) existing[0].remove();

  const el = document.createElement('div');
  el.className        = `toast ${type}`.trim();
  el.textContent      = msg;
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');

  container.appendChild(el);

  const timeout = setTimeout(() => {
    el.style.animation = 'toastOut .3s ease forwards';
    el.addEventListener('animationend', () => {
      el.remove();
      _toastQueue.delete(msg);
    }, { once: true });
  }, 3800);

  // Fechar ao clicar
  el.addEventListener('click', () => {
    clearTimeout(timeout);
    el.remove();
    _toastQueue.delete(msg);
  });
};

// ─────────────────────────────────────────────
// 5. DATA EM PT-BR
// ─────────────────────────────────────────────
export const dataPtBR = (date = new Date()) =>
  date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  }).replace(/^\w/, c => c.toUpperCase()); // Capitaliza 1ª letra

// ─────────────────────────────────────────────
// 6. SISTEMA DE NÍVEIS — fonte única da verdade
// ─────────────────────────────────────────────
export const NIVEIS = [
  { nome: 'Iniciante',  min: 0,    max: 200,  chips: ['Cashback básico', 'Suporte chat'] },
  { nome: 'Explorador', min: 200,  max: 500,  chips: ['Cashback básico', 'Suporte chat', 'Cupons mensais'] },
  { nome: 'Fiel',       min: 500,  max: 1000, chips: ['Cashback +0.5%', 'Saque prioritário', 'Parceiros VIP'] },
  { nome: 'VIP',        min: 1000, max: 2000, chips: ['Cashback +1%', 'Milhas duplas', 'Atendimento VIP', 'Surpresas mensais'] },
  { nome: 'Embaixador', min: 2000, max: 9999, chips: ['Cashback +2%', 'Milhas triplas', 'Acesso antecipado', 'Presente anual <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>'] },
];

export const calcNivel = (pontos) => {
  const n = NIVEIS.find(n => pontos < n.max) ?? NIVEIS.at(-1);
  const pct = n.min === n.max
    ? 100
    : Math.round(Math.max(0, Math.min(100, (pontos - n.min) / (n.max - n.min) * 100)));
  return { ...n, pct };
};

// ─────────────────────────────────────────────
// 7. DEBOUNCE — evita chamadas excessivas em inputs
// ─────────────────────────────────────────────
export const debounce = (fn, ms = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

// ─────────────────────────────────────────────
// 8. OBSERVER DE VISIBILIDADE — para animações de entrada
// ─────────────────────────────────────────────
export const observeReveal = (selector = '.reveal') => {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll(selector).forEach(el => el.classList.add('visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    }),
    { threshold: 0.15 }
  );
  document.querySelectorAll(selector).forEach(el => io.observe(el));
};
