/**
 * Cloudflare Pages Function — Proxy seguro para Google Gemini (Omni-Catcher)
 * Rota: /api/recomenda
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
};

// Função auxiliar para padronizar erros
function errorResponse(status, mensagem) {
  return new Response(JSON.stringify({ sucesso: false, erro: mensagem }), {
    status: status,
    headers: CORS_HEADERS,
  });
}

// ─── HANDLER UNIVERSAL (Captura tudo e evita o erro 405 do Cloudflare) ───
export async function onRequest(context) {
  const { request, env } = context;

  // 1. Libera o CORS na hora (Preflight)
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // 2. Trava qualquer coisa que não seja POST com uma mensagem nossa, não do Cloudflare
  if (request.method !== "POST") {
    return errorResponse(405, `Método ${request.method} não permitido. Use POST.`);
  }

  // 3. Valida a chave de API
  const GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return errorResponse(500, "Chave GEMINI_API_KEY não encontrada nas variáveis de ambiente do Cloudflare.");
  }

  // 4. Inicia o processamento do POST
  try {
    const body = await request.json();
    const gastos = body.gastos || {};

    // Cria o prompt rigoroso
    const prompt = `
Você é o motor de recomendação do +Promo, um app de cashback premium brasileiro.
Com base nos gastos mensais do usuário abaixo, retorne SOMENTE um objeto JSON válido.

Gastos:
${JSON.stringify(gastos, null, 2)}

Estrutura EXATA do JSON:
{
  "arquetipo": {
    "nome": "string (ex: O Viajante, Mestre-Cuca)",
    "descricao": "string curta"
  },
  "ofertas": [
    { "categoria": "string", "titulo": "string", "descricao": "string", "cashback": "string", "destaque": true }
  ],
  "rotaDeCompras": [
    { "ordem": 1, "loja": "string", "dica": "string" }
  ],
  "cupons": [
    { "codigo": "string", "desconto": "string", "validade": "string" }
  ]
}
Gere 3 ofertas, 3 rotas e 2 cupons. NUNCA use markdown (\`\`\`json). APENAS o objeto JSON puro.`;

    // 5. Chama a API do Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
    });

    if (!geminiRes.ok) {
      const errorGoogle = await geminiRes.text();
      return errorResponse(502, `Falha na API do Google: ${errorGoogle}`);
    }

    const geminiData = await geminiRes.json();
    let textoResposta = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textoResposta) {
      return errorResponse(500, "O Gemini retornou uma resposta vazia.");
    }

    // 6. Limpa o markdown caso a IA teime em mandar
    textoResposta = textoResposta.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const jsonFinal = JSON.parse(textoResposta);

    // 7. Retorna o SUCESSO para o Front-end
    return new Response(JSON.stringify({ sucesso: true, data: jsonFinal }), {
      status: 200,
      headers: CORS_HEADERS,
    });

  } catch (err) {
    return errorResponse(400, `Erro ao processar dados: ${err.message}`);
  }
}
