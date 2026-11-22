// ═══════════════════════════════════════════════════════════════
// IMPORTS
// ═══════════════════════════════════════════════════════════════
import { auth, db } from '../firebase-config.js';
import {
  onAuthStateChanged, signOut,
  sendEmailVerification, verifyBeforeUpdateEmail,
  reauthenticateWithCredential, EmailAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc, collection, onSnapshot, setDoc, runTransaction,
  serverTimestamp, increment, addDoc, updateDoc, query, orderBy, getDocs, getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { moeda, esc, toast, dataPtBR, NIVEIS, calcNivel, getPlanRates } from '../utils.js';
import { showSkeletons, hideSkeletons, lançarConfetti, flashKPI } from '../promo-elite.js';

// ═══════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════════
const state = {
  userData:         {},
  userRef:          null,
  currentUID:       null,
  modoDemo:         false,
  saqueMetodo:      'pix',
  allTxs:           [],
  nivelAnterior:    null,
  notificacoes:     [],
  currentUser:      null,
  catalogo:         { interesses: [], frequViajem: null, objetivo: null, quizCompleto: false },
  mfaPinHash:       null,   // HMAC do PIN (vem do Worker — nunca contém o PIN real)
  mfaPinTimestamp:  null,   // Timestamp da geração do PIN (para verificar expiração)
  mfaEmail:         null,   // E-mail para o qual o PIN foi enviado
  saqueValor:       0,      // Valor customizado a ser sacado
};

const SAQUE_LIMITES = {
  basic:   { min: 30,  maxDiario: 500  },
  plus:    { min: 20,  maxDiario: 1000 },
  premium: { min: 10,  maxDiario: 5000 },
};

// ═══════════════════════════════════════════════════════════════
// UTILITÁRIOS DE DOM
// ═══════════════════════════════════════════════════════════════
const $ = (id) => document.getElementById(id);
const setText = (id, val) => { const el = $(id); if (el) el.textContent = val; };

setText('dash-date', dataPtBR());

// ═══════════════════════════════════════════════════════════════
// ANIMATED COUNTERS
// ═══════════════════════════════════════════════════════════════
function animateCounter(elId, targetValue, opts = {}) {
  const el = $(elId);
  if (!el) return;
  const { isCurrency = false, duration = 1050 } = opts;
  const currentText = el.textContent || '0';
  const currentNum  = parseFloat(currentText.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
  const startVal  = currentNum;
  const startTime = performance.now();
  function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }
  function tick(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = easeOutQuart(progress);
    const val      = startVal + (targetValue - startVal) * eased;
    if (isCurrency) { el.textContent = moeda(val); }
    else { el.textContent = Math.round(val).toLocaleString('pt-BR'); }
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ═══════════════════════════════════════════════════════════════
// BUTTON RIPPLE
// ═══════════════════════════════════════════════════════════════
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-yellow');
  if (!btn) return;
  const rect    = btn.getBoundingClientRect();
  const size    = Math.max(rect.width, rect.height) * 1.4;
  const x       = e.clientX - rect.left - size / 2;
  const y       = e.clientY - rect.top  - size / 2;
  const ripple  = document.createElement('span');
  ripple.className = 'btn-ripple';
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;`;
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
});

// ═══════════════════════════════════════════════════════════════
// NAVEGAÇÃO ENTRE VIEWS
// ═══════════════════════════════════════════════════════════════
document.getElementById('sidebar').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (!btn) return;
  e.preventDefault();
  showView(btn.dataset.view, btn);
  closeSidebar();
});

document.querySelectorAll('[data-view-btn]').forEach(btn => {
  btn.addEventListener('click', () => {
    const sbBtn = document.querySelector(`[data-view="${btn.dataset.viewBtn}"]`);
    showView(btn.dataset.viewBtn, sbBtn);
  });
});

document.querySelectorAll('[data-bn-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    const viewName = btn.dataset.bnView;
    const sbBtn = document.querySelector(`[data-view="${viewName}"]`);
    showView(viewName, sbBtn);
    document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  });
});

$('bn-resgatar')?.addEventListener('click', () => openModal('modal-saque'));
$('bn-mais')?.addEventListener('click', () => toggleSidebar());

function showView(viewName, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = $(`view-${viewName}`);
  if (view) {
    view.classList.add('active');
    void view.offsetWidth;
    view.classList.add('entering');
    setTimeout(() => view.classList.remove('entering'), 700);
  }
  document.querySelectorAll('.sb-item').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  document.querySelectorAll('.bn-item[data-bn-view]').forEach(b => {
    b.classList.toggle('on', b.dataset.bnView === viewName);
  });
  if (viewName === 'extrato')      renderExtrato('todos', '');
  if (viewName === 'catalogo')     { vitrineCatalogoInit(state.userData); }
  if (viewName === 'notificacoes') renderNotificacoes();
  if (viewName === 'seguranca' && auth.currentUser) populateSettingsView(auth.currentUser);
  if (viewName === 'resgatar') {
    setText('rh-saldo',  moeda(state.userData.cashback || 0));
    setText('mc-milhas', (state.userData.milhas || 0).toLocaleString('pt-BR'));
  }
}

// ═══════════════════════════════════════════════════════════════
// MODAIS
// ═══════════════════════════════════════════════════════════════
const openModal  = (id) => {
  $(id)?.classList.add('open');
  if (id === 'modal-saque') {
    prepararModalSaque();
  }
};
const closeModal = (id) => $(id)?.classList.remove('open');

$('btn-open-saque').addEventListener('click', () => openModal('modal-saque'));
$('btn-open-demo')?.addEventListener('click',  () => openModal('modal-demo'));
$('sb-btn-open-demo')?.addEventListener('click', () => {
  closeSidebar();
  openModal('modal-demo');
});
$('close-saque').addEventListener('click',    () => closeModal('modal-saque'));
$('close-demo').addEventListener('click',     () => closeModal('modal-demo'));
$('close-comprovante').addEventListener('click',   () => closeModal('modal-comprovante'));
$('close-comprovante-2').addEventListener('click', () => closeModal('modal-comprovante'));

$('kpi-hero-cta-btn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  openModal('modal-saque');
});

document.querySelectorAll('.modal-overlay').forEach(m =>
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); })
);

// ═══════════════════════════════════════════════════════════════
// SIDEBAR TOGGLE
// ═══════════════════════════════════════════════════════════════
const sidebar  = $('sidebar');
const backdrop = $('sidebar-backdrop');

function openSidebar()  { sidebar?.classList.add('open'); backdrop?.classList.add('visible'); document.body.style.overflow = 'hidden'; }
function closeSidebar() { sidebar?.classList.remove('open'); backdrop?.classList.remove('visible'); document.body.style.overflow = ''; }
function toggleSidebar() { if (sidebar?.classList.contains('open')) { closeSidebar(); } else { openSidebar(); } }

backdrop?.addEventListener('click', closeSidebar);

// ═══════════════════════════════════════════════════════════════
// SAQUE OPTS
// ═══════════════════════════════════════════════════════════════
$('saque-opts').addEventListener('click', (e) => {
  const opt = e.target.closest('.saque-opt');
  if (!opt) return;
  document.querySelectorAll('.saque-opt').forEach(o => o.classList.remove('selected'));
  opt.classList.add('selected');
  state.saqueMetodo = opt.dataset.metodo;
  $('saque-chave-wrap').style.display = state.saqueMetodo === 'desconto' ? 'none' : 'block';
  validarValorSaque();
});

// Validar chave Pix em tempo real
$('saque-chave')?.addEventListener('input', () => validarValorSaque());
$('saque-chave')?.addEventListener('change', () => validarValorSaque());

// Validar valor de resgate em tempo real
$('saque-valor-input')?.addEventListener('input', () => validarValorSaque());
$('saque-valor-input')?.addEventListener('change', () => validarValorSaque());

// Botão MAX do valor do resgate
$('btn-saque-valor-max')?.addEventListener('click', () => {
  const saldo = state.userData?.cashback || 0;
  const plano = state.userData?.plano || 'basic';
  const limites = SAQUE_LIMITES[plano] || SAQUE_LIMITES.basic;
  const maxDiario = limites.maxDiario;
  const inputValor = $('saque-valor-input');
  if (inputValor) {
    // Define como o saldo disponível ou capado em maxDiario para excelente UX
    inputValor.value = Math.min(saldo, maxDiario).toFixed(2);
    validarValorSaque();
  }
});

document.querySelectorAll('.res-opt').forEach(opt =>
  opt.addEventListener('click', () => {
    document.querySelectorAll('.res-opt').forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
  })
);

// ═══════════════════════════════════════════════════════════════
// KPI CARDS
// ═══════════════════════════════════════════════════════════════
$('kpi-card-cashback')?.addEventListener('click', () => openModal('modal-saque'));
$('kpi-card-milhas')?.addEventListener('click', () => showView('resgatar', document.querySelector('[data-view="resgatar"]')));
$('kpi-card-gasto')?.addEventListener('click', () => showView('extrato', document.querySelector('[data-view="extrato"]')));

// ═══════════════════════════════════════════════════════════════
// NOTIFICAÇÕES
// ═══════════════════════════════════════════════════════════════
function gerarProtocolo() {
  return `PROMO-${Math.floor(Math.random() * 900000) + 100000}`;
}

async function salvarNotificacao(dados) {
  if (!state.userRef || state.modoDemo) return;
  try {
    const colRef = collection(db, 'notificacoes', state.currentUID, 'itens');
    await addDoc(colRef, { ...dados, lida: false, criadoEm: serverTimestamp() });
  } catch (err) { console.warn('Notificação não salva:', err); }
}

function iniciarEscutaNotificacoes() {
  if (!state.currentUID) return;
  const colRef = collection(db, 'notificacoes', state.currentUID, 'itens');
  const q      = query(colRef, orderBy('criadoEm', 'desc'));
  onSnapshot(q, (snap) => {
    state.notificacoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const naoLidas = state.notificacoes.filter(n => !n.lida).length;
    const badge    = $('sb-notif-badge');
    const bnBadge  = $('bn-notif-badge');
    if (badge)   { badge.textContent   = naoLidas; badge.style.display   = naoLidas > 0 ? 'inline-block' : 'none'; }
    if (bnBadge) { bnBadge.textContent = naoLidas; bnBadge.style.display = naoLidas > 0 ? 'flex' : 'none'; }
  });
}

function renderNotificacoes() {
  const lista = $('notif-list');
  if (!lista) return;
  if (state.notificacoes.length === 0) {
    lista.innerHTML = `<div class="empty-state"><div class="es-icon"></div><h3>Caixa de entrada vazia</h3><p>Você receberá notificações aqui após cada resgate de cashback, cupons novos e atualizações da conta.</p></div>`;
    return;
  }
  lista.innerHTML = state.notificacoes.map(n => {
    const iconeClass = n.tipo === 'saque' ? 'verde' : n.tipo === 'cupom' ? 'roxo' : 'azul';
    const timestamp  = n.criadoEm?.toDate
      ? n.criadoEm.toDate().toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
      : 'Agora';
    return `<div class="notif-item ${!n.lida ? 'unread' : ''}" data-id="${n.id}">
      ${!n.lida ? '<div class="notif-badge-new"></div>' : ''}
      <div class="notif-icon ${iconeClass}">${n.icone || ''}</div>
      <div class="notif-body">
        <div class="notif-title">${esc(n.titulo)}</div>
        <div class="notif-msg">${esc(n.mensagem)}</div>
        <div class="notif-time"> ${timestamp}</div>
        ${n.protocolo ? `<div class="notif-actions"><span style="font-family:monospace;font-size:12px;background:var(--bg-input);padding:4px 10px;border-radius:6px;color:var(--text-secondary)">${esc(n.protocolo)}</span></div>` : ''}
      </div></div>`;
  }).join('');
  lista.addEventListener('click', async (e) => {
    const item = e.target.closest('.notif-item');
    if (!item || !item.dataset.id) return;
    const id    = item.dataset.id;
    const notif = state.notificacoes.find(n => n.id === id);
    if (notif && !notif.lida && state.currentUID) {
      try { const docRef = doc(db, 'notificacoes', state.currentUID, 'itens', id); await updateDoc(docRef, { lida: true }); } catch (_) {}
    }
  });
}

$('btn-marcar-todas-lidas')?.addEventListener('click', async () => {
  if (!state.currentUID) return;
  const promessas = state.notificacoes.filter(n => !n.lida).map(n => updateDoc(doc(db, 'notificacoes', state.currentUID, 'itens', n.id), { lida: true }));
  await Promise.all(promessas).catch(() => {});
  toast('Todas as notificações marcadas como lidas.', 'success');
});

// ═══════════════════════════════════════════════════════════════
// COMPROVANTE PDF
// ═══════════════════════════════════════════════════════════════
function abrirComprovante({ valor, metodo, nome, plano, protocolo }) {
  const metodoLabels = { pix: 'Pix (instantâneo)', ted: 'TED bancário (1 dia útil)', desconto: 'Desconto na próxima fatura' };
  const planLabels   = { basic: 'Plano Basic', plus: 'Plano Plus', premium: 'Plano Premium' };
  const agora        = new Date().toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  setText('comp-valor',    moeda(valor));
  setText('comp-metodo',   metodoLabels[metodo] || metodo);
  setText('comp-data',     agora);
  setText('comp-nome',     nome);
  setText('comp-plano',    planLabels[plano] || plano);
  setText('comp-protocolo', protocolo);
  setText('print-valor',    moeda(valor));
  setText('print-metodo',   metodoLabels[metodo] || metodo);
  setText('print-data',     agora);
  setText('print-nome',     nome);
  setText('print-plano',    planLabels[plano] || plano);
  setText('print-protocolo', protocolo);
  openModal('modal-comprovante');
}

$('btn-imprimir-comprovante')?.addEventListener('click', () => {
  const printArea = $('print-area');
  if (printArea) printArea.style.display = 'block';
  window.print();
  setTimeout(() => { if (printArea) printArea.style.display = 'none'; }, 500);
});

// ═══════════════════════════════════════════════════════════════
// SAQUE ATÔMICO — INTERCEPTADO POR MFA (Cloudflare Worker)
// ═══════════════════════════════════════════════════════════════

// URL do Worker MFA — alterar após deploy
const MFA_WORKER_URL = 'https://mfa-pin.sacmaispromo.workers.dev';

// ── Etapa 1: Interceptar clique do botão "Confirmar resgate" ──
$('btn-confirmar-saque').addEventListener('click', () => {
  if (state.saqueMetodo !== 'desconto') {
    const chave = $('saque-chave')?.value.trim();
    if (!chave) { toast('Informe a chave para recebimento.', 'warning'); return; }
  }
  // Iniciar fluxo MFA
  iniciarSaque();
});

// ── Etapa 2: Solicitar PIN real via Worker (Resend) ──

/** Solicita PIN real ao Cloudflare Worker via fetch — v2 Resend (diagnóstico completo) */
async function solicitarPinReal(email, retryCount = 0) {
  const payload = { email, acao: 'solicitar_pin' };

  console.log('%c[MFA Request] ▶ Enviando solicitação de PIN', 'color:#00ffcc;font-weight:bold;background:#1a1a1a;padding:4px 8px;border-radius:4px;');
  console.log('[MFA Request] URL:', MFA_WORKER_URL);
  console.log('[MFA Request] Payload:', JSON.stringify(payload, null, 2));
  console.log('[MFA Request] Tentativa:', retryCount + 1);

  try {
    const t0 = performance.now();
    const res = await fetch(MFA_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const duracao = Math.round(performance.now() - t0);

    // SEMPRE ler o body cru antes de qualquer coisa
    const bodyTexto = await res.text();

    console.log(`%c[MFA Response] ◀ HTTP ${res.status} em ${duracao}ms`, res.ok
      ? 'color:#33ff33;font-weight:bold;background:#1a1a1a;padding:4px 8px;border-radius:4px;'
      : 'color:#ff3333;font-weight:bold;background:#1a1a1a;padding:4px 8px;border-radius:4px;');
    console.log('[MFA Response] Body cru:', bodyTexto);

    // Parse JSON (tolerante a respostas não-JSON como erros da Cloudflare)
    let data;
    try {
      data = JSON.parse(bodyTexto);
    } catch (_) {
      data = { erro: bodyTexto };
    }

    if (!res.ok) {
      console.error('[MFA Error] Status:', res.status, '| Resposta:', data);

      // Retry automático para erros temporários (429 / 5xx) — máximo 1 retry
      if ((res.status === 429 || res.status >= 500) && retryCount < 1) {
        console.warn('[MFA Retry] Aguardando 2s antes de tentar novamente...');
        await new Promise(r => setTimeout(r, 2000));
        return solicitarPinReal(email, retryCount + 1);
      }

      // Montar mensagem amigável com detalhes reais
      const erroBase = data.erro || `Erro ${res.status} no servidor de segurança.`;
      const detalhe  = data.detalhe || data.statusResend || '';
      const msgFinal = detalhe ? `${erroBase} (${detalhe})` : erroBase;

      throw new Error(msgFinal);
    }

    // ── Sucesso ──
    console.log('%c[MFA Success] ✓ PIN solicitado com sucesso', 'color:#33ff33;font-weight:bold;background:#1a1a1a;padding:4px 8px;border-radius:4px;');
    console.log('[MFA Success] pinHash:', data.pinHash?.substring(0, 16) + '…');
    console.log('[MFA Success] expiresIn:', data.expiresIn, 'segundos');

    state.mfaPinHash      = data.pinHash;
    state.mfaPinTimestamp  = data.timestamp;
    state.mfaEmail         = email;

    return data;
  } catch (err) {
    console.error('%c[MFA Fatal] ✗ Erro definitivo', 'color:#ff3333;font-weight:bold;background:#1a1a1a;padding:4px 8px;border-radius:4px;');
    console.error('[MFA Fatal] Mensagem:', err.message);
    console.error('[MFA Fatal] Stack:', err.stack);

    // Retry de rede (TypeError: Failed to fetch)
    if (err.name === 'TypeError' && retryCount < 1) {
      console.warn('[MFA Retry] Falha de rede. Tentando novamente em 2s...');
      await new Promise(r => setTimeout(r, 2000));
      return solicitarPinReal(email, retryCount + 1);
    }

    throw err;
  }
}

async function iniciarSaque() {
  const btn = $('btn-confirmar-saque');
  const inputs = document.querySelectorAll('.mfa-pin-input');

  // Resetar estado do modal PIN
  inputs.forEach(inp => {
    inp.value = '';
    inp.classList.remove('filled', 'error', 'success');
  });
  $('btn-mfa-confirm').disabled = true;
  const fb = $('mfa-feedback');
  fb.className = 'mfa-feedback';
  fb.textContent = '';

  // Determinar o e-mail real do usuário com o máximo de fallbacks possíveis
  const emailUsuario = state.currentUser?.email || auth.currentUser?.email || state.userData?.email || 'sacmaispromo@gmail.com';
  console.log('%c[DEBUG MFA] Iniciando saque. Envio real para:', 'color: #00ffcc; font-weight: bold;', emailUsuario);

  // Loading state no botão
  btn.disabled = true;
  const btnOrigHTML = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> Enviando código...';

  try {
    const data = await solicitarPinReal(emailUsuario);

    closeModal('modal-saque');
    openModal('modal-mfa-pin');
    setTimeout(() => inputs[0]?.focus(), 350);
    
    toastMFA('Código de segurança enviado para o seu e-mail cadastrado');
    iniciarTimerReenvio();
  } catch (err) {
    console.error('[MFA] Erro ao solicitar PIN:', err);
    toast(err.message || 'Não foi possível enviar o código. Tente novamente.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = btnOrigHTML;
  }
}

// Toast premium com ícone de e-mail (sem emoji)
function toastMFA(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast mfa-toast';
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>${esc(msg)}`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut .3s ease forwards';
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, 4500);
  el.addEventListener('click', () => el.remove());
}

let _mfaResendInterval = null;

function limparEstadoMFA() {
  state.mfaPinHash = null;
  state.mfaPinTimestamp = null;
  state.mfaEmail = null;
  if (_mfaResendInterval) {
    clearInterval(_mfaResendInterval);
    _mfaResendInterval = null;
  }
}

// Inicializar e validar modal de saque antes de abrir
function prepararModalSaque() {
  const inputValor = $('saque-valor-input');
  const feedback = $('saque-valor-feedback');
  const minHint = $('saque-min-hint');
  const maxHint = $('saque-max-hint');
  const btnConfirm = $('btn-confirmar-saque');
  const chaveInput = $('saque-chave');

  if (chaveInput) chaveInput.value = '';
  if (inputValor) inputValor.value = '';
  if (feedback) {
    feedback.textContent = '';
    feedback.className = 'saque-valor-feedback';
  }
  if (btnConfirm) btnConfirm.disabled = true;

  const plano = state.userData?.plano || 'basic';
  const limites = SAQUE_LIMITES[plano] || SAQUE_LIMITES.basic;
  const minimo = limites.min;
  const maxDiario = limites.maxDiario;

  if (minHint) minHint.textContent = moeda(minimo);
  if (maxHint) maxHint.textContent = moeda(maxDiario);

  setTimeout(() => inputValor?.focus(), 300);
}

// Validar valor de resgate em tempo real
function validarValorSaque() {
  const inputValor = $('saque-valor-input');
  const feedback = $('saque-valor-feedback');
  const btnConfirm = $('btn-confirmar-saque');
  if (!inputValor || !feedback || !btnConfirm) return false;

  const rawValue = inputValor.value;
  if (!rawValue || rawValue.trim() === '') {
    feedback.textContent = '';
    feedback.className = 'saque-valor-feedback';
    btnConfirm.disabled = true;
    return false;
  }

  const valor = parseFloat(rawValue);
  if (isNaN(valor) || valor <= 0) {
    feedback.textContent = 'Informe um valor maior que zero.';
    feedback.className = 'saque-valor-feedback show error';
    btnConfirm.disabled = true;
    return false;
  }

  const plano = state.userData?.plano || 'basic';
  const saldo = state.userData?.cashback || 0;
  const limites = SAQUE_LIMITES[plano] || SAQUE_LIMITES.basic;
  const minimo = limites.min;
  const maxDiario = limites.maxDiario;

  if (valor < minimo) {
    feedback.textContent = `Valor mínimo de resgate para seu plano é ${moeda(minimo)}.`;
    feedback.className = 'saque-valor-feedback show error';
    btnConfirm.disabled = true;
    return false;
  }

  if (valor > saldo) {
    feedback.textContent = `Saldo insuficiente. Seu saldo disponível é ${moeda(saldo)}.`;
    feedback.className = 'saque-valor-feedback show error';
    btnConfirm.disabled = true;
    return false;
  }

  if (valor > maxDiario) {
    feedback.textContent = `O limite máximo diário de resgate para seu plano é ${moeda(maxDiario)}.`;
    feedback.className = 'saque-valor-feedback show error';
    btnConfirm.disabled = true;
    return false;
  }

  // Se o método não for desconto e a chave estiver vazia, botão continua desabilitado
  if (state.saqueMetodo !== 'desconto') {
    const chave = $('saque-chave')?.value.trim();
    if (!chave) {
      feedback.textContent = `Valor disponível para resgate. Informe a chave para continuar.`;
      feedback.className = 'saque-valor-feedback show success';
      btnConfirm.disabled = true;
      return true;
    }
  }

  feedback.textContent = `Valor disponível para resgate.`;
  feedback.className = 'saque-valor-feedback show success';
  btnConfirm.disabled = false;
  state.saqueValor = valor;
  return true;
}

// Iniciar timer de 60 segundos do reenviar código
function iniciarTimerReenvio() {
  const btnResend = $('btn-mfa-resend');
  const labelEl = $('mfa-resend-timer');
  const labelParent = $('mfa-resend-label');
  if (!btnResend || !labelParent) return;

  clearInterval(_mfaResendInterval);

  let segundosRestantes = 60;
  btnResend.disabled = true;
  labelParent.innerHTML = `Reenviar código em <strong id="mfa-resend-timer">${segundosRestantes}</strong>s`;

  _mfaResendInterval = setInterval(() => {
    segundosRestantes--;
    if (segundosRestantes <= 0) {
      clearInterval(_mfaResendInterval);
      btnResend.disabled = false;
      labelParent.innerHTML = `Reenviar código`;
    } else {
      const tEl = $('mfa-resend-timer');
      if (tEl) tEl.textContent = segundosRestantes;
    }
  }, 1000);
}

// Ação de reenviar o PIN
async function reenviarPinMFA() {
  const btnResend = $('btn-mfa-resend');
  if (!btnResend || btnResend.disabled) return;

  btnResend.disabled = true;
  const labelEl = $('mfa-resend-label');
  const oldLabel = labelEl ? labelEl.innerHTML : '';
  if (labelEl) labelEl.innerHTML = '<span class="spinner"></span> Enviando...';

  try {
    const emailReal = state.mfaEmail || state.currentUser?.email || auth.currentUser?.email || state.userData?.email || 'sacmaispromo@gmail.com';
    const data = await solicitarPinReal(emailReal);
    toastMFA('Novo código de segurança enviado!');
    iniciarTimerReenvio();
  } catch (err) {
    console.error('[MFA] Erro ao reenviar PIN:', err);
    toast(err.message || 'Erro ao reenviar código. Tente novamente.', 'error');
    if (labelEl) labelEl.innerHTML = oldLabel;
    btnResend.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════
// MFA PIN MODAL — HANDLERS
// ═══════════════════════════════════════════════════════════════
$('close-mfa-pin')?.addEventListener('click', () => {
  closeModal('modal-mfa-pin');
  limparEstadoMFA();
});
$('btn-mfa-cancel')?.addEventListener('click', () => {
  closeModal('modal-mfa-pin');
  limparEstadoMFA();
});
$('btn-mfa-resend')?.addEventListener('click', () => reenviarPinMFA());

// Close on backdrop click
$('modal-mfa-pin')?.addEventListener('click', (e) => {
  if (e.target === $('modal-mfa-pin')) {
    closeModal('modal-mfa-pin');
    limparEstadoMFA();
  }
});

// ═══════════════════════════════════════════════════════════════
// MFA PIN — MICROINTERAÇÕES DO TECLADO
// ═══════════════════════════════════════════════════════════════
(function initMfaPinInputs() {
  const container = $('mfa-pin-container');
  if (!container) return;

  const inputs = container.querySelectorAll('.mfa-pin-input');
  const confirmBtn = $('btn-mfa-confirm');

  function getPinValue() {
    return Array.from(inputs).map(i => i.value).join('');
  }

  function updateConfirmState() {
    const pin = getPinValue();
    confirmBtn.disabled = pin.length < 6;
  }

  // Input event — auto-advance to next
  inputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = val.slice(0, 1);

      if (val) {
        input.classList.add('filled');
        input.classList.remove('error');
        // Advance to next input
        if (idx < inputs.length - 1) {
          inputs[idx + 1].focus();
        }
      } else {
        input.classList.remove('filled');
      }

      updateConfirmState();

      // Auto-validate when 6th digit is filled
      const pin = getPinValue();
      if (pin.length === 6) {
        confirmarPinMFA();
      }
    });

    // Keydown — backspace to go back
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && idx > 0) {
        inputs[idx - 1].value = '';
        inputs[idx - 1].classList.remove('filled');
        inputs[idx - 1].focus();
        updateConfirmState();
      }
      // Arrow keys
      if (e.key === 'ArrowLeft' && idx > 0) {
        e.preventDefault();
        inputs[idx - 1].focus();
      }
      if (e.key === 'ArrowRight' && idx < inputs.length - 1) {
        e.preventDefault();
        inputs[idx + 1].focus();
      }
    });

    // Focus — select content
    input.addEventListener('focus', () => {
      input.select();
    });
  });

  // Paste support — distribute digits across inputs
  container.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData?.getData('text') || '').replace(/[^0-9]/g, '').slice(0, 6);
    if (!pasted) return;
    pasted.split('').forEach((digit, i) => {
      if (inputs[i]) {
        inputs[i].value = digit;
        inputs[i].classList.add('filled');
        inputs[i].classList.remove('error');
      }
    });
    const nextIdx = Math.min(pasted.length, inputs.length - 1);
    inputs[nextIdx].focus();
    updateConfirmState();
    if (pasted.length === 6) {
      confirmarPinMFA();
    }
  });
})();

// ═══════════════════════════════════════════════════════════════
// MFA PIN — VALIDAÇÃO E CONFIRMAÇÃO (Server-side via Worker)
// ═══════════════════════════════════════════════════════════════
$('btn-mfa-confirm')?.addEventListener('click', () => confirmarPinMFA());

// Flag para evitar chamadas duplicadas (auto-validate + botão)
let _mfaValidando = false;

async function confirmarPinMFA() {
  if (_mfaValidando) return;

  const inputs = document.querySelectorAll('.mfa-pin-input');
  const pinInserido = Array.from(inputs).map(i => i.value).join('');
  const feedback = $('mfa-feedback');

  if (pinInserido.length < 6) return;
  _mfaValidando = true;


  // ── Modo Real: validação via Worker ──
  const confirmBtn = $('btn-mfa-confirm');
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<span class="spinner"></span> Verificando...';

  const validationPayload = {
    acao: 'validar_pin',
    email: state.mfaEmail,
    pin: pinInserido,
    pinHash: state.mfaPinHash,
    timestamp: state.mfaPinTimestamp,
  };

  console.log('%c[MFA Validate] ▶ Enviando validação de PIN', 'color:#00ffcc;font-weight:bold;background:#1a1a1a;padding:4px 8px;border-radius:4px;');
  console.log('[MFA Validate] Payload (sem pinHash completo):', JSON.stringify({
    ...validationPayload,
    pinHash: validationPayload.pinHash?.substring(0, 16) + '…',
  }, null, 2));

  try {
    const res = await fetch(MFA_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validationPayload),
    });

    const bodyTexto = await res.text();
    console.log(`[MFA Validate] HTTP ${res.status} | Body: ${bodyTexto}`);

    let data;
    try {
      data = JSON.parse(bodyTexto);
    } catch (_) {
      data = { valido: false, erro: bodyTexto };
    }

    if (data.valido) {
      console.log('%c[MFA Validate] ✓ PIN válido!', 'color:#33ff33;font-weight:bold;');
      mostrarPinSucesso(inputs, feedback);
    } else {
      const mensagem = data.erro || 'Código incorreto. Tente novamente.';
      console.warn('[MFA Validate] ✗ PIN inválido:', mensagem);
      mostrarPinErro(inputs, feedback, mensagem);
    }
  } catch (err) {
    console.error('[MFA Validate] Exceção:', err.message, err.stack);
    mostrarPinErro(inputs, feedback, `Erro de conexão: ${err.message}`);
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 12 15 16 10"/></svg> Confirmar Saque`;
    _mfaValidando = false;
  }
}


function mostrarPinSucesso(inputs, feedback) {
  inputs.forEach(inp => {
    inp.classList.remove('error');
    inp.classList.add('success');
  });
  feedback.textContent = 'Código verificado com sucesso';
  feedback.className = 'mfa-feedback show success';

  setTimeout(() => {
    closeModal('modal-mfa-pin');
    limparEstadoMFA();
    executarSaqueReal();
  }, 800);
}

function mostrarPinErro(inputs, feedback, mensagem = 'Código incorreto. Tente novamente.') {
  inputs.forEach(inp => {
    inp.classList.remove('filled', 'success');
    inp.classList.add('error');
  });
  feedback.textContent = mensagem;
  feedback.className = 'mfa-feedback show error';

  // Limpar inputs após animação shake
  setTimeout(() => {
    inputs.forEach(inp => {
      inp.value = '';
      inp.classList.remove('error');
    });
    inputs[0]?.focus();
    $('btn-mfa-confirm').disabled = true;
  }, 600);
}

// ═══════════════════════════════════════════════════════════════
// EXECUTAR SAQUE REAL — Após validação MFA bem-sucedida
// ═══════════════════════════════════════════════════════════════
async function executarSaqueReal() {
  const btn = $('btn-confirmar-saque');

  // ── Modo demo (fallback para testes e saldo insuficiente) ──
  if (!state.userRef || state.modoDemo) {
    const protocolo = gerarProtocolo();
    const valorDemo = state.saqueValor || state.userData?.cashback || 0;
    
    // Atualizar saldo localmente para refletir na interface
    if (state.userData) {
      state.userData.cashback = Math.max(0, (state.userData.cashback || 0) - valorDemo);
      updateUI(state.userData);
    }
    
    lançarConfetti({ duration: 3000 });
    toast(`Saque de ${moeda(valorDemo)} simulado! (Modo Demo)`, 'success');
    state.notificacoes.unshift({ 
      id: Date.now().toString(), 
      tipo: 'saque', 
      icone: '', 
      titulo: `Resgate de ${moeda(valorDemo)} solicitado`, 
      mensagem: `Seu resgate via ${(state.saqueMetodo || '').toUpperCase()} foi processado. Protocolo: ${protocolo}`, 
      protocolo, 
      lida: false 
    });
    
    const nome  = state.userData?.nome || state.currentUser?.displayName || 'Usuário';
    const plano = state.userData?.plano || 'basic';
    abrirComprovante({ valor: valorDemo, metodo: state.saqueMetodo || 'pix', nome, plano, protocolo });
    
    btn.disabled = false;
    btn.innerHTML = 'Confirmar resgate ↗';
    return;
  }

  // ── Modo real (Firebase) ──
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Processando...';
  try {
    let saldoResgatado = state.saqueValor, planoUsuario = 'basic', nomeUsuario = '';
    const protocolo = gerarProtocolo();
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(state.userRef);
      if (!snap.exists()) throw new Error('Usuário não encontrado');
      const dados = snap.data();
      const cashbackDisponivel = dados.cashback || 0;
      planoUsuario   = dados.plano    || 'basic';
      nomeUsuario    = dados.nome     || '';
      const limites  = SAQUE_LIMITES[dados.plano || 'basic'] || SAQUE_LIMITES.basic;
      const minimo   = limites.min;
      const maxDiario = limites.maxDiario;
      
      if (saldoResgatado < minimo) throw new Error(`Saldo mínimo para saque é ${moeda(minimo)}`);
      if (saldoResgatado > cashbackDisponivel) throw new Error('Saldo insuficiente para realizar este resgate.');
      if (saldoResgatado > maxDiario) throw new Error(`O limite máximo diário de resgate para seu plano é ${moeda(maxDiario)}.`);

      transaction.update(state.userRef, { 
        cashback: increment(-saldoResgatado), 
        totalResgatado: increment(saldoResgatado), 
        ultimoSaque: saldoResgatado, 
        dataSaque: new Date().toISOString() 
      });
    });
    lançarConfetti({ duration: 3000 });
    toast(`Resgate de ${moeda(saldoResgatado)} confirmado! Protocolo: ${protocolo}`, 'success');
    const metodoLabels = { pix: 'Pix', ted: 'TED bancário', desconto: 'Desconto na fatura' };
    await salvarNotificacao({ tipo: 'saque', icone: '', titulo: `Resgate de ${moeda(saldoResgatado)} solicitado`, mensagem: `Seu resgate via ${metodoLabels[state.saqueMetodo] || state.saqueMetodo} foi registrado. Prazo: até 3 dias úteis. Protocolo: ${protocolo}`, protocolo });
    abrirComprovante({ valor: saldoResgatado, metodo: state.saqueMetodo, nome: nomeUsuario || state.currentUser?.displayName || 'Usuário', plano: planoUsuario, protocolo });
  } catch (err) {
    const errMessages = { 'Saldo insuficiente': 'Saldo insuficiente para saque. Continue acumulando!', 'Usuário não encontrado': 'Sessão expirada. Faça login novamente.' };
    toast(errMessages[err.message] || err.message || 'Erro ao processar. Tente novamente.', 'error');
  }
  btn.disabled = false;
  btn.innerHTML = 'Confirmar resgate →';
}

// ═══════════════════════════════════════════════════════════════
// EXTRATO COM BUSCA + EXPORT CSV
// ═══════════════════════════════════════════════════════════════
const extratoFiltro = { cat: 'todos', busca: '' };
let buscaTimer;
$('extrato-busca')?.addEventListener('input', (e) => {
  clearTimeout(buscaTimer);
  buscaTimer = setTimeout(() => {
    extratoFiltro.busca = e.target.value.trim().toLowerCase();
    renderExtrato(extratoFiltro.cat, extratoFiltro.busca);
  }, 180);
});

document.querySelector('.extrato-filters')?.addEventListener('click', (e) => {
  const chip = e.target.closest('.ef-chip');
  if (!chip) return;
  document.querySelectorAll('.ef-chip').forEach(c => c.classList.remove('on'));
  chip.classList.add('on');
  extratoFiltro.cat = chip.dataset.cat;
  renderExtrato(extratoFiltro.cat, extratoFiltro.busca);
});

$('btn-export-csv')?.addEventListener('click', () => {
  if (!state.allTxs.length) { toast('Nenhuma transação para exportar.', 'warning'); return; }
  const linhas = [
    ['Parceiro', 'Categoria', 'Data', 'Valor (R$)', 'Cashback (R$)'].join(';'),
    ...state.allTxs.map(t => [t.nome, t.cat, t.data, t.valor.toFixed(2).replace('.', ','), (t.valor * t.cashPct).toFixed(2).replace('.', ',')].join(';')),
  ];
  const blob = new Blob(['\uFEFF' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `extrato_promo_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast('Extrato exportado com sucesso!', 'success');
});

function renderExtrato(cat, busca = '') {
  let filtered = state.allTxs;
  if (cat !== 'todos') filtered = filtered.filter(t => t.cat === cat);
  if (busca) filtered = filtered.filter(t =>
    t.nome.toLowerCase().includes(busca) ||
    t.cat.toLowerCase().includes(busca)  ||
    moeda(t.valor).includes(busca)
  );
  const totalGasto = filtered.reduce((a, t) => a + t.valor, 0);
  const totalCash  = filtered.reduce((a, t) => a + t.valor * t.cashPct, 0);
  setText('et-total-gasto', moeda(totalGasto));
  setText('et-total-cash',  moeda(totalCash));
  setText('et-total-tx',    filtered.length);
  const el = $('extrato-list');
  if (!el) return;
  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state"><div class="es-icon">${busca ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' : ''}</div><h3>${busca ? 'Nenhum resultado para "' + busca + '"' : 'Nenhuma transação nessa categoria'}</h3><p>${busca ? 'Tente outro termo de busca.' : 'Experimente outro filtro ou use o Modo Demo.'}</p></div>`;
    return;
  }
  el.innerHTML = filtered.map(t => `
    <div class="tx-row">
      <div class="tx-ico">${txIconSVG(t.cat)}</div>
      <div><div class="tx-name">${esc(t.nome)}</div><div class="tx-date">${esc(t.data)}</div><span class="tx-tag ${esc(t.tag)}">${esc(t.cat)}</span></div>
      <div class="tx-right"><div class="tx-spent">${moeda(t.valor)}</div><div class="tx-cash">+${moeda(t.valor * t.cashPct)} cashback</div></div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════════
// TX ICON SVG
// ═══════════════════════════════════════════════════════════════
function txIconSVG(cat) {
  const icons = {
    'Supermercado': `<svg viewBox="0 0 24 24" style="color:#D4A800"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
    'Farmácia':     `<svg viewBox="0 0 24 24" style="color:#7C5CFC"><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 0 1-2 2zm14-8H4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8z"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="9" y1="11" x2="15" y2="11"/></svg>`,
    'Restaurante':  `<svg viewBox="0 0 24 24" style="color:#E87722"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`,
    'Combustível':  `<svg viewBox="0 0 24 24" style="color:#18B96A"><path d="M3 22V9a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v13"/><line x1="3" y1="22" x2="15" y2="22"/><path d="M15 11h2a2 2 0 0 1 2 2v7a1 1 0 0 0 1 1h1"/><path d="M15 5l4 4"/></svg>`,
  };
  return icons[cat] || `<svg viewBox="0 0 24 24" style="color:var(--text-muted)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
}

// ═══════════════════════════════════════════════════════════════
// CUPONS
// ═══════════════════════════════════════════════════════════════
const CUPONS_DATA = [
  { emoji:'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>', titulo:'10% off MercadoFácil', desc:'Desconto em compras acima de R$150.', codigo:'PLUS10MERCA', exp:'31/05/2025', usado: false, novo: true },
  { emoji:'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19 2c-2-2-4-2-5.5-.5L10 5 1.8 6.2l4.8 4.8-1 5.2 5.2-1 4.8 4.8z"/></svg>', titulo:'Milhas em dobro AirFlex', desc:'Milhas duplas na próxima passagem.', codigo:'MILHAPLUS2X', exp:'30/04/2025', usado: false, novo: true },
  { emoji:'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/><circle cx="18" cy="18" r="3"/><path d="M20.5 15.5 15.5 20.5"/></svg>', titulo:'15% FarmaVida', desc:'15% em qualquer compra na FarmaVida.', codigo:'FARM15OFF', exp:'15/04/2025', usado: true, novo: false },
  { emoji:'', titulo:'Frete grátis BomGarfo', desc:'Delivery gratuito este mês.', codigo:'FRETEGRATIS', exp:'30/04/2025', usado: false, novo: false },
];

function renderCupons(plano) {
  const grid   = $('cupons-grid');
  if (!grid) return;
  const cupons = plano === 'premium' ? CUPONS_DATA : CUPONS_DATA.slice(0, 2);
  const ativos = cupons.filter(c => !c.usado).length;
  setText('sb-cupons-badge', ativos);
  grid.innerHTML = cupons.map(c => `
    <div class="cupon-card ${c.usado ? 'usado' : ''}">
      ${c.novo  ? '<div class="cupon-badge">NOVO</div>' : ''}
      ${c.usado ? '<div class="cupon-badge exp">USADO</div>' : ''}
      <div class="cupon-emoji">${c.emoji}</div>
      <div class="cupon-title">${esc(c.titulo)}</div>
      <div class="cupon-desc">${esc(c.desc)}</div>
      ${!c.usado ? `<div class="cupon-code">${esc(c.codigo)}</div><button class="btn btn-ghost btn-sm" style="margin-top:10px;width:100%" data-copiar="${esc(c.codigo)}"> Copiar código</button>` : ''}
      <div class="cupon-exp">⏰ Válido até ${esc(c.exp)}</div>
    </div>`).join('');
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copiar]');
    if (btn) navigator.clipboard.writeText(btn.dataset.copiar).then(() => toast(`Código ${btn.dataset.copiar} copiado!`, 'success'));
  });
}

// ═══════════════════════════════════════════════════════════════
// TRANSAÇÕES DEMO
// ═══════════════════════════════════════════════════════════════
function gerarTxDemo(gastoSuper, gastoFarm, gastoRest, gastoComb, plano) {
  const rates = getPlanRates(plano);
  const tx = [];
  if (gastoSuper > 0) {
    tx.push({ nome:'MercadoFácil', cat:'Supermercado', tag:'tx-tag-super', data:'Hoje, 09:32',   valor: gastoSuper*0.4, cashPct: rates.super });
    tx.push({ nome:'FreshMart',    cat:'Supermercado', tag:'tx-tag-super', data:'Ontem, 18:15',  valor: gastoSuper*0.3, cashPct: rates.super });
    tx.push({ nome:'CompraFlex',   cat:'Supermercado', tag:'tx-tag-super', data:'3 dias atrás', valor: gastoSuper*0.3, cashPct: rates.super });
  }
  if (gastoFarm > 0) {
    tx.push({ nome:'FarmaVida',    cat:'Farmácia', tag:'tx-tag-farm', data:'Ontem, 14:15',       valor: gastoFarm*0.6, cashPct: rates.farm });
    tx.push({ nome:'SaúdeExpress', cat:'Farmácia', tag:'tx-tag-farm', data:'5 dias atrás',       valor: gastoFarm*0.4, cashPct: rates.farm });
  }
  if (gastoRest > 0) {
    tx.push({ nome:'BomGarfo',     cat:'Restaurante', tag:'tx-tag-rest', data:'2 dias atrás',    valor: gastoRest*0.5, cashPct: rates.rest });
    tx.push({ nome:'DelivExpress', cat:'Restaurante', tag:'tx-tag-rest', data:'4 dias atrás',    valor: gastoRest*0.3, cashPct: rates.rest });
  }
  if (gastoComb > 0) {
    tx.push({ nome:'PetroPrime',   cat:'Combustível', tag:'tx-tag-comb', data:'3 dias atrás',    valor: gastoComb*0.55, cashPct: rates.comb });
  }
  return tx;
}

function renderTxHTML(txs) {
  if (!txs.length) return `<div class="empty-state"><div class="es-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></div><h3>Nenhuma transação ainda</h3><p>Use o Modo Demo para simular compras.</p></div>`;
  return txs.map((t, i) => `
    <div class="tx-row" style="animation: fadeSlideUp 0.48s ${0.05 + i * 0.07}s cubic-bezier(0.22,1,0.36,1) both; opacity:0">
      <div class="tx-ico">${txIconSVG(t.cat)}</div>
      <div><div class="tx-name">${esc(t.nome)}</div><div class="tx-date">${esc(t.data)}</div><span class="tx-tag ${esc(t.tag)}">${esc(t.cat)}</span></div>
      <div class="tx-right"><div class="tx-spent">${moeda(t.valor)}</div><div class="tx-cash">+${moeda(t.valor * t.cashPct)} cashback</div></div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════════
// GRÁFICOS
// ═══════════════════════════════════════════════════════════════
function renderBars(cashMes) {
  const base   = cashMes || 40;
  const vals   = [0.45, 0.62, 0.43, 0.77, 0.58, 1].map(m => Math.round(base * m));
  const max    = Math.max(...vals);
  const labels = ['Out','Nov','Dez','Jan','Fev','Mar'];
  const el     = $('bar-chart');
  if (!el) return;
  el.innerHTML = vals.map((v, i) => `
    <div class="bar-w">
      <div style="font-size:9px;color:var(--text-muted);margin-bottom:2px">${moeda(v)}</div>
      <div class="bar-fill ${i===5?'cur':'prev'}" style="height:${Math.round((v/max)*100)}px"></div>
      <div class="bar-lbl ${i===5?'cur':''}">${labels[i]}</div>
    </div>`).join('');
}

function renderDonut(gastoSuper, gastoFarm, gastoRest, gastoComb) {
  const total  = gastoSuper + gastoFarm + gastoRest + gastoComb || 1;
  const circum = 226.2;
  const pcts   = { super: gastoSuper/total, farm: gastoFarm/total, rest: gastoRest/total, comb: gastoComb/total };
  let offset   = 0;
  ['super','rest','farm','comb'].forEach(cat => {
    const dash = pcts[cat] * circum;
    const el   = $(`dc-${cat}`);
    if (el) {
      el.setAttribute('stroke-dasharray', `${dash.toFixed(1)} ${(circum - dash).toFixed(1)}`);
      el.setAttribute('stroke-dashoffset', (-offset).toFixed(1));
      offset += dash;
    }
    setText(`dp-${cat}`, `${Math.round(pcts[cat]*100)}%`);
  });
}

// ═══════════════════════════════════════════════════════════════
// ALERTAS
// ═══════════════════════════════════════════════════════════════
function renderAlertas(d) {
  const wrap  = $('alertas-wrap');
  if (!wrap) return;
  const nivel = calcNivel(d.pontos || 0);
  const alerts = [];
  if ((d.cashback||0) > 0 && (d.cashback||0) < 20)
    alerts.push({ icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`, msg: `Você está a ${moeda(20-(d.cashback||0))} do mínimo para saque!` });
  if (d.plano === 'basic')
    alerts.push({ icon: `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`, msg: 'Upgrade para o Plus: o dobro de cashback por R$20/mês a mais.' });
  if (nivel.pct >= 80)
    alerts.push({ icon: `<svg viewBox="0 0 24 24"><polyline points="17 21 17 13"/><polyline points="12 21 12 9"/><polyline points="7 21 7 17"/></svg>`, msg: `Você está a ${100-nivel.pct}% de subir para o próximo nível!` });
  wrap.innerHTML = alerts.map(a => `<div class="alert-row"><div class="alert-icon">${a.icon}</div><div>${a.msg}</div></div>`).join('');
}

// ═══════════════════════════════════════════════════════════════
// UPDATE UI
// ═══════════════════════════════════════════════════════════════
function updateUI(userData) {
  state.userData = userData;
  const plano = userData.plano || 'basic';
  const rates = getPlanRates(plano);
  
  const gastoSuper = userData.gastoSuper || 0;
  const gastoFarm = userData.gastoFarm || 0;
  const gastoRest = userData.gastoRest || 0;
  const gastoComb = userData.gastoComb || 0;
  const totalGasto = gastoSuper + gastoFarm + gastoRest + gastoComb;
  const cashMes = gastoSuper*rates.super + gastoFarm*rates.farm + gastoRest*rates.rest + gastoComb*rates.comb;

  updateFinancialCounters(userData, totalGasto);
  updateUserLevelProgress(userData, plano);
  renderDashboardCharts(gastoSuper, gastoFarm, gastoRest, gastoComb, cashMes, userData);
  renderRecentTransactions(gastoSuper, gastoFarm, gastoRest, gastoComb, totalGasto, plano);
  updateReferralSection(userData);
  
  renderCupons(plano);
  renderAlertas(userData);
}

function updateFinancialCounters(userData, totalGasto) {
  animateCounter('kpi-cashback',      userData.cashback || 0,               { isCurrency: true,  duration: 1100 });
  animateCounter('kpi-milhas',        userData.milhas   || 0,               { isCurrency: false, duration: 900  });
  animateCounter('kpi-gasto',         totalGasto || userData.gastoMes || 0, { isCurrency: true,  duration: 950  });
  animateCounter('saque-val-display', userData.cashback || 0,               { isCurrency: true,  duration: 600  });

  const prevCash = state.userData._prevCash;
  if (prevCash !== undefined && prevCash !== userData.cashback) flashKPI('kpi-cashback');
  state.userData._prevCash = userData.cashback;
  
  setText('kpi-tx', `${userData.numTx || 0} transações`);
  setText('rh-saldo',  moeda(userData.cashback || 0));
  setText('mc-milhas', (userData.milhas || 0).toLocaleString('pt-BR'));
}

function updateUserLevelProgress(userData, plano) {
  const planLabels = { basic:'<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polygon points=\"13 2 3 14 12 14 11 22 21 10 12 10 13 2\"/></svg> Plano Basic', plus:'<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polygon points=\"12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2\"/></svg> Plano Plus', premium:'<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"8 22 12 17 16 22\"/><path d=\"M17 2H7a2 2 0 0 0 0 4h10a2 2 0 0 0 0-4z\"/><path d=\"M12 17V6\"/></svg> Plano Premium' };
  const el = $('sb-plano');
  if (el) el.innerHTML = planLabels[plano] || '—';

  const nivel = calcNivel(userData.pontos || 0);
  const nivelAnterior = state.nivelAnterior;
  if (nivelAnterior && nivelAnterior !== nivel.nome) {
    lançarConfetti({ duration: 4000 });
    toast(`Parabéns! Você subiu para ${nivel.nome}!`, 'success');
    salvarNotificacao({ tipo: 'nivel', icone: '', titulo: `Novo nível desbloqueado: ${nivel.nome}!`, mensagem: `Parabéns! Você subiu para o nível ${nivel.nome} e desbloqueou novos benefícios.` });
  }
  state.nivelAnterior = nivel.nome;

  setText('kpi-nivel',     nivel.nome);
  setText('kpi-nivel-sub', `${nivel.pct}% para o próximo`);
  setText('lv-badge',      nivel.nome);
  const lvFill = $('lv-fill');
  if (lvFill) lvFill.style.width = nivel.pct + '%';
  setText('lv-pts', `${userData.pontos || 0} pts`);
  const proxIdx   = NIVEIS.findIndex(n => n.nome === nivel.nome) + 1;
  const proxNivel = NIVEIS[proxIdx];
  setText('lv-next', proxNivel ? `Próximo: ${proxNivel.nome} (${nivel.max} pts)` : 'Nível máximo!');
  
  const chipsEl = $('nivel-chips');
  if (chipsEl) chipsEl.innerHTML = nivel.chips.map((c, i) => `<div class="nivel-chip ${i < 2 ? 'unlocked' : ''}">${i < 2 ? ' ' : ''}${c}</div>`).join('');
}

function renderDashboardCharts(gastoSuper, gastoFarm, gastoRest, gastoComb, cashMes, userData) {
  renderBars(cashMes || userData.cashbackMes || 40);
  renderDonut(gastoSuper, gastoFarm, gastoRest, gastoComb);
}

function renderRecentTransactions(gastoSuper, gastoFarm, gastoRest, gastoComb, totalGasto, plano) {
  state.allTxs = totalGasto > 0 ? gerarTxDemo(gastoSuper, gastoFarm, gastoRest, gastoComb, plano) : gerarTxDemo(600, 300, 400, 250, plano);
  const txDash = $('tx-list-dash');
  if (txDash) txDash.innerHTML = renderTxHTML(state.allTxs.slice(0, 5));
}

function updateReferralSection(userData) {
  const uid = state.currentUID || '';
  setText('indic-link',   `maispromo.site/ref/${uid.slice(0, 8)}`);
  setText('is-indicados', userData.indicados || 0);
  setText('is-ganho',     moeda((userData.indicados || 0) * 15));
  setText('is-pendentes', userData.pendentes || 0);
}

// ═══════════════════════════════════════════════════════════════
// MODO DEMO — agora também dispara Vitrine IA
// ═══════════════════════════════════════════════════════════════
$('btn-aplicar-demo')?.addEventListener('click', () => {
  const d = {
    nome:       state.userData.nome || 'Demo',
    plano:      $('d-plano').value,
    cashback:   parseFloat($('d-cashback').value) || 0,
    milhas:     parseInt($('d-milhas').value)     || 0,
    gastoSuper: parseFloat($('d-super').value)    || 0,
    gastoFarm:  parseFloat($('d-farm').value)     || 0,
    gastoRest:  parseFloat($('d-rest').value)     || 0,
    gastoComb:  parseFloat($('d-comb').value)     || 0,
    pontos:     parseInt($('d-pontos').value)      || 0,
  };
  state.modoDemo = true;
  Object.assign(state.userData, d);
  updateUI(state.userData);
  closeModal('modal-demo');
  toast('Dados de demonstração aplicados! Abrindo vitrine IA…', 'success');
  // Reseta cache da vitrine e navega para ela
  vitrineState.dados = null;
  const catBtn = document.querySelector('[data-view="catalogo"]');
  showView('catalogo', catBtn);
});

$('btn-resetar-demo')?.addEventListener('click', () => {
  state.modoDemo = false;
  vitrineState.dados = null;
  if (state.userData) updateUI(state.userData);
  closeModal('modal-demo');
  toast('Exibindo dados reais do Firebase.', '');
});

const demoInputIds = ['d-super','d-farm','d-rest','d-comb','d-plano','d-cashback','d-milhas','d-pontos'];
demoInputIds.forEach(id => { $(id)?.addEventListener('input', atualizarPreviewDemo); });

function atualizarPreviewDemo() {
  const plano = $('d-plano')?.value || 'plus';
  const r     = getPlanRates(plano);
  const gastoSuper = parseFloat($('d-super')?.value) || 0;
  const gastoFarm  = parseFloat($('d-farm')?.value)  || 0;
  const gastoRest  = parseFloat($('d-rest')?.value)  || 0;
  const gastoComb  = parseFloat($('d-comb')?.value)  || 0;
  const total = gastoSuper*r.super + gastoFarm*r.farm + gastoRest*r.rest + gastoComb*r.comb;
  const el    = $('demo-preview');
  if (!el) return;
  el.innerHTML = `
    <div class="dr-title">Cashback — Plano ${plano.charAt(0).toUpperCase() + plano.slice(1)}</div>
    <div class="dr-row"><span>Supermercado (${r.super*100}%)</span><span class="dr-val">+${moeda(gastoSuper*r.super)}</span></div>
    <div class="dr-row"><span>Farmácia (${r.farm*100}%)</span><span class="dr-val">+${moeda(gastoFarm*r.farm)}</span></div>
    <div class="dr-row"><span>Restaurantes (${r.rest*100}%)</span><span class="dr-val">+${moeda(gastoRest*r.rest)}</span></div>
    <div class="dr-row"><span>Combustível (${r.comb*100}%)</span><span class="dr-val">+${moeda(gastoComb*r.comb)}</span></div>
    <div class="dr-row"><span>Total/mês</span><span class="dr-val" style="color:#18B96A">+${moeda(total)}</span></div>`;
}
atualizarPreviewDemo();

// ═══════════════════════════════════════════════════════════════
// INDICAÇÕES
// ═══════════════════════════════════════════════════════════════
$('btn-copiar-link')?.addEventListener('click', copiarLink);
$('btn-copiar-link-2')?.addEventListener('click', copiarLink);
$('btn-whatsapp')?.addEventListener('click', () => {
  const link = $('indic-link')?.textContent;
  const msg  = encodeURIComponent(`Oi! Uso o +Promo e já recuperei dinheiro do supermercado e farmácia. Cria sua conta: ${link}`);
  window.open(`https://wa.me/?text=${msg}`, '_blank');
});
function copiarLink() {
  const link = $('indic-link')?.textContent;
  navigator.clipboard.writeText(link).then(() => toast('Link copiado!', 'success'));
}
$('btn-transferir-milhas')?.addEventListener('click', () => toast('Transferência de milhas em breve!', ''));

// ═══════════════════════════════════════════════════════════════
// AUTH + FIREBASE
// ═══════════════════════════════════════════════════════════════
window.addEventListener('load', () => $('page-loader')?.classList.add('hide'));
showSkeletons();

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login'; return; }

  // ── GATE: Verificacao de e-mail ──────────────────────────
  // Usuarios Google ja vem verificados; apenas e-mail/senha precisa
  const isPasswordUser = user.providerData.some(p => p.providerId === 'password');
  const isGoogleUser   = user.providerData.some(p => p.providerId === 'google.com');

  if (!user.emailVerified && isPasswordUser && !isGoogleUser) {
    const gate = $('verify-gate');
    if (gate) {
      gate.style.display = 'flex';
      setText('verify-email-display', user.email || '---');

      // Verificar agora (reload token)
      $('btn-verify-check')?.addEventListener('click', async () => {
        const btn = $('btn-verify-check');
        const fb  = $('verify-feedback');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Verificando...';
        try {
          await user.reload();
          if (auth.currentUser.emailVerified) {
            fb.className = 'verify-feedback show success';
            fb.textContent = 'E-mail verificado com sucesso! Carregando dashboard...';
            setTimeout(() => window.location.reload(), 1200);
          } else {
            fb.className = 'verify-feedback show warning';
            fb.textContent = 'E-mail ainda nao verificado. Verifique sua caixa de entrada e clique no link antes de tentar novamente.';
            btn.disabled = false;
            btn.textContent = 'Verificar agora';
          }
        } catch (err) {
          console.error("[DEBUG AUTH] Falha ao verificar status do e-mail:", err);
          fb.className = 'verify-feedback show error';
          fb.textContent = 'Erro de conexao. Tente novamente.';
          btn.disabled = false;
          btn.textContent = 'Verificar agora';
        }
      });

      // Reenviar link
      $('btn-verify-resend')?.addEventListener('click', async () => {
        const btn = $('btn-verify-resend');
        const fb  = $('verify-feedback');
        btn.disabled = true;
        try {
          await sendEmailVerification(user);
          fb.className = 'verify-feedback show success';
          fb.textContent = 'Novo link enviado! Verifique sua caixa de entrada e pasta de spam.';
          setTimeout(() => { btn.disabled = false; }, 30000);
        } catch (err) {
          console.error("[DEBUG AUTH] Falha ao reenviar link de e-mail:", err);
          if (err.code === 'auth/too-many-requests') {
            fb.className = 'verify-feedback show warning';
            fb.textContent = 'Muitas solicitacoes. Aguarde alguns minutos antes de tentar novamente.';
          } else {
            fb.className = 'verify-feedback show error';
            fb.textContent = 'Erro ao reenviar. Tente novamente em alguns instantes.';
          }
          setTimeout(() => { btn.disabled = false; }, 10000);
        }
      });

      // Sair
      $('btn-verify-logout')?.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = '/login';
      });
    }
    $('page-loader')?.classList.add('hide');
    return;
  }
  // ── FIM do gate ──────────────────────────────────────────

  state.currentUID  = user.uid;
  state.currentUser = user;
  const nomeCompleto = user.displayName || user.email || 'Usuário';
  const primeiroNome = nomeCompleto.split(' ')[0];
  const iniciais     = nomeCompleto.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  setText('sb-avatar',     iniciais);
  setText('sb-nome',       primeiroNome);
  setText('dash-greeting', `Olá, ${primeiroNome}!`);

  const ADMIN_EMAILS = ['sacmaispromo@gmail.com'];
  const demoBanner   = document.querySelector('.demo-banner');
  if (demoBanner) demoBanner.style.display = ADMIN_EMAILS.includes(user.email) ? 'flex' : 'none';

  const userRef = doc(db, 'usuarios', user.uid);
  state.userRef = userRef;
  iniciarEscutaNotificacoes();

  onSnapshot(userRef, (snap) => {
    if (state.modoDemo) return;
    hideSkeletons();
    if (!snap.exists()) {
      setDoc(userRef, { nome: nomeCompleto, email: user.email, plano: 'basic', cashback: 0, milhas: 0, nivel: 'Iniciante', pontos: 0, gastoMes: 0, cashbackMes: 0, numTx: 0, ativo: true, criadoEm: serverTimestamp() });
      return;
    }
    state.userData = snap.data();
    updateUI(state.userData);
  }, (error) => {
    if (error.code === 'unavailable') toast('Dados do cache. Reconectando...', '');
  });
});

// ═══════════════════════════════════════════════════════════════
// MENU MOBILE + LOGOUT + TEMA
// ═══════════════════════════════════════════════════════════════
$('menu-toggle')?.addEventListener('click', () => toggleSidebar());

$('btn-logout')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = '/login';
});

const themeToggle = $('theme-toggle');
if (themeToggle) {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  themeToggle.checked = saved === 'dark';
  themeToggle.addEventListener('change', () => {
    const t = themeToggle.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
  });
}

// ═══════════════════════════════════════════════════════════════
// DEFINICOES — Painel de Perfil e Alteracao de E-mail
// ═══════════════════════════════════════════════════════════════

// Popula a view de seguranca quando a aba e carregada
function populateSettingsView(user) {
  // Truncar para design seguro: fe***@gmail.com
  let maskedEmail = user.email || '---';
  if (user.email && user.email.includes('@')) {
    const [name, domain] = user.email.split('@');
    if (name.length > 3) maskedEmail = `${name.substring(0, 2)}***@${domain}`;
    else maskedEmail = `${name.substring(0, 1)}***@${domain}`;
  }
  setText('settings-email', maskedEmail);

  // Status de verificacao
  const statusEl = $('settings-verify-status');
  if (statusEl) {
    const isVerified = user.emailVerified;
    statusEl.className = `settings-verify-status ${isVerified ? 'verified' : 'unverified'}`;
    const dot  = statusEl.querySelector('.verify-status-dot');
    const text = statusEl.querySelector('.verify-status-text');
    if (text) text.textContent = isVerified ? 'E-mail verificado' : 'E-mail nao verificado';
  }

  // Provedor de login
  const providers = user.providerData.map(p => {
    if (p.providerId === 'password')    return 'E-mail e Senha';
    if (p.providerId === 'google.com')  return 'Google';
    return p.providerId;
  });
  setText('settings-provider', providers.join(', ') || '---');

  // Ultimo acesso
  const lastLogin = user.metadata?.lastSignInTime;
  if (lastLogin) {
    const d = new Date(lastLogin);
    setText('settings-last-login', d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }));
  }

  // Esconder secao de alteracao de e-mail para usuarios Google-only
  const isPasswordUser = user.providerData.some(p => p.providerId === 'password');
  const actionRow = $('email-action-row');
  const editPanel = $('sc-email-edit');
  if (actionRow && editPanel) {
    if (!isPasswordUser) {
      actionRow.style.display = 'none';
      editPanel.style.display = 'none';
    } else {
      actionRow.style.display = 'flex';
      // Mapeia toggle do botao de alterar e-mail
      $('btn-toggle-email-edit').onclick = () => {
        actionRow.style.display = 'none';
        editPanel.style.display = 'block';
      };
      // Mapeia cancelamento
      $('btn-cancel-email-edit').onclick = () => {
        actionRow.style.display = 'flex';
        editPanel.style.display = 'none';
        $('settings-new-email').value = '';
        $('settings-email-feedback').className = 'settings-feedback';
      };
    }
  }
}

// Estado para o fluxo de re-auth + alteracao de e-mail
let pendingNewEmail = null;

// Botao "Solicitar alteracao de e-mail"
$('btn-change-email')?.addEventListener('click', () => {
  const newEmail = $('settings-new-email')?.value.trim();
  const fb = $('settings-email-feedback');

  if (!newEmail) {
    fb.className = 'settings-feedback show error';
    fb.textContent = 'Informe o novo endereco de e-mail.';
    return;
  }

  if (newEmail === auth.currentUser?.email) {
    fb.className = 'settings-feedback show error';
    fb.textContent = 'O novo e-mail deve ser diferente do atual.';
    return;
  }

  // Verificar se a sessao e recente o suficiente
  // Firebase lanca auth/requires-recent-login se a sessao for antiga
  // Proativamente pedimos re-auth para seguranca
  const isPasswordUser = auth.currentUser?.providerData.some(p => p.providerId === 'password');
  if (isPasswordUser) {
    pendingNewEmail = newEmail;
    $('reauth-password').value = '';
    $('reauth-feedback').className = 'settings-feedback';
    $('reauth-feedback').textContent = '';
    openModal('modal-reauth');
  } else {
    // Google user — tentar direto (pode falhar e pedir re-auth)
    executeEmailChange(newEmail);
  }
});

// Modal de reautenticacao
$('close-reauth')?.addEventListener('click', () => closeModal('modal-reauth'));

$('modal-reauth')?.addEventListener('click', (e) => {
  if (e.target === $('modal-reauth')) closeModal('modal-reauth');
});

$('btn-confirm-reauth')?.addEventListener('click', async () => {
  const password = $('reauth-password')?.value;
  const btn = $('btn-confirm-reauth');
  const fb  = $('reauth-feedback');

  if (!password) {
    fb.className = 'settings-feedback show error';
    fb.textContent = 'Informe sua senha atual.';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Confirmando...';

  try {
    const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
    await reauthenticateWithCredential(auth.currentUser, credential);
    closeModal('modal-reauth');
    // Agora executa a alteracao
    if (pendingNewEmail) {
      await executeEmailChange(pendingNewEmail);
      pendingNewEmail = null;
    }
  } catch (err) {
    const erros = {
      'auth/wrong-password':    'Senha incorreta. Tente novamente.',
      'auth/invalid-credential':'Senha incorreta. Verifique e tente novamente.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
      'auth/network-request-failed': 'Falha de conexao. Verifique sua internet.',
    };
    fb.className = 'settings-feedback show error';
    fb.textContent = erros[err.code] || 'Erro na reautenticacao. Tente novamente.';
  }

  btn.disabled = false;
  btn.textContent = 'Confirmar e continuar';
});

// Enter no campo de senha do modal de reauth
$('reauth-password')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    $('btn-confirm-reauth')?.click();
  }
});

// Executa verifyBeforeUpdateEmail
async function executeEmailChange(newEmail) {
  const fb = $('settings-email-feedback');
  const btn = $('btn-change-email');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Processando...';

  try {
    await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
    fb.className = 'settings-feedback show success';
    fb.textContent = `Link de confirmacao enviado para ${newEmail}. Verifique a caixa de entrada do novo endereco para confirmar a alteracao.`;
    $('settings-new-email').value = '';
    
    // Fechar painel
    if ($('sc-email-edit') && $('email-action-row')) {
      $('sc-email-edit').style.display = 'none';
      $('email-action-row').style.display = 'flex';
    }
    
    toast('Link de confirmacao enviado para o novo e-mail.', 'success');
    } catch (err) {
    console.error("[DEBUG AUTH] Falha no verifyBeforeUpdateEmail:", err);
    const erros = {
      'auth/requires-recent-login':   'Sessao expirada. Faca login novamente para alterar o e-mail.',
      'auth/invalid-new-email':       'O novo e-mail informado e invalido.',
      'auth/email-already-in-use':    'Este e-mail ja esta em uso por outra conta.',
      'auth/invalid-email':           'Formato de e-mail invalido.',
      'auth/too-many-requests':       'Muitas solicitacoes. Aguarde alguns minutos.',
      'auth/network-request-failed':  'Falha de conexao. Verifique sua internet.',
    };
    fb.className = 'settings-feedback show error';
    fb.textContent = erros[err.code] || `Erro ao alterar e-mail: ${err.message}`;

    // Se precisar re-auth e for usuario password, abrir modal
    if (err.code === 'auth/requires-recent-login') {
      const isPasswordUser = auth.currentUser?.providerData.some(p => p.providerId === 'password');
      if (isPasswordUser) {
        pendingNewEmail = newEmail;
        setTimeout(() => openModal('modal-reauth'), 1000);
      }
    }
  }

  btn.disabled = false;
  btn.textContent = 'Solicitar alteracao de e-mail';
}

// ═══════════════════════════════════════════════════════════════
// CATÁLOGO — estado + dados estáticos (mantidos para compatibilidade)
// ═══════════════════════════════════════════════════════════════
state.catalogo = {
  perfilAtivo:  'eu',
  interesses:   [],
  abaAtiva:     'super',
  quizCompleto: false,
  frequViajem:  null,
  objetivo:     null,
};

/* ═══════════════════════════════════════════════════════════════════════
   +PROMO — VITRINE IA — JavaScript Fintech Premium v4.0
   SVG Icons: Lucide style · stroke-width="1.5" · sem emojis
   ═══════════════════════════════════════════════════════════════════════ */


/* ─────────────────────────────────────────────────────────────────────────
   SVG ICONS LIBRARY — Lucide Icons · stroke-width="1.5" · MIT
───────────────────────────────────────────────────────────────────────── */
const ICONS = {
  /* Categorias de estabelecimentos */
  supermercado: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  farmacia:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v5"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M5 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><line x1="5" y1="11" x2="5" y2="14"/><line x1="3.5" y1="12.5" x2="6.5" y2="12.5"/></svg>`,
  restaurante:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`,
  combustivel:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v15"/><path d="M17 7h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/><path d="M3 22h16"/><rect x="6" y="10" width="6" height="4" rx="1"/></svg>`,
  moda:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.86H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.86l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>`,
  saude:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  lazer:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
  transporte:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  pin:          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>`,

  /* Arquétipos */
  viajante:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2C4.2 5.1 3.7 5.3 3.4 5.7L2 7.1 10.2 13l-2 2.4-2.6.3-.4 2 2.6.7.7 2.6 2-.4.3-2.6L13 16l5.9 8.2 1.4-1.4-.3-3.9z"/></svg>`,
  familia:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  gourmet:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" y1="17" x2="18" y2="17"/></svg>`,
  motorista:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="8" width="20" height="12" rx="2"/><path d="M6 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>`,
  urbano:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="9" height="14" rx="1"/><rect x="13" y="3" width="9" height="18" rx="1"/><path d="M6 7V5"/></svg>`,
  generico:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
  loading:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 9l3 3 4-5"/></svg>`,

  /* Reward icons */
  star:         `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  starOutline:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  bolt:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  gift:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`,
  trophy:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>`,
  check:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  ai:           `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 0 2h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1 0-2h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/><path d="M9 14h.01"/><path d="M15 14h.01"/><path d="M9.5 18a3.5 3.5 0 0 0 5 0"/></svg>`,
  warning:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,

  /* Star fill para ratings */
  starFill: `<svg viewBox="0 0 24 24" fill="#F7C500" stroke="none" width="10" height="10"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
};

/* Mapa de palavras-chave para ícone de categoria */
const CATEGORIA_ICON_MAP = {
  super: 'supermercado', mercado: 'supermercado', hortifruti: 'supermercado',
  farm: 'farmacia', droga: 'farmacia', saúde: 'saude', clinic: 'saude',
  rest: 'restaurante', food: 'restaurante', pizza: 'restaurante', lanche: 'restaurante',
  combus: 'combustivel', posto: 'combustivel', gasolina: 'combustivel', auto: 'combustivel',
  moda: 'moda', roupa: 'moda', fashion: 'moda', calçado: 'moda',
  transporte: 'transporte', uber: 'transporte', taxi: 'transporte',
  lazer: 'lazer', cinema: 'lazer', show: 'lazer',
};

function getCategoryIcon(texto = '') {
  const t = texto.toLowerCase();
  for (const [kw, icon] of Object.entries(CATEGORIA_ICON_MAP)) {
    if (t.includes(kw)) return icon;
  }
  return 'pin';
}

function wrapIcon(svgStr, size = 22) {
  return svgStr.replace('<svg ', `<svg width="${size}" height="${size}" `);
}


/* ─────────────────────────────────────────────────────────────────────────
   SLIDER CDI
───────────────────────────────────────────────────────────────────────── */

const CDI_RATE_ANUAL = 0.135; // 13,5% a.a.
const CDI_MULT       = 1.10;  // 110% do CDI

let _simBaseValue = 0;

const SIM_MESES_MAP = { 1: 6, 2: 12, 3: 24 };

function calcProjecao(base, meses) {
  if (!base || base <= 0) return { projetado: 0, rendimento: 0 };
  const taxaMensal = Math.pow(1 + CDI_RATE_ANUAL * CDI_MULT, 1 / 12) - 1;
  const projetado  = base * Math.pow(1 + taxaMensal, meses);
  return { projetado, rendimento: projetado - base };
}

function simUpdateUI(sliderVal) {
  const meses   = SIM_MESES_MAP[sliderVal] || 12;
  const { projetado, rendimento } = calcProjecao(_simBaseValue, meses);
  const fmtBRL  = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const elMeses = document.getElementById('sim-meses-label');
  const elValor = document.getElementById('sim-valor-projetado');
  const elRend  = document.getElementById('sim-rendimento-label');

  if (elMeses) elMeses.textContent = meses;
  if (elValor) {
    elValor.textContent = fmtBRL(projetado);
    elValor.style.opacity = '0.4';
    elValor.style.transform = 'translateY(4px)';
    requestAnimationFrame(() => {
      elValor.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
      elValor.style.opacity = '1';
      elValor.style.transform = 'translateY(0)';
    });
  }
  if (elRend) {
    elRend.textContent = rendimento > 0
      ? `+${fmtBRL(rendimento)} de rendimento`
      : 'Acumule saldo para ver a projeção';
  }

  const slider = document.getElementById('sim-slider');
  if (slider) {
    const pct = ((sliderVal - 1) / 2) * 100;
    slider.style.setProperty('--slider-pct', `${pct}%`);
  }
}

function initSimSlider() {
  const slider = document.getElementById('sim-slider');
  if (!slider) return;

  slider.addEventListener('input', () => {
    simUpdateUI(parseInt(slider.value, 10));
  });

  simUpdateUI(parseInt(slider.value, 10));
}


/* ─────────────────────────────────────────────────────────────────────────
   SHIMMER ON / OFF
───────────────────────────────────────────────────────────────────────── */
function vitrineShimmerOn() {
  const hero = document.getElementById('vitrine-hero');
  if (hero) hero.classList.add('loading');

  const shimmerBlock = `<div class="vt-shimmer-block" style="height:100px"></div>`;
  const locais  = document.getElementById('vitrine-locais-body');
  const missoes = document.getElementById('vitrine-missoes-body');
  if (locais)  locais.innerHTML  = shimmerBlock + `<div class="vt-shimmer-block" style="height:90px; margin-top:10px"></div>`;
  if (missoes) missoes.innerHTML = shimmerBlock + `<div class="vt-shimmer-block" style="height:85px; margin-top:10px"></div>`;

  const nome    = document.getElementById('vitrine-arquetipo-nome');
  const desc    = document.getElementById('vitrine-arquetipo-desc');
  const insight = document.getElementById('vitrine-arquetipo-insight-text');
  const avatar  = document.getElementById('vitrine-arquetipo-avatar');

  if (nome)    nome.textContent    = 'Analisando perfil…';
  if (desc)    desc.textContent    = 'A IA está a ler os seus padrões de gastos';
  if (insight) insight.textContent = 'Calculando potencial de cashback…';
  if (avatar)  avatar.innerHTML    = wrapIcon(ICONS.loading, 28);
}

function vitrineShimmerOff() {
  const hero = document.getElementById('vitrine-hero');
  if (hero) hero.classList.remove('loading');

  // FIX #1: ShimmerOn toca em 3 elementos; ShimmerOff deve limpar os mesmos 3.
  // Se renderLocais/renderMissoes não executarem (dados incompletos), os containers
  // ficariam eternamente com os shimmer-blocks. Esta limpeza garante estado neutro.
  const locais  = document.getElementById('vitrine-locais-body');
  const missoes = document.getElementById('vitrine-missoes-body');
  if (locais  && locais.querySelector('.vt-shimmer-block'))  locais.innerHTML  = '';
  if (missoes && missoes.querySelector('.vt-shimmer-block')) missoes.innerHTML = '';
}


/* ─────────────────────────────────────────────────────────────────────────
   RENDER PINS (locaisProximos)
   { nome, endereco, notaMaps, cashback, categoria? }
───────────────────────────────────────────────────────────────────────── */
function renderLocais(locais = []) {
  const container = document.getElementById('vitrine-locais-body');
  const navEl     = document.getElementById('vitrine-locais-nav');
  const countEl   = document.getElementById('vitrine-locais-count');
  if (!container) return;

  if (!locais.length) {
    container.innerHTML = `<p style="font-size:13px;color:var(--text-muted);padding:10px 0">Nenhum parceiro encontrado para o seu perfil.</p>`;
    return;
  }

  if (countEl) countEl.textContent = `${locais.length} sugestão${locais.length > 1 ? 'ões' : ''}`;

  function starsHTML(nota) {
    const n = parseFloat(nota) || 0;
    const full = Math.floor(n);
    const empty = 5 - full;
    return (
      Array.from({ length: full },  () => ICONS.starFill).join('') +
      Array.from({ length: empty }, () => `<svg viewBox="0 0 24 24" fill="rgba(247,197,0,0.18)" stroke="none" width="10" height="10"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`).join('')
    );
  }

  container.innerHTML = locais.map((l, i) => {
    const iconKey  = getCategoryIcon(l.categoria || l.nome || '');
    const iconHTML = wrapIcon(ICONS[iconKey] || ICONS.pin, 20);
    const cbStr    = typeof l.cashback === 'number'
      ? `${l.cashback}% cashback`
      : esc(String(l.cashback || ''));

    return `
      <div class="vt-pin-card" style="animation: vt-fadein-up 0.32s ${i * 0.06}s ease both; opacity:0">
        <div class="vt-pin-icon">${iconHTML}</div>
        <div class="vt-pin-info">
          <div class="vt-pin-name">${esc(l.nome)}</div>
          <div class="vt-pin-stars">
            ${starsHTML(l.notaMaps)}
            <span class="vt-pin-stars-val">${l.notaMaps || '—'}</span>
          </div>
          <div class="vt-pin-addr">${esc(l.endereco || '')}</div>
        </div>
        <div class="vt-pin-right">
          <div class="vt-pin-cashback">${cbStr}</div>
          <div class="vt-ai-badge">
            ${wrapIcon(ICONS.ai, 9)} IA Recomenda
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (navEl) {
    navEl.innerHTML = locais.map((_, i) =>
      `<div class="vt-nav-dot ${i === 0 ? 'on' : ''}" data-idx="${i}" role="button" aria-label="Parceiro ${i+1}"></div>`
    ).join('');

    container.querySelectorAll('.vt-pin-card').forEach((card, i) => {
      card.addEventListener('mouseenter', () => {
        navEl.querySelectorAll('.vt-nav-dot').forEach((d, j) => {
          d.classList.toggle('on', j === i);
        });
      });
    });
  }
}


/* ─────────────────────────────────────────────────────────────────────────
   RENDER METAS ATIVAS (missoesAtivas)
   { titulo, progressoAtual, progressoMeta, unidade?, recompensa }
───────────────────────────────────────────────────────────────────────── */

/* Paleta por índice — tons profissionais */
const QUEST_PALETTES = [
  {
    stroke: '#7c91b5', text: '#a0b4d0',
    chipBg: 'rgba(124,145,181,0.10)', chipBdr: 'rgba(124,145,181,0.20)',
  },
  {
    stroke: '#18B96A', text: '#3dce84',
    chipBg: 'rgba(24,185,106,0.10)', chipBdr: 'rgba(24,185,106,0.20)',
  },
  {
    stroke: '#8fa5c9', text: '#b0c4de',
    chipBg: 'rgba(143,165,201,0.10)', chipBdr: 'rgba(143,165,201,0.20)',
  },
  {
    stroke: '#5b9bd5', text: '#7ab4e8',
    chipBg: 'rgba(91,155,213,0.10)', chipBdr: 'rgba(91,155,213,0.20)',
  },
];

function renderMissoes(missoes = []) {
  const container = document.getElementById('vitrine-missoes-body');
  if (!container) return;

  if (!missoes.length) {
    container.innerHTML = `<p style="font-size:13px;color:var(--text-muted);padding:8px 0">Nenhuma meta ativa.</p>`;
    return;
  }

  container.innerHTML = missoes.map((m, i) => {
    const pal      = QUEST_PALETTES[i % QUEST_PALETTES.length];
    const atual    = parseFloat(m.progressoAtual) || 0;
    const meta     = parseFloat(m.progressoMeta)  || 100;
    const pct      = Math.min(100, Math.round((atual / meta) * 100));
    const complete = pct >= 100;

    const CIRCUM = 125.66;
    const offset = CIRCUM - (pct / 100) * CIRCUM;

    const recompStr  = String(m.recompensa || '');
    const recompIcon = recompStr.toLowerCase().includes('cashback') ? ICONS.bolt
      : recompStr.toLowerCase().includes('pontos')  ? ICONS.star
      : recompStr.toLowerCase().includes('bônus')   ? ICONS.gift
      : ICONS.trophy;

    return `
      <div class="vt-quest ${complete ? 'vt-quest--complete' : ''}"
           style="
             --quest-stroke: ${pal.stroke};
             --quest-text: ${pal.text};
             --quest-chip-bg: ${pal.chipBg};
             --quest-chip-bdr: ${pal.chipBdr};
             --ring-offset: ${offset};
             animation: vt-fadein-up 0.38s ${i * 0.09}s ease both;
             opacity: 0;
           ">

        <div class="vt-quest-ring">
          <svg viewBox="0 0 48 48">
            <circle class="vt-quest-ring-bg" cx="24" cy="24" r="20"/>
            <circle class="vt-quest-ring-fg" cx="24" cy="24" r="20"
                    style="stroke-dashoffset: ${offset}"/>
          </svg>
          <div class="vt-quest-ring-pct">${pct}%</div>
        </div>

        <div class="vt-quest-name">${esc(m.titulo || 'Meta')}</div>

        <div class="vt-quest-reward">
          <div class="vt-reward-chip">
            ${wrapIcon(recompIcon, 10)}
            ${esc(recompStr)}
          </div>
        </div>

        <div class="vt-quest-bar-wrap">
          <div class="vt-quest-bar" style="width: ${pct}%"></div>
        </div>

        ${complete ? `
          <div class="vt-quest-complete-badge" title="Meta concluída">
            ${wrapIcon(ICONS.check, 11)}
          </div>` : ''}
      </div>
    `;
  }).join('');
}


/* ─────────────────────────────────────────────────────────────────────────
   RENDER HERO (arquetipo)
───────────────────────────────────────────────────────────────────────── */
const ARQUETIPO_MAP = {
  viajante:  { icon: 'viajante',  label: 'O Viajante',       plan: 'PLUS'    },
  familia:   { icon: 'familia',   label: 'Foco na Família',   plan: 'PLUS'    },
  gourmet:   { icon: 'gourmet',   label: 'Mestre-Cuca',       plan: 'BASIC'   },
  motorista: { icon: 'motorista', label: 'O Motorista',       plan: 'PLUS'    },
  urbano:    { icon: 'urbano',    label: 'Urbano Digital',    plan: 'PREMIUM' },
};

function renderHero(arquetipo = {}) {
  const nome    = document.getElementById('vitrine-arquetipo-nome');
  const desc    = document.getElementById('vitrine-arquetipo-desc');
  const avatar  = document.getElementById('vitrine-arquetipo-avatar');
  const insight = document.getElementById('vitrine-arquetipo-insight-text');
  const plan    = document.getElementById('vitrine-vip-plan');
  const hero    = document.getElementById('vitrine-hero');

  const meta    = ARQUETIPO_MAP[(arquetipo.nome || '').toLowerCase()] || {};
  const iconKey = meta.icon || 'generico';

  if (avatar) avatar.innerHTML = wrapIcon(ICONS[iconKey] || ICONS.generico, 28);
  if (nome)   nome.textContent = arquetipo.nome || 'Perfil IA';
  if (desc)   desc.textContent = arquetipo.descricao || '';
  if (plan)   plan.textContent = (meta.plan || 'PLUS') + ' CARD';

  if (insight) {
    insight.textContent = arquetipo.insight
      || arquetipo.dica
      || 'Veja as recomendações personalizadas abaixo';
  }

  if (hero) hero.classList.remove('loading');
}


/* ─────────────────────────────────────────────────────────────────────────
   RENDER SIMULADOR (projecaoFinanceira)
   { valorProjetado, dicaAdmin? }
───────────────────────────────────────────────────────────────────────── */
function renderSimulador(proj = {}) {
  _simBaseValue = parseFloat(proj.valorProjetado) || 0;

  const dicaEl = document.getElementById('sim-dica-texto');
  if (dicaEl && proj.dicaAdmin) {
    dicaEl.textContent = proj.dicaAdmin;
  }

  const slider = document.getElementById('sim-slider');
  if (slider) {
    simUpdateUI(parseInt(slider.value, 10));
  }
}


/* ─────────────────────────────────────────────────────────────────────────
   MAIN ENTRY POINT — vitrineRenderDados()
───────────────────────────────────────────────────────────────────────── */
function vitrineRenderDados(dados) {
  try {
    vitrineShimmerOff();

    if (dados.arquetipo) renderHero(dados.arquetipo);

    // FIX #2: Guards condicionais removidos. renderLocais/renderMissoes já tratam
    // internamente o caso de array vazio (exibem placeholder "Nenhum parceiro encontrado").
    // Com o guard anterior, um payload sem essas chaves deixava os shimmer-blocks eternos.
    renderLocais(dados.locaisProximos  || []);
    renderMissoes(dados.missoesAtivas  || []);

    if (dados.projecaoFinanceira) renderSimulador(dados.projecaoFinanceira);

    vitrineState.dados     = dados;
    vitrineState.arquetipo = dados.arquetipo || null;

    toast(`Vitrine atualizada · ${dados.arquetipo?.nome || 'Perfil detectado'}`, 'success');

  } catch (err) {
    console.error('[vitrineRenderDados] Erro:', err);

    const errHTML = `
      <div class="cat-empty" style="border-color:#E53935; background:rgba(229,57,53,0.05)">
        <div class="cat-empty-icon" style="color:#E53935">${wrapIcon(ICONS.warning, 24)}</div>
        <div class="cat-empty-title" style="color:#E53935">Erro na Inteligência Artificial</div>
        <div class="cat-empty-sub" style="color:#D32F2F;font-weight:600">Detalhe: ${esc(err.message)}</div>
      </div>`;

    const locais  = document.getElementById('vitrine-locais-body');
    const missoes = document.getElementById('vitrine-missoes-body');
    if (locais)  locais.innerHTML  = errHTML;
    if (missoes) missoes.innerHTML = errHTML;

    toast('Falha na IA. Verifique o erro na tela.', 'error');
  }
}


/* ─────────────────────────────────────────────────────────────────────────
   ARQUÉTIPOS PILLS — binding para .vt-pill
───────────────────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────────
   DADOS DE DEMONSTRAÇÃO (Botões de Arquétipos Rápidos)
───────────────────────────────────────────────────────────────────────── */
const ARQUETIPOS_DEMO = {
  viajante: {
    arquetipo: { nome: "O Viajante", descricao: "Gasta mais com voos, hotéis e transporte.", insight: "Foco em milhas.", plan: "PLUS" },
    locaisProximos: [{ nome: "AirPromo", endereco: "Online", notaMaps: 4.8, cashback: 10, categoria: "transporte" }],
    missoesAtivas: [{ titulo: "Comprar 2 passagens", progressoAtual: 1, progressoMeta: 2, recompensa: "500 Milhas" }],
    projecaoFinanceira: { valorProjetado: 500, dicaAdmin: "Bom para upgrade de cabine." }
  },
  familia: {
    arquetipo: { nome: "Foco na Família", descricao: "Supermercados e farmácias.", insight: "Essenciais em alta.", plan: "PLUS" },
    locaisProximos: [{ nome: "Supermercado CompreBem", endereco: "Americana, SP", notaMaps: 4.5, cashback: 5, categoria: "supermercado" }],
    missoesAtivas: [{ titulo: "Gastar R$500 em farmácia", progressoAtual: 200, progressoMeta: 500, recompensa: "R$20 Cashback" }],
    projecaoFinanceira: { valorProjetado: 1200, dicaAdmin: "Resgate para compras do mês." }
  },
  gourmet: {
    arquetipo: { nome: "Mestre-Cuca", descricao: "Restaurantes e deliveries.", insight: "Gastronomia em foco.", plan: "BASIC" },
    locaisProximos: [{ nome: "Restaurante Sabor", endereco: "Santa Bárbara d'Oeste", notaMaps: 4.9, cashback: 15, categoria: "restaurante" }],
    missoesAtivas: [{ titulo: "Pedir 3 deliveries", progressoAtual: 2, progressoMeta: 3, recompensa: "Frete Grátis" }],
    projecaoFinanceira: { valorProjetado: 300, dicaAdmin: "Use para jantares premium." }
  },
  motorista: {
    arquetipo: { nome: "O Motorista", descricao: "Alto gasto com combustível.", insight: "Aproveite postos parceiros.", plan: "PLUS" },
    locaisProximos: [{ nome: "Posto Rápido", endereco: "Rodovia SP-304", notaMaps: 4.2, cashback: 3, categoria: "combustivel" }],
    missoesAtivas: [{ titulo: "Abastecer R$200", progressoAtual: 100, progressoMeta: 200, recompensa: "Ducha Grátis" }],
    projecaoFinanceira: { valorProjetado: 250, dicaAdmin: "Abate nos gastos do carro." }
  },
  urbano: {
    arquetipo: { nome: "Urbano Digital", descricao: "Eletrônicos, moda e apps.", insight: "Consumidor moderno.", plan: "PREMIUM" },
    locaisProximos: [{ nome: "Tech Store", endereco: "Shopping Tivoli", notaMaps: 4.7, cashback: 8, categoria: "tech" }],
    missoesAtivas: [{ titulo: "Assinar streaming", progressoAtual: 0, progressoMeta: 1, recompensa: "1 mês grátis" }],
    projecaoFinanceira: { valorProjetado: 800, dicaAdmin: "Excelente para gadjets." }
  }
};

/* ─────────────────────────────────────────────────────────────────────────
   MOTOR DA IA — INTEGRAÇÃO COM CLOUDFLARE WORKERS
───────────────────────────────────────────────────────────────────────── */
window.fetchVitrineIA = async function(userData) {
  vitrineShimmerOn();

  try {
    // ⚠️ ATENÇÃO: Substitua este link pelo URL real do seu Worker na Cloudflare
    const WORKER_URL = "https://maispromo-ia.sacmaispromo.workers.dev";

    // Se a chamada vier de um dos botões "Demo", renderiza sem bater na API
    if (userData.arquetipo) {
      setTimeout(() => vitrineRenderDados(userData), 400);
      return;
    }

    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    if (!response.ok) throw new Error('Erro na resposta do servidor IA');

    const dadosDaIA = await response.json();
    vitrineRenderDados(dadosDaIA);

  } catch (erro) {
    console.error("Falha de conexão com a IA:", erro);
    // Fallback de emergência: se a internet cair na hora da apresentação, ele mostra a demo Urbana
    vitrineRenderDados(ARQUETIPOS_DEMO.urbano);
    toast("Conexão instável. Usando cache offline.", "warning");
  }
};

/* ─────────────────────────────────────────────────────────────────────────
   ESTADO GLOBAL DA VITRINE (Correção do ReferenceError)
───────────────────────────────────────────────────────────────────────── */
window.vitrineState = {
  dados: null,
  arquetipo: null
};

/* ─────────────────────────────────────────────────────────────────────────
   ARQUÉTIPOS PILLS — binding para .vt-pill
───────────────────────────────────────────────────────────────────────── */
document.querySelectorAll('.vt-pill[data-arquetipo]').forEach(pill => {
  pill.addEventListener('click', () => {
    const id = pill.dataset.arquetipo;

    document.querySelectorAll('.vt-pill[data-arquetipo]').forEach(p => p.classList.remove('on'));
    pill.classList.add('on');

    if (id === 'eu') {
      // Correção: Usando state.userData em vez de state.user
      if (state?.userData) fetchVitrineIA(state.userData);
      return;
    }

    const demo = ARQUETIPOS_DEMO[id];
    if (demo) {
      vitrineShimmerOn();
      setTimeout(() => fetchVitrineIA(demo), 120);
    }
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   INIT — vitrineCatalogoInit()
───────────────────────────────────────────────────────────────────────── */
function vitrineCatalogoInit() {
  initSimSlider();

  if (vitrineState.dados) {
    vitrineRenderDados(vitrineState.dados);
  } else if (state?.userData && Object.keys(state.userData).length > 0) {
    // FIX #4: state.userData começa como {} (truthy mas vazio). Só dispara a API
    // quando o Firebase já resolveu e o objeto contém campos reais do utilizador,
    // evitando que o Worker receba um payload vazio e retorne uma estrutura incompleta.
    if (typeof fetchVitrineIA === 'function') {
      fetchVitrineIA(state.userData);
    } else {
      console.error("Atenção: A função fetchVitrineIA não foi encontrada! Verifique se ela não foi apagada.");
      vitrineShimmerOff();
    }
  } else {
    // Firebase ainda não resolveu ou utilizador sem dados — exibe fallback demo.
    vitrineRenderDados(ARQUETIPOS_DEMO.urbano);
  }
}

/* Expõe globalmente */
window.vitrineCatalogoInit  = vitrineCatalogoInit;
window.vitrineRenderDados   = vitrineRenderDados;
window.vitrineShimmerOn     = vitrineShimmerOn;
window.vitrineShimmerOff    = vitrineShimmerOff;

// ═══════════════════════════════════════════════════════════════
// QUIZ MODAL
// ═══════════════════════════════════════════════════════════════
let quizStep = 0;
function openQuiz() {
  quizStep = 0;
  document.querySelectorAll('.quiz-step').forEach((s, i) => s.classList.toggle('on', i === 0));
  document.querySelectorAll('.quiz-prog-dot').forEach((d, i) => d.classList.toggle('done', i === 0));
  document.querySelectorAll('.quiz-opt').forEach(o => o.classList.remove('on'));
  openModal('modal-quiz');
}
$('btn-open-quiz')?.addEventListener('click', openQuiz);
$('close-quiz')?.addEventListener('click', () => closeModal('modal-quiz'));

document.querySelectorAll('#quiz-step-0 .quiz-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    const sel = document.querySelectorAll('#quiz-step-0 .quiz-opt.on').length;
    if (opt.classList.contains('on')) { opt.classList.remove('on'); }
    else if (sel < 2) { opt.classList.add('on'); }
  });
});
['quiz-step-1','quiz-step-2'].forEach(stepId => {
  document.querySelectorAll(`#${stepId} .quiz-opt`).forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll(`#${stepId} .quiz-opt`).forEach(o => o.classList.remove('on'));
      opt.classList.add('on');
    });
  });
});

function advanceQuiz(from, to) {
  $(`quiz-step-${from}`)?.classList.remove('on');
  $(`quiz-step-${to}`)?.classList.add('on');
  $(`qprog-${to}`)?.classList.add('done');
  quizStep = to;
}
$('quiz-next-0')?.addEventListener('click', () => advanceQuiz(0, 1));
$('quiz-next-1')?.addEventListener('click', () => advanceQuiz(1, 2));
$('quiz-back-1')?.addEventListener('click', () => advanceQuiz(1, 0));
$('quiz-back-2')?.addEventListener('click', () => advanceQuiz(2, 1));

$('quiz-confirmar')?.addEventListener('click', () => {
  state.catalogo.interesses  = [...document.querySelectorAll('#quiz-step-0 .quiz-opt.on')].map(o => o.dataset.interest);
  const freqEl = document.querySelector('#quiz-step-1 .quiz-opt.on');
  state.catalogo.frequViajem = freqEl?.dataset.freq || null;
  const goalEl = document.querySelector('#quiz-step-2 .quiz-opt.on');
  state.catalogo.objetivo    = goalEl?.dataset.goal || null;
  state.catalogo.quizCompleto = true;
  closeModal('modal-quiz');
  vitrineState.dados = null;
  fetchVitrineIA(state.userData || {});
  toast('Preferências salvas! Personalizando sua Vitrine…', 'success');
});

// ═══════════════════════════════════════════════════════════════
// SCANNER NFC-e — Leitura de QR Code de Nota Fiscal
// ═══════════════════════════════════════════════════════════════

/**
 * URL do Cloudflare Worker para consulta de NFC-e.
 * Alterar após deploy com: wrangler deploy
 */
const NFE_WORKER_URL = 'https://nfe-scanner.sacmaispromo.workers.dev';

/** Instância do html5-qrcode — NÃO é mais Singleton; recriada a cada abertura para evitar DOM stale */
let html5QrCode = null;
let scannerAtivo = false;

// ── Event Listeners ──────────────────────────────────────────

// Eventos persistentes do Shell Principal (Sidebar / Navbar FAB)
$('sb-btn-scanner')?.addEventListener('click', () => {
  console.log('[SCANNER] Click detectado no botão da sidebar');
  closeSidebar();
  abrirScanner();
});
$('bn-scanner')?.addEventListener('click', () => {
  console.log('[SCANNER] Click detectado no FAB da bottom nav');
  abrirScanner();
});

// Evento de Digitação (input) persistente via Delegação de Input
document.addEventListener('input', (e) => {
  if (e.target.id === 'scanner-manual-input') {
    tratarManualInput(e);
  }
});

// Event Delegation robusta para elementos internos do Modal (Anti-falha de render)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[id]');
  if (!btn) return;
  
  const id = btn.id;
  
  switch(id) {
    case 'scanner-close':
    case 'scanner-btn-fechar':
    case 'scanner-btn-cancel':
      e.preventDefault();
      console.log(`[SCANNER] Ação de fechar acionada via elemento ID: ${id}`);
      fecharScanner();
      break;
      
    case 'scanner-btn-nova':
    case 'scanner-btn-retry':
      e.preventDefault();
      console.log(`[SCANNER] Ação de reinício acionada via elemento ID: ${id}`);
      reiniciarScanner();
      break;
      
    case 'scanner-btn-manual-trigger':
      e.preventDefault();
      console.log('[SCANNER] Ação "Digitar código manualmente" acionada via Event Delegation');
      mostrarManualState();
      break;
      
    case 'scanner-btn-manual-back':
      e.preventDefault();
      console.log('[SCANNER] Ação "Voltar para câmara" acionada via Event Delegation');
      voltarParaCamera();
      break;
      
    case 'scanner-btn-manual-submit':
      e.preventDefault();
      console.log('[SCANNER] Ação "Validar Nota Manual" acionada via Event Delegation');
      validarManualNota();
      break;
  }
});

// ── UI States ────────────────────────────────────────────────

/** Reseta todos os estados do scanner para o estado inicial (câmara) */
function scannerResetStates() {
  $('scanner-state-loading')?.classList.remove('active');
  $('scanner-state-success')?.classList.remove('active');
  $('scanner-state-error')?.classList.remove('active');
  
  const manualState = $('scanner-state-manual');
  if (manualState) {
    manualState.style.display = 'none';
    manualState.classList.remove('active');
  }
  
  $('scanner-scanline')?.style.setProperty('display', 'block');
  $('scanner-hint')?.style.setProperty('display', 'block');
  $('scanner-btn-manual-trigger')?.style.setProperty('display', 'flex');
  $('scanner-reader')?.style.setProperty('display', 'block');
  
  // Esconder alerta de erro de câmara
  $('scanner-camera-error')?.classList.remove('active');
  
  // Limpar log de diagnóstico
  const debugLog = document.getElementById('scanner-debug-log');
  if (debugLog) {
    debugLog.innerText = '';
    debugLog.style.display = 'none';
  }

  const manualInput = $('scanner-manual-input');
  if (manualInput) {
    manualInput.value = '';
    manualInput.style.setProperty('display', 'block');
  }
  const submitBtn = $('scanner-btn-manual-submit');
  if (submitBtn) {
    submitBtn.disabled = true;
  }
  setText('scanner-manual-counter', '0 / 44');
}

/** Mostra estado de loading ("Consultando SEFAZ...") */
function scannerShowLoading() {
  scannerResetStates();
  $('scanner-scanline')?.style.setProperty('display', 'none');
  $('scanner-hint')?.style.setProperty('display', 'none');
  $('scanner-btn-manual-trigger')?.style.setProperty('display', 'none');
  $('scanner-state-loading')?.classList.add('active');
}

/** Mostra estado de sucesso com dados da nota */
function scannerShowSuccess(dados) {
  scannerResetStates();
  $('scanner-scanline')?.style.setProperty('display', 'none');
  $('scanner-hint')?.style.setProperty('display', 'none');
  $('scanner-btn-manual-trigger')?.style.setProperty('display', 'none');
  
  setText('sr-estabelecimento', dados.estabelecimento || '—');
  setText('sr-valor', moeda(dados.valorTotal));
  setText('sr-itens', `${dados.itens || '—'} produtos`);
  setText('sr-cashback', `+${moeda(dados.cashbackGerado)}`);
  $('scanner-state-success')?.classList.add('active');
}

/** Mostra estado de erro */
function scannerShowError(titulo, mensagem) {
  scannerResetStates();
  $('scanner-scanline')?.style.setProperty('display', 'none');
  $('scanner-hint')?.style.setProperty('display', 'none');
  $('scanner-btn-manual-trigger')?.style.setProperty('display', 'none');
  
  setText('scanner-error-title', titulo);
  setText('scanner-error-sub', mensagem);
  $('scanner-state-error')?.classList.add('active');
}

/** Fallback manual atômico quando a câmara falha ou por escolha do utilizador */
function acionarFallbackManual(err) {
  console.warn('[SCANNER] Fallback acionado devido a erro ou escolha do utilizador:', err);

  // 1. Esconder o #scanner-reader (display: none)
  const reader = $('scanner-reader');
  if (reader) {
    reader.style.display = 'none';
  }

  // 2. Destruir a instância da câmara se ela existir no background
  if (window.html5QrCodeScanner) {
    try {
      window.html5QrCodeScanner.clear();
    } catch (_) {}
    window.html5QrCodeScanner = null;
    html5QrCode = null;
  }
  scannerAtivo = false;

  // 3. Mostrar a div de digitação manual de 44 dígitos (display: block)
  const manualState = $('scanner-state-manual');
  if (manualState) {
    manualState.style.display = 'block';
    manualState.classList.add('active');
  }

  // Ocultar elementos da câmera
  $('scanner-scanline')?.style.setProperty('display', 'none');
  $('scanner-hint')?.style.setProperty('display', 'none');
  $('scanner-btn-manual-trigger')?.style.setProperty('display', 'none');
  $('scanner-camera-error')?.classList.remove('active');

  // Focar o input manual de 44 dígitos
  const manualInput = $('scanner-manual-input');
  if (manualInput) {
    manualInput.style.display = 'block';
    setTimeout(() => {
      manualInput.focus();
    }, 150);
  }
}

/** Mostra formulário manual (compatibilidade com delegation) */
function mostrarManualState() {
  acionarFallbackManual(new Error("Entrada manual acionada pelo utilizador."));
}

/** Retorna do estado manual para a câmara */
function voltarParaCamera() {
  console.log('[SCANNER] Voltando do formulário manual para o visor da câmara...');
  const manualState = $('scanner-state-manual');
  if (manualState) {
    manualState.style.display = 'none';
    manualState.classList.remove('active');
  }
  abrirScanner();
}

/** Filtra e formata o input de digitação manual */
function tratarManualInput(e) {
  let val = e.target.value.replace(/\D/g, ''); // Apenas números
  e.target.value = val;
  
  const len = val.length;
  setText('scanner-manual-counter', `${len} / 44`);
  
  const submitBtn = $('scanner-btn-manual-submit');
  if (submitBtn) {
    submitBtn.disabled = (len !== 44);
  }
}

/** Valida a nota inserida manualmente */
async function validarManualNota() {
  const manualInput = $('scanner-manual-input');
  if (!manualInput) return;
  
  const chave = manualInput.value;
  if (chave.length !== 44) return;
  
  console.log('[SCANNER Manual] Chave de 44 dígitos enviada para validação:', chave);
  
  scannerShowLoading();
  
  try {
    const dadosNota = await consultarWorkerNFE(chave);
    
    if (!dadosNota.valido) {
      scannerShowError('Nota inválida', dadosNota.erro || 'A nota fiscal não pôde ser validada.');
      return;
    }
    
    await processarNotaFiscal(dadosNota);
    
  } catch (err) {
    console.error('[SCANNER Manual] Falha crítica no processamento manual:', err);
    scannerShowError('Erro no processamento', err.message || 'Tente novamente em instantes.');
  }
}

/** Abre o modal do scanner e inicializa a câmara traseira de forma atômica e limpa */
async function abrirScanner() {
  console.log('[SCANNER] ══════════════════════════════════════════');
  console.log('[SCANNER] abrirScanner() acionado — fluxo atômico | t =', new Date().toISOString());

  // 1. Abrir overlay
  const modal = $('modal-scanner');
  if (modal) {
    modal.classList.add('open');
  } else {
    console.error('[SCANNER] Elemento #modal-scanner não foi encontrado no DOM!');
    return;
  }

  // 2. Resetar estados do modal
  scannerResetStates();

  // 3. Garantir exibição do visor
  const reader = $('scanner-reader');
  if (reader) {
    reader.style.display = 'block';
  }

  scannerAtivo = true;

  // 4. Fluxo atômico de câmera padrão, sem overrides ou loops de tentativa
  Html5Qrcode.getCameras().then(cameras => {
    if (cameras && cameras.length > 0) {
      // Pega a última câmara da lista (geralmente a traseira em telemóveis)
      let cameraId = cameras[cameras.length - 1].id;

      if (!window.html5QrCodeScanner) {
        window.html5QrCodeScanner = new Html5Qrcode("scanner-reader");
      }
      html5QrCode = window.html5QrCodeScanner;

      window.html5QrCodeScanner.start(
        cameraId, 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => { processarCodigo(decodedText); },
        (errorMessage) => { /* Ignore erros de frame vazio, NÃO faça loop de UI aqui */ }
      ).catch(err => {
        acionarFallbackManual(err); // Se o start falhar, cai direto aqui. 1 vez só.
      });
    } else {
      acionarFallbackManual(new Error("Nenhuma câmara detectada no dispositivo."));
    }
  }).catch(err => {
    acionarFallbackManual(err); // Permissão negada ou sem câmara.
  });
}

/** Função auxiliar para processamento do código decodificado */
function processarCodigo(decodedText) {
  onQrCodeSuccess(decodedText);
}

/** Limpa e fecha o modal de forma definitiva (Cleanup) */
async function fecharModal() {
  console.log('[SCANNER] fecharModal() acionado — atomic cleanup e liberação da lente');
  scannerAtivo = false;
  if (window.html5QrCodeScanner) {
    try {
      await window.html5QrCodeScanner.stop();
    } catch (_) {}
    try {
      window.html5QrCodeScanner.clear();
    } catch (_) {}
    window.html5QrCodeScanner = null;
    html5QrCode = null;
  }
  $('modal-scanner')?.classList.remove('open');
  scannerResetStates();
}

/** Fecha o scanner (mapeamento para delegação de eventos) */
async function fecharScanner() {
  await fecharModal();
}

/** Reiniciar scanner (nova leitura) */
async function reiniciarScanner() {
  console.log('[SCANNER] Reiniciando scanner...');
  if (window.html5QrCodeScanner) {
    try {
      await window.html5QrCodeScanner.stop();
    } catch (_) {}
    try {
      window.html5QrCodeScanner.clear();
    } catch (_) {}
    window.html5QrCodeScanner = null;
    html5QrCode = null;
  }
  await abrirScanner();
}

// ── QR Code Detection ────────────────────────────────────────

/**
 * Callback chamado quando o html5-qrcode detecta um QR Code.
 * Extrai a chave de acesso de 44 dígitos e inicia o processamento.
 * @param {string} decodedText - Texto decodificado do QR Code
 */
async function onQrCodeSuccess(decodedText) {
  // Evitar múltiplas leituras simultâneas
  if (!scannerAtivo) return;

  console.log('%c[Scanner] ✓ QR Code detectado!', 'color:#18B96A;font-weight:bold;background:#1a1a1a;padding:4px 8px;border-radius:4px;');
  console.log('[Scanner] Conteúdo bruto:', decodedText);

  // 1. Parar câmara imediatamente
  scannerAtivo = false;
  try {
    if (html5QrCode) {
      await html5QrCode.stop();
    }
  } catch (_) {}

  // 2. Vibração tátil de confirmação
  if (navigator.vibrate) {
    navigator.vibrate(150);
  }

  // 3. Extrair chave de acesso de 44 dígitos
  const match = decodedText.match(/(\d{44})/);
  if (!match) {
    console.warn('[Scanner] ✗ Chave de 44 dígitos não encontrada no QR Code');
    scannerShowError(
      'QR Code inválido',
      'Este QR Code não contém uma chave de acesso válida de nota fiscal (44 dígitos).'
    );
    return;
  }

  const chaveAcesso = match[1];
  console.log('[Scanner] Chave de acesso extraída:', chaveAcesso);

  // 4. Mostrar estado de loading
  scannerShowLoading();

  // 5. Enviar ao Worker para consulta
  try {
    const dadosNota = await consultarWorkerNFE(chaveAcesso);

    if (!dadosNota.valido) {
      scannerShowError('Nota inválida', dadosNota.erro || 'A nota fiscal não pôde ser validada.');
      return;
    }

    // 6. Processar no Firebase (anti-fraude + crédito)
    await processarNotaFiscal(dadosNota);

  } catch (err) {
    console.error('[Scanner] Erro no processamento:', err);
    scannerShowError('Erro no processamento', err.message || 'Tente novamente em instantes.');
  }
}

// ── Worker API ───────────────────────────────────────────────

/**
 * Consulta o Cloudflare Worker nfe-scanner com a chave de acesso.
 * @param {string} chaveAcesso - Chave de 44 dígitos
 * @returns {Promise<Object>} Dados da nota fiscal + cashback
 */
async function consultarWorkerNFE(chaveAcesso) {
  console.log('%c[Scanner API] ▶ Enviando consulta ao Worker', 'color:#00ffcc;font-weight:bold;background:#1a1a1a;padding:4px 8px;border-radius:4px;');
  console.log('[Scanner API] URL:', NFE_WORKER_URL);
  console.log('[Scanner API] Chave:', chaveAcesso);

  const t0 = performance.now();

  const res = await fetch(NFE_WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chave_acesso: chaveAcesso }),
  });

  const duracao = Math.round(performance.now() - t0);
  const bodyTexto = await res.text();

  console.log(`[Scanner API] HTTP ${res.status} em ${duracao}ms`);
  console.log('[Scanner API] Body:', bodyTexto);

  let data;
  try {
    data = JSON.parse(bodyTexto);
  } catch (_) {
    throw new Error('Resposta inválida do servidor de validação.');
  }

  if (!res.ok && !data.valido) {
    throw new Error(data.erro || `Erro ${res.status} no servidor.`);
  }

  return data;
}

// ── Firebase Transaction (Anti-fraude) ───────────────────────

/**
 * Processa a nota fiscal no Firestore com transação atômica.
 * Verifica se a nota já foi lida (anti-fraude) e credita o cashback.
 * @param {Object} dados - Dados retornados pelo Worker
 */
async function processarNotaFiscal(dados) {
  console.log('%c[Scanner Firebase] ▶ Iniciando transação anti-fraude', 'color:#FFA500;font-weight:bold;background:#1a1a1a;padding:4px 8px;border-radius:4px;');

  const currentUser = auth.currentUser;

  // Modo demo (sem Firebase ou usuário deslogado)
  if (!currentUser || state.modoDemo) {
    console.log('[Scanner Firebase] Modo demo — simulando crédito');

    // Simular crédito local
    if (state.userData) {
      state.userData.cashback = (state.userData.cashback || 0) + dados.cashbackGerado;
      updateUI(state.userData);
    }

    lançarConfetti({ duration: 3500 });
    toast(`+${moeda(dados.cashbackGerado)} de cashback creditado! (Demo)`, 'success');
    scannerShowSuccess(dados);
    return;
  }

  // ── Modo real: Transação Firestore ──
  try {
    const userRef = doc(db, 'usuarios', currentUser.uid);
    const notaRef = doc(db, 'notas_lidas', dados.chave);

    await runTransaction(db, async (transaction) => {
      // 1. Verificar se nota já foi processada (resource == null é permitido no firestore.rules para ler notas inexistentes sem erro)
      const notaSnap = await transaction.get(notaRef);

      if (notaSnap.exists()) {
        throw new Error('NOTA_JA_PROCESSADA');
      }

      // 2. Verificar se o usuário existe
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error('Usuário não encontrado. Faça login novamente.');
      }

      // 3. Limitar cashback máximo por nota (R$ 500 = nota de R$ 10.000)
      if (dados.cashbackGerado > 500) {
        throw new Error('Valor de cashback excede o limite máximo por nota.');
      }

      // 4. Criar documento na coleção anti-fraude
      transaction.set(notaRef, {
        uid: currentUser.uid,
        estabelecimento: dados.estabelecimento || 'Desconhecido',
        valorTotal: dados.valorTotal || 0,
        cashbackGerado: dados.cashbackGerado || 0,
        chave: dados.chave,
        dataLeitura: serverTimestamp(),
        mock: dados.mock || false,
      });

      // 5. Incrementar cashback do usuário
      transaction.update(userRef, {
        cashback: increment(dados.cashbackGerado),
      });
    });

    console.log('%c[Scanner Firebase] ✓ Transação concluída com sucesso!', 'color:#18B96A;font-weight:bold;');

    // 6. Confetes!
    lançarConfetti({ duration: 3500 });
    toast(`+${moeda(dados.cashbackGerado)} de cashback creditado!`, 'success');

    // 7. Salvar notificação
    await salvarNotificacao({
      tipo: 'nota_fiscal',
      icone: '',
      titulo: `Nota fiscal processada: +${moeda(dados.cashbackGerado)}`,
      mensagem: `Compra de ${moeda(dados.valorTotal)} em ${dados.estabelecimento || 'parceiro'} gerou ${moeda(dados.cashbackGerado)} de cashback.`,
    });

    // 8. Exibir resultado
    scannerShowSuccess(dados);

  } catch (err) {
    if (err.message === 'NOTA_JA_PROCESSADA') {
      console.warn('[Scanner Firebase] Nota já processada anteriormente.');
      scannerShowError(
        'Nota já processada',
        'Esta nota fiscal já foi lida e o cashback foi creditado anteriormente.'
      );
    } else {
      console.error('[Scanner Firebase] Erro na transação:', err);
      scannerShowError(
        'Erro ao creditar',
        err.message || 'Não foi possível processar a nota. Tente novamente.'
      );
    }
  }
}


