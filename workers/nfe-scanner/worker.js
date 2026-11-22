/**
 * ═══════════════════════════════════════════════════════════════
 * +PROMO — Cloudflare Worker: NFE Scanner (Consulta de NF-e)
 * ═══════════════════════════════════════════════════════════════
 *
 * CRIADO — 2026-05-28
 *
 * Recebe uma chave de acesso de NF-e (44 dígitos) via POST,
 * consulta a API NFE.io para obter detalhes da nota fiscal,
 * e retorna os dados relevantes + cashback calculado (5%).
 *
 * Se a API NFE.io falhar, estiver indisponível ou sem chave
 * configurada, o Worker retorna um mock inteligente (fallback)
 * para que o front-end nunca quebre.
 *
 * Endpoint:
 *   POST /  → Body JSON: { "chave_acesso": "44 dígitos numéricos" }
 *
 * Variáveis de Ambiente (Cloudflare Dashboard → Settings → Variables):
 *   - NFE_API_KEY  → Chave da API NFE.io (sandbox ou produção)
 *
 * Respostas:
 *   200  → Dados da NF-e (real ou mock)
 *   400  → Chave de acesso inválida
 *   405  → Método não permitido
 *   500  → Erro interno
 */

const CASHBACK_RATE = 0.05; // 5% de cashback

// ═══════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════
export default {
  async fetch(request, env) {
    // ── CORS Blindado (wildcard temporário para debug) ──
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Só POST permitido
    if (request.method !== 'POST') {
      return jsonResp({ erro: 'Método não permitido. Use POST.' }, 405, corsHeaders);
    }

    // ── Parse do body ──
    let body;
    try {
      body = await request.json();
    } catch (parseErr) {
      console.error('[NFE Worker] Falha ao fazer parse do body JSON:', parseErr.message);
      return jsonResp(
        { erro: 'Body da requisição não é JSON válido.', detalhe: parseErr.message },
        400,
        corsHeaders
      );
    }

    const { chave_acesso } = body;
    console.log(`[NFE Worker] Requisição recebida | chave_acesso: "${chave_acesso || '(vazio)'}"`);

    try {
      return await handleConsultaNFe(chave_acesso, env, corsHeaders);
    } catch (err) {
      console.error('[NFE Worker] Erro não capturado:', err.message, err.stack);
      return jsonResp(
        { erro: 'Erro interno do Worker.', detalhe: err.message },
        500,
        corsHeaders
      );
    }
  },
};

// ═══════════════════════════════════════════════════════════════
// CONSULTA NF-e (API real + fallback mock)
// ═══════════════════════════════════════════════════════════════
async function handleConsultaNFe(chave_acesso, env, corsHeaders) {
  // ── Validação da chave de acesso ──
  if (!chave_acesso || !isValidChaveAcesso(chave_acesso)) {
    console.log(`[NFE Worker] Chave de acesso inválida: "${chave_acesso || '(vazio)'}"`);
    return jsonResp(
      { valido: false, erro: 'Chave de acesso inválida. Deve conter 44 dígitos numéricos.' },
      400,
      corsHeaders
    );
  }

  console.log(`[NFE Worker] Chave de acesso válida (${chave_acesso.length} dígitos). Iniciando consulta...`);

  // ── Tentativa 1: API NFE.io ──
  if (env.NFE_API_KEY) {
    console.log('[NFE Worker] NFE_API_KEY configurada. Consultando API NFE.io...');

    try {
      const apiUrl = `https://api.nfe.io/v1/companies/default/serviceinvoices/${chave_acesso}`;
      console.log(`[NFE Worker] Fetch → ${apiUrl}`);

      const res = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': env.NFE_API_KEY,
        },
      });

      const responseText = await res.text();
      console.log(`[NFE Worker] NFE.io HTTP ${res.status}: ${responseText.substring(0, 500)}`);

      if (res.ok) {
        const nfeData = JSON.parse(responseText);
        console.log('[NFE Worker] Resposta da API NFE.io parseada com sucesso.');

        const valorTotal = nfeData.servicesAmount || nfeData.valorTotal || nfeData.amount || 0;
        const itens = nfeData.itemsCount || nfeData.itens || (nfeData.items ? nfeData.items.length : 1);
        const cashbackGerado = +(valorTotal * CASHBACK_RATE).toFixed(2);

        const resultado = {
          valido: true,
          estabelecimento: nfeData.borrower?.name || nfeData.estabelecimento || 'Não informado',
          cnpj: nfeData.borrower?.federalTaxNumber || nfeData.cnpj || 'Não informado',
          valorTotal,
          itens,
          dataEmissao: nfeData.issuedOn || nfeData.dataEmissao || nfeData.createdOn || '',
          cashbackGerado,
          chave: chave_acesso,
        };

        console.log(`[NFE Worker] Retornando dados REAIS da NF-e. Cashback: R$ ${cashbackGerado}`);
        return jsonResp(resultado, 200, corsHeaders);
      }

      console.warn(`[NFE Worker] API NFE.io retornou erro HTTP ${res.status}. Caindo para mock...`);
    } catch (fetchErr) {
      console.error('[NFE Worker] Exceção ao consultar NFE.io:', fetchErr.message);
      console.warn('[NFE Worker] Caindo para mock inteligente...');
    }
  } else {
    console.warn('[NFE Worker] NFE_API_KEY não configurada. Usando mock direto.');
  }

  // ── Fallback: Mock inteligente ──
  return buildMockResponse(chave_acesso, corsHeaders);
}

// ═══════════════════════════════════════════════════════════════
// MOCK INTELIGENTE (fallback garantido)
// ═══════════════════════════════════════════════════════════════
function buildMockResponse(chave_acesso, corsHeaders) {
  console.warn('[NFE Worker] Usando mock inteligente (fallback)');

  const valorTotal = 150.00;
  const cashbackGerado = +(valorTotal * CASHBACK_RATE).toFixed(2);

  const mockData = {
    valido: true,
    estabelecimento: 'Supermercado Demo',
    cnpj: '00.000.000/0001-00',
    valorTotal,
    itens: 12,
    dataEmissao: new Date().toISOString(),
    cashbackGerado,
    chave: chave_acesso,
    mock: true,
  };

  console.log(`[NFE Worker] Mock gerado → valorTotal: R$ ${valorTotal} | cashback: R$ ${cashbackGerado}`);
  return jsonResp(mockData, 200, corsHeaders);
}

// ═══════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════

/** Valida que a chave de acesso contém exatamente 44 dígitos numéricos */
function isValidChaveAcesso(chave) {
  return /^\d{44}$/.test(chave);
}

/** Helper para respostas JSON */
function jsonResp(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}
