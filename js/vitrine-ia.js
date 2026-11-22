/**
 * ═══════════════════════════════════════════════════════════════
 * +PROMO — Vitrine IA: Front-end (vitrine-ia.js)
 * ═══════════════════════════════════════════════════════════════
 *
 * CRIADO — 2026-06-02
 *
 * Módulo responsável por:
 *  1. Solicitar geolocalização do usuário
 *  2. Exibir skeleton screens durante loading
 *  3. Fazer fetch ao Worker Vitrine IA
 *  4. Renderizar cards de lojas locais e e-commerce
 *  5. Controlar abas (tabs) de navegação
 *
 * Exporta: iniciarVitrineIA()
 */

// ═══════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════

/** URL do Worker — produção (maispromo-ia.sacmaispromo.workers.dev) */
const WORKER_URL = 'https://maispromo-ia.sacmaispromo.workers.dev';

/** Fallback para desenvolvimento local (npx wrangler dev) */
const WORKER_URL_DEV = 'http://localhost:8787';

/** Timeout da geolocalização (ms) */
const GEO_TIMEOUT = 10000;

/** Detectar ambiente */
function getWorkerUrl() {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return WORKER_URL_DEV;
  }
  return WORKER_URL;
}

// ═══════════════════════════════════════════════════════════════
// ÍCONES SVG (sem dependência externa)
// ═══════════════════════════════════════════════════════════════
const ICONS = {
  cart: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  pill: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="M8.5 8.5 16 16"/></svg>`,
  fuel: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v17"/><path d="M3 11h11"/><path d="M17 22V9l3-3"/><path d="M14 7h5a1 1 0 0 1 1 1v3"/></svg>`,
  pin: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  clock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  star: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
  fire: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.866 0-7-3.134-7-7 0-3 2-5 3-7 .562-.84 1-2 1-3 1.5 1.5 2 3 2 5 1-1 2-3.5 1.5-6C15 7 17 10 17 13c0 2-1 4-2 5 .5-.5 1-2 1-3-1 2-3 3-4 3z"/></svg>`,
  check: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  coin: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  thumbUp: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 22V11l5-10 1.5.5c1 .3 1.5 1.5 1.2 2.5L14 8h5.5a2 2 0 0 1 2 2.3l-1.5 9A2 2 0 0 1 18 21H7z"/><path d="M2 11v11h4V11z"/></svg>`,
  arrow: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  alertTriangle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  mapOff: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`,
};

// Store logo abbreviations
const STORE_LOGOS = {
  amazon: `<span class="store-logo store-logo--amazon">AMZ</span>`,
  shopee: `<span class="store-logo store-logo--shopee">SHP</span>`,
  mercadolivre: `<span class="store-logo store-logo--mercadolivre">ML</span>`,
  shein: `<span class="store-logo store-logo--shein">SHN</span>`,
};

// ═══════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════
function formatBRL(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ═══════════════════════════════════════════════════════════════
// DOM HELPERS
// ═══════════════════════════════════════════════════════════════
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

// ═══════════════════════════════════════════════════════════════
// SKELETON SCREENS
// ═══════════════════════════════════════════════════════════════
function renderSkeletons(container, type, count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    if (type === 'ecom') {
      html += `
        <div class="skeleton-card skeleton-card--ecom">
          <div class="skeleton-block skeleton-block--img"></div>
          <div class="skeleton-block skeleton-block--title"></div>
          <div class="skeleton-block skeleton-block--text"></div>
          <div class="skeleton-block skeleton-block--price"></div>
          <div class="skeleton-block skeleton-block--btn"></div>
        </div>`;
    } else {
      html += `
        <div class="skeleton-card skeleton-card--local">
          <div class="skeleton-block skeleton-block--icon"></div>
          <div style="flex:1">
            <div class="skeleton-block skeleton-block--name"></div>
            <div class="skeleton-block skeleton-block--addr"></div>
            <div class="skeleton-block skeleton-block--rule"></div>
          </div>
        </div>`;
    }
  }
  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════
// RENDER: E-COMMERCE CARDS
// ═══════════════════════════════════════════════════════════════
function renderGlobalOffers(offers, container) {
  if (!offers || offers.length === 0) {
    container.innerHTML = `
      <div class="vitrine-empty">
        <div class="vitrine-empty__icon">${ICONS.cart}</div>
        <div class="vitrine-empty__title">Nenhuma oferta encontrada</div>
        <div class="vitrine-empty__desc">Estamos buscando as melhores ofertas. Volte em breve!</div>
      </div>`;
    return;
  }

  let html = '';
  offers.forEach(offer => {
    const badgeHtml = buildBadge(offer.selo);
    const urgencyHtml = offer.urgencia
      ? `<div class="ecom-card__urgency">${ICONS.fire} ${offer.urgencia}</div>`
      : '';
    const socialHtml = offer.aprovacoes
      ? `<div class="ecom-card__social">${ICONS.thumbUp} ${offer.aprovacoes.toLocaleString('pt-BR')} aprovações</div>`
      : '';

    html += `
      <article class="ecom-card" id="${offer.id}" data-store="${offer.loja_parceira}">
        <div class="ecom-card__img-wrap">
          <img class="ecom-card__img" src="${offer.imagem_url}" alt="${offer.titulo}" loading="lazy"
               onerror="this.style.display='none'">
          ${badgeHtml}
          <div class="ecom-card__store-logo">${STORE_LOGOS[offer.logo_loja] || ''}</div>
          <div class="ecom-card__discount-tag">-${offer.desconto_percentual}%</div>
        </div>
        <div class="ecom-card__body">
          <div class="ecom-card__category">${offer.categoria}</div>
          <h3 class="ecom-card__title">${offer.titulo}</h3>
          <div class="ecom-card__price-group">
            <div class="ecom-card__price-old">${formatBRL(offer.preco_antigo)}</div>
            <div class="ecom-card__price-new">${formatBRL(offer.preco_novo)}</div>
          </div>
          <div class="ecom-card__cashback">
            <div class="ecom-card__cashback-icon">${ICONS.coin}</div>
            <div class="ecom-card__cashback-text">Receba <strong>${formatBRL(offer.cashback_estimado)}</strong> de volta</div>
          </div>
          ${urgencyHtml}
          ${socialHtml}
        </div>
        <div class="ecom-card__footer">
          <a href="${offer.link_afiliado}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">
            <button class="ecom-card__cta" type="button">
              Ir para a Loja ${ICONS.arrow}
            </button>
          </a>
        </div>
      </article>`;
  });

  container.innerHTML = html;
}

function buildBadge(selo) {
  if (!selo) return '';
  if (selo === 'oferta_quente') {
    return `<div class="ecom-card__badge ecom-card__badge--hot">${ICONS.fire} Oferta Quente</div>`;
  }
  if (selo === 'mais_vendido') {
    return `<div class="ecom-card__badge ecom-card__badge--popular">${ICONS.thumbUp} Mais Vendido</div>`;
  }
  return '';
}

// ═══════════════════════════════════════════════════════════════
// RENDER: LOCAL CARDS
// ═══════════════════════════════════════════════════════════════
function renderLocalOffers(offers, container) {
  if (!offers || offers.length === 0) {
    container.innerHTML = `
      <div class="vitrine-empty">
        <div class="vitrine-empty__icon">${ICONS.mapOff}</div>
        <div class="vitrine-empty__title">Localização não disponível</div>
        <div class="vitrine-empty__desc">Ative sua localização para ver ofertas de lojas físicas perto de você em Americana e Santa Bárbara d'Oeste.</div>
      </div>`;
    return;
  }

  let html = '';
  offers.forEach(offer => {
    const iconClass = `local-card__icon--${offer.tipo}`;
    const iconSvg = ICONS[offer.icone] || ICONS.cart;

    const seloHtml = buildLocalSelo(offer.selo);
    const ratingStars = buildStars(offer.avaliacao);

    html += `
      <article class="local-card" id="${offer.id}">
        <div class="local-card__icon ${iconClass}">${iconSvg}</div>
        <div class="local-card__content">
          <div class="local-card__top">
            <div class="local-card__name">${offer.nome}</div>
            <div class="local-card__distance">${ICONS.pin} ${offer.distancia_km} km</div>
          </div>
          <div class="local-card__address">${offer.endereco}</div>
          <div class="local-card__cashback-rule">
            ${ICONS.coin} ${offer.cashback_regra}
          </div>
          <div class="local-card__meta">
            <span style="display:flex;align-items:center;gap:4px">${ICONS.clock} ${offer.horario}</span>
            <span class="local-card__rating">${ratingStars} ${offer.avaliacao}</span>
            ${seloHtml}
          </div>
        </div>
      </article>`;
  });

  container.innerHTML = html;
}

function buildLocalSelo(selo) {
  if (!selo) return '';
  if (selo === 'parceiro_verificado') {
    return `<span class="local-card__selo local-card__selo--verificado">${ICONS.check} Verificado</span>`;
  }
  if (selo === 'mega_oferta') {
    return `<span class="local-card__selo local-card__selo--mega">${ICONS.fire} Mega Oferta</span>`;
  }
  return '';
}

function buildStars(rating) {
  const full = Math.floor(rating);
  let stars = '';
  for (let i = 0; i < full; i++) {
    stars += ICONS.star;
  }
  return stars;
}

// ═══════════════════════════════════════════════════════════════
// RENDER: ERROR STATE
// ═══════════════════════════════════════════════════════════════
function renderError(container, title, desc) {
  container.innerHTML = `
    <div class="vitrine-error">
      <div class="vitrine-error__icon">${ICONS.alertTriangle}</div>
      <div class="vitrine-error__title">${title}</div>
      <div class="vitrine-error__desc">${desc}</div>
      <button class="btn btn-yellow btn-sm" onclick="iniciarVitrineIA()">Tentar novamente</button>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// TABS CONTROL
// ═══════════════════════════════════════════════════════════════
function initTabs() {
  const tabs = $$('.vitrine-tab');
  const panels = $$('.vitrine-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      // Update tabs
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update panels
      panels.forEach(p => {
        p.classList.remove('active');
        if (p.id === target) p.classList.add('active');
      });
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// GEOLOCATION
// ═══════════════════════════════════════════════════════════════
function getGeolocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('[Vitrine IA] Geolocalização não suportada');
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log(`[Vitrine IA] Localização: ${pos.coords.latitude}, ${pos.coords.longitude}`);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        console.warn(`[Vitrine IA] Geolocalização negada: ${err.message}`);
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: GEO_TIMEOUT,
        maximumAge: 300000, // cache de 5 minutos
      }
    );
  });
}

// ═══════════════════════════════════════════════════════════════
// FETCH WORKER
// ═══════════════════════════════════════════════════════════════
async function fetchVitrine(coords) {
  const baseUrl = getWorkerUrl();
  let url = baseUrl + '/';

  if (coords) {
    url += `?lat=${coords.lat}&lng=${coords.lng}`;
  }

  console.log(`[Vitrine IA] Fetch → ${url}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ═══════════════════════════════════════════════════════════════
// LOCATION BAR UPDATE
// ═══════════════════════════════════════════════════════════════
function updateLocationBar(cidade) {
  const bar = $('#vitrine-location-bar');
  if (!bar) return;

  if (cidade) {
    const citySpan = bar.querySelector('.city-name');
    if (citySpan) citySpan.textContent = cidade;
    bar.classList.remove('hidden');
  } else {
    bar.classList.add('hidden');
  }
}

// ═══════════════════════════════════════════════════════════════
// TAB COUNTS UPDATE
// ═══════════════════════════════════════════════════════════════
function updateTabCounts(localCount, globalCount) {
  const localTab = $('[data-tab="panel-local"]');
  const globalTab = $('[data-tab="panel-global"]');

  if (localTab) {
    const countEl = localTab.querySelector('.vitrine-tab__count');
    if (countEl) countEl.textContent = localCount;

    // Disable local tab if no local offers
    if (localCount === 0) {
      localTab.style.opacity = '0.5';
      localTab.style.pointerEvents = 'none';
    } else {
      localTab.style.opacity = '1';
      localTab.style.pointerEvents = 'auto';
    }
  }
  if (globalTab) {
    const countEl = globalTab.querySelector('.vitrine-tab__count');
    if (countEl) countEl.textContent = globalCount;
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN: iniciarVitrineIA()
// ═══════════════════════════════════════════════════════════════
async function iniciarVitrineIA() {
  console.log('[Vitrine IA] Iniciando...');

  const localGrid = $('#grid-local');
  const globalGrid = $('#grid-global');

  if (!localGrid || !globalGrid) {
    console.error('[Vitrine IA] Containers de grid não encontrados');
    return;
  }

  // 1. Show skeletons immediately
  renderSkeletons(localGrid, 'local', 4);
  renderSkeletons(globalGrid, 'ecom', 6);

  // 2. Get geolocation (non-blocking UX)
  const coords = await getGeolocation();

  // 3. If no geo, switch to global tab automatically
  if (!coords) {
    const globalTab = $('[data-tab="panel-global"]');
    if (globalTab) globalTab.click();
  }

  // 4. Fetch from Worker
  try {
    const data = await fetchVitrine(coords);

    if (data.status !== 'ok') {
      throw new Error('Resposta inválida do servidor');
    }

    // 5. Update UI
    updateLocationBar(data.localizacao_detectada);
    updateTabCounts(data.local_offers.length, data.global_offers.length);

    // 6. Render cards
    renderLocalOffers(data.local_offers, localGrid);
    renderGlobalOffers(data.global_offers, globalGrid);

    // 7. If no local offers, ensure global tab is active
    if (data.local_offers.length === 0) {
      const globalTab = $('[data-tab="panel-global"]');
      if (globalTab) globalTab.click();
    }

    console.log(`[Vitrine IA] Renderizado: ${data.local_offers.length} locais + ${data.global_offers.length} globais`);

  } catch (err) {
    console.error('[Vitrine IA] Erro no fetch:', err);
    renderError(localGrid, 'Erro ao carregar ofertas locais', err.message);
    renderError(globalGrid, 'Erro ao carregar ofertas', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// INIT ON DOM READY
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  iniciarVitrineIA();
});

// Expose globally for retry button
window.iniciarVitrineIA = iniciarVitrineIA;
