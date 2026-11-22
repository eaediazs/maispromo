/**
 * ═══════════════════════════════════════════════════════════════
 * +PROMO — Cloudflare Worker: Vitrine IA (Agregador Híbrido)
 * ═══════════════════════════════════════════════════════════════
 *
 * CRIADO — 2026-06-02
 *
 * Endpoint inteligente que combina ofertas de lojas físicas
 * (geolocalização simulada em Americana/SBO-SP) com ofertas
 * de e-commerce global (Amazon, Shopee, ML, Shein) + cashback.
 *
 * Endpoint:
 *   GET /?lat=-22.7347&lng=-47.3319
 *
 * Sem lat/lng → retorna apenas global_offers (fallback).
 *
 * Respostas:
 *   200  → JSON com local_offers + global_offers
 *   405  → Método não permitido
 *   500  → Erro interno
 */

// ═══════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════
export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Só GET permitido
    if (request.method !== 'GET') {
      return jsonResp({ erro: 'Método não permitido. Use GET.' }, 405, corsHeaders);
    }

    try {
      const url = new URL(request.url);
      const lat = parseFloat(url.searchParams.get('lat')) || null;
      const lng = parseFloat(url.searchParams.get('lng')) || null;

      console.log(`[Vitrine IA] Requisição | lat: ${lat}, lng: ${lng}`);

      const localOffers = (lat && lng) ? buildLocalOffers(lat, lng) : [];
      const globalOffers = buildGlobalOffers();

      const response = {
        status: 'ok',
        localizacao_detectada: (lat && lng) ? detectarCidade(lat, lng) : null,
        local_offers: localOffers,
        global_offers: globalOffers,
        meta: {
          generated_at: new Date().toISOString(),
          total_offers: localOffers.length + globalOffers.length,
          has_location: !!(lat && lng),
        },
      };

      console.log(`[Vitrine IA] Retornando ${localOffers.length} locais + ${globalOffers.length} globais`);
      return jsonResp(response, 200, corsHeaders);

    } catch (err) {
      console.error('[Vitrine IA] Erro:', err.message, err.stack);
      return jsonResp({ erro: 'Erro interno do Worker.', detalhe: err.message }, 500, corsHeaders);
    }
  },
};

// ═══════════════════════════════════════════════════════════════
// DETECÇÃO DE CIDADE (simulada por proximidade)
// ═══════════════════════════════════════════════════════════════
function detectarCidade(lat, lng) {
  const cidades = [
    { nome: 'Americana, SP',             lat: -22.7392, lng: -47.3316 },
    { nome: 'Santa Bárbara d\'Oeste, SP', lat: -22.7557, lng: -47.3801 },
    { nome: 'Limeira, SP',               lat: -22.5642, lng: -47.4017 },
    { nome: 'Piracicaba, SP',            lat: -22.7254, lng: -47.6493 },
    { nome: 'Campinas, SP',              lat: -22.9071, lng: -47.0628 },
  ];

  let closest = cidades[0];
  let minDist = Infinity;

  for (const c of cidades) {
    const dist = haversine(lat, lng, c.lat, c.lng);
    if (dist < minDist) {
      minDist = dist;
      closest = c;
    }
  }

  return closest.nome;
}

/** Haversine simplificado (km) */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═══════════════════════════════════════════════════════════════
// LOCAL OFFERS — Lojas Físicas (Americana / SBO)
// ═══════════════════════════════════════════════════════════════
function buildLocalOffers(lat, lng) {
  const estabelecimentos = [
    {
      id: 'local-001',
      nome: 'Supermercado Pague Menos',
      tipo: 'supermercado',
      endereco: 'Av. Cândido Rondon, 1245 — Santa Bárbara d\'Oeste, SP',
      lat: -22.7524,
      lng: -47.3782,
      cashback_regra: 'Ganhe 5% lendo a NFC-e',
      cashback_percentual: 5,
      horario: '07:00 — 22:00',
      avaliacao: 4.3,
      selo: 'parceiro_verificado',
      icone: 'cart',
    },
    {
      id: 'local-002',
      nome: 'Drogarias Americana',
      tipo: 'farmacia',
      endereco: 'R. Doze de Novembro, 800 — Americana, SP',
      lat: -22.7370,
      lng: -47.3290,
      cashback_regra: 'Ganhe 8% em medicamentos genéricos',
      cashback_percentual: 8,
      horario: '07:00 — 22:00',
      avaliacao: 4.5,
      selo: 'parceiro_verificado',
      icone: 'pill',
    },
    {
      id: 'local-003',
      nome: 'Atacadão Americana',
      tipo: 'supermercado',
      endereco: 'Rod. Anhanguera, Km 127 — Americana, SP',
      lat: -22.7295,
      lng: -47.3471,
      cashback_regra: 'Ganhe 3% em compras acima de R$200',
      cashback_percentual: 3,
      horario: '07:00 — 22:00',
      avaliacao: 4.1,
      selo: 'mega_oferta',
      icone: 'cart',
    },
    {
      id: 'local-004',
      nome: 'FarmaVida Santa Bárbara',
      tipo: 'farmacia',
      endereco: 'R. João Pessoa, 450 — Santa Bárbara d\'Oeste, SP',
      lat: -22.7550,
      lng: -47.3810,
      cashback_regra: 'Ganhe 6% em higiene e beleza',
      cashback_percentual: 6,
      horario: '08:00 — 21:00',
      avaliacao: 4.6,
      selo: 'parceiro_verificado',
      icone: 'pill',
    },
    {
      id: 'local-005',
      nome: 'Supermercado São Vicente',
      tipo: 'supermercado',
      endereco: 'Av. Brasil, 2300 — Americana, SP',
      lat: -22.7410,
      lng: -47.3350,
      cashback_regra: 'Ganhe 4% toda segunda e terça',
      cashback_percentual: 4,
      horario: '07:00 — 23:00',
      avaliacao: 4.4,
      selo: 'parceiro_verificado',
      icone: 'cart',
    },
    {
      id: 'local-006',
      nome: 'Posto PetroPrime',
      tipo: 'posto',
      endereco: 'Av. Cillos, 980 — Americana, SP',
      lat: -22.7320,
      lng: -47.3200,
      cashback_regra: 'Ganhe 2% no abastecimento via app',
      cashback_percentual: 2,
      horario: '24 horas',
      avaliacao: 4.0,
      selo: 'parceiro_verificado',
      icone: 'fuel',
    },
    {
      id: 'local-007',
      nome: 'Drogasil Americana Centro',
      tipo: 'farmacia',
      endereco: 'R. Sete de Setembro, 340 — Americana, SP',
      lat: -22.7378,
      lng: -47.3305,
      cashback_regra: 'Ganhe 5% em dermocosméticos',
      cashback_percentual: 5,
      horario: '07:00 — 22:00',
      avaliacao: 4.7,
      selo: 'parceiro_verificado',
      icone: 'pill',
    },
    {
      id: 'local-008',
      nome: 'Tenda Atacado',
      tipo: 'supermercado',
      endereco: 'Av. de Cillo, 1500 — Santa Bárbara d\'Oeste, SP',
      lat: -22.7480,
      lng: -47.3700,
      cashback_regra: 'Ganhe 3% em compras acima de R$150',
      cashback_percentual: 3,
      horario: '07:00 — 22:00',
      avaliacao: 4.2,
      selo: 'mega_oferta',
      icone: 'cart',
    },
  ];

  // Calcular distância de cada loja ao usuário
  return estabelecimentos
    .map(loja => ({
      ...loja,
      distancia_km: +haversine(lat, lng, loja.lat, loja.lng).toFixed(1),
    }))
    .sort((a, b) => a.distancia_km - b.distancia_km);
}

// ═══════════════════════════════════════════════════════════════
// GLOBAL OFFERS — E-commerce Afiliados
// ═══════════════════════════════════════════════════════════════
function buildGlobalOffers() {
  return [
    {
      id: 'global-001',
      titulo: 'Smartphone Samsung Galaxy A54 5G 128GB',
      categoria: 'smartphones',
      loja_parceira: 'Amazon',
      logo_loja: 'amazon',
      preco_antigo: 2499.00,
      preco_novo: 1649.00,
      desconto_percentual: 34,
      cashback_estimado: 82.45,
      cashback_percentual: 5,
      link_afiliado: 'https://www.amazon.com.br/dp/B0EXAMPLE01?tag=maispromo-20',
      imagem_url: 'https://picsum.photos/seed/galaxy-a54/400/400',
      urgencia: 'Últimas 8 unidades',
      selo: 'oferta_quente',
      aprovacoes: 342,
    },
    {
      id: 'global-002',
      titulo: 'Processador AMD Ryzen 7 5700X 8-Core',
      categoria: 'hardware',
      loja_parceira: 'Mercado Livre',
      logo_loja: 'mercadolivre',
      preco_antigo: 1299.00,
      preco_novo: 849.90,
      desconto_percentual: 35,
      cashback_estimado: 42.50,
      cashback_percentual: 5,
      link_afiliado: 'https://mercadolivre.com.br/MLB-EXAMPLE02',
      imagem_url: 'https://picsum.photos/seed/ryzen-7/400/400',
      urgencia: null,
      selo: 'mais_vendido',
      aprovacoes: 518,
    },
    {
      id: 'global-003',
      titulo: 'Gift Card Xbox Game Pass Ultimate 3 Meses',
      categoria: 'games',
      loja_parceira: 'Amazon',
      logo_loja: 'amazon',
      preco_antigo: 149.00,
      preco_novo: 109.90,
      desconto_percentual: 26,
      cashback_estimado: 5.50,
      cashback_percentual: 5,
      link_afiliado: 'https://www.amazon.com.br/dp/B0EXAMPLE03?tag=maispromo-20',
      imagem_url: 'https://picsum.photos/seed/xbox-gp/400/400',
      urgencia: 'Só até amanhã',
      selo: 'oferta_quente',
      aprovacoes: 127,
    },
    {
      id: 'global-004',
      titulo: 'Fone Bluetooth JBL Tune 520BT',
      categoria: 'acessorios',
      loja_parceira: 'Shopee',
      logo_loja: 'shopee',
      preco_antigo: 299.00,
      preco_novo: 159.90,
      desconto_percentual: 47,
      cashback_estimado: 11.19,
      cashback_percentual: 7,
      link_afiliado: 'https://shopee.com.br/product/EXAMPLE04',
      imagem_url: 'https://picsum.photos/seed/jbl-520/400/400',
      urgencia: 'Últimas 3 unidades',
      selo: 'oferta_quente',
      aprovacoes: 891,
    },
    {
      id: 'global-005',
      titulo: 'Camiseta Oversized Streetwear Premium',
      categoria: 'vestuario',
      loja_parceira: 'Shein',
      logo_loja: 'shein',
      preco_antigo: 89.90,
      preco_novo: 39.90,
      desconto_percentual: 56,
      cashback_estimado: 3.99,
      cashback_percentual: 10,
      link_afiliado: 'https://www.shein.com/EXAMPLE05',
      imagem_url: 'https://picsum.photos/seed/camiseta-st/400/400',
      urgencia: null,
      selo: 'mais_vendido',
      aprovacoes: 2034,
    },
    {
      id: 'global-006',
      titulo: 'Monitor Gamer 24" LG UltraGear 144Hz IPS',
      categoria: 'hardware',
      loja_parceira: 'Amazon',
      logo_loja: 'amazon',
      preco_antigo: 1499.00,
      preco_novo: 989.00,
      desconto_percentual: 34,
      cashback_estimado: 49.45,
      cashback_percentual: 5,
      link_afiliado: 'https://www.amazon.com.br/dp/B0EXAMPLE06?tag=maispromo-20',
      imagem_url: 'https://picsum.photos/seed/monitor-lg/400/400',
      urgencia: null,
      selo: 'oferta_quente',
      aprovacoes: 264,
    },
    {
      id: 'global-007',
      titulo: 'Teclado Mecânico Redragon Kumara RGB',
      categoria: 'hardware',
      loja_parceira: 'Mercado Livre',
      logo_loja: 'mercadolivre',
      preco_antigo: 249.90,
      preco_novo: 169.90,
      desconto_percentual: 32,
      cashback_estimado: 8.50,
      cashback_percentual: 5,
      link_afiliado: 'https://mercadolivre.com.br/MLB-EXAMPLE07',
      imagem_url: 'https://picsum.photos/seed/teclado-red/400/400',
      urgencia: null,
      selo: null,
      aprovacoes: 445,
    },
    {
      id: 'global-008',
      titulo: 'Tênis Nike Air Max SC Masculino',
      categoria: 'vestuario',
      loja_parceira: 'Shopee',
      logo_loja: 'shopee',
      preco_antigo: 499.99,
      preco_novo: 289.90,
      desconto_percentual: 42,
      cashback_estimado: 20.29,
      cashback_percentual: 7,
      link_afiliado: 'https://shopee.com.br/product/EXAMPLE08',
      imagem_url: 'https://picsum.photos/seed/nike-air/400/400',
      urgencia: 'Últimas 5 unidades',
      selo: 'oferta_quente',
      aprovacoes: 1203,
    },
    {
      id: 'global-009',
      titulo: 'SSD NVMe Kingston NV2 1TB PCIe 4.0',
      categoria: 'hardware',
      loja_parceira: 'Amazon',
      logo_loja: 'amazon',
      preco_antigo: 449.00,
      preco_novo: 299.00,
      desconto_percentual: 33,
      cashback_estimado: 14.95,
      cashback_percentual: 5,
      link_afiliado: 'https://www.amazon.com.br/dp/B0EXAMPLE09?tag=maispromo-20',
      imagem_url: 'https://picsum.photos/seed/ssd-kingston/400/400',
      urgencia: null,
      selo: 'mais_vendido',
      aprovacoes: 678,
    },
    {
      id: 'global-010',
      titulo: 'Mouse Gamer Logitech G203 RGB Lightsync',
      categoria: 'hardware',
      loja_parceira: 'Mercado Livre',
      logo_loja: 'mercadolivre',
      preco_antigo: 199.90,
      preco_novo: 119.90,
      desconto_percentual: 40,
      cashback_estimado: 6.00,
      cashback_percentual: 5,
      link_afiliado: 'https://mercadolivre.com.br/MLB-EXAMPLE10',
      imagem_url: 'https://picsum.photos/seed/mouse-logi/400/400',
      urgencia: null,
      selo: null,
      aprovacoes: 389,
    },
    {
      id: 'global-011',
      titulo: 'Smartwatch Xiaomi Redmi Watch 4',
      categoria: 'smartphones',
      loja_parceira: 'Shopee',
      logo_loja: 'shopee',
      preco_antigo: 599.90,
      preco_novo: 349.90,
      desconto_percentual: 42,
      cashback_estimado: 24.49,
      cashback_percentual: 7,
      link_afiliado: 'https://shopee.com.br/product/EXAMPLE11',
      imagem_url: 'https://picsum.photos/seed/xiaomi-watch/400/400',
      urgencia: 'Só hoje',
      selo: 'oferta_quente',
      aprovacoes: 756,
    },
    {
      id: 'global-012',
      titulo: 'Mochila Notebook 15.6" Anti-Furto USB',
      categoria: 'acessorios',
      loja_parceira: 'Shein',
      logo_loja: 'shein',
      preco_antigo: 159.90,
      preco_novo: 69.90,
      desconto_percentual: 56,
      cashback_estimado: 6.99,
      cashback_percentual: 10,
      link_afiliado: 'https://www.shein.com/EXAMPLE12',
      imagem_url: 'https://picsum.photos/seed/mochila-usb/400/400',
      urgencia: null,
      selo: 'mais_vendido',
      aprovacoes: 1547,
    },
  ];
}

// ═══════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════
function jsonResp(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}
