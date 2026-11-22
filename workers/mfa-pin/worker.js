/**
 * ═══════════════════════════════════════════════════════════════
 * +PROMO — Cloudflare Worker: MFA PIN para Saque (v2 — Resend)
 * ═══════════════════════════════════════════════════════════════
 *
 * REESCRITO DO ZERO — 2026-05-19
 *
 * Fluxo stateless de verificação de PIN por e-mail.
 * Usa HMAC-SHA256 para assinar o PIN sem armazená-lo.
 * Envia e-mail via Resend (https://api.resend.com/emails).
 *
 * Variáveis de Ambiente (Cloudflare Dashboard → Settings → Variables):
 *   - RESEND_API_KEY   → Chave da API Resend (re_xxxxxxxx)
 *   - MFA_SECRET       → Segredo para HMAC (gerar com: openssl rand -hex 32)
 *
 * Ações:
 *   POST { email, acao: "solicitar_pin" }
 *     → Gera PIN, envia e-mail via Resend, retorna { pinHash, timestamp }
 *
 *   POST { email, pin, pinHash, timestamp, acao: "validar_pin" }
 *     → Recalcula HMAC e compara. Retorna { valido: true/false }
 */

const PIN_EXPIRY_SECONDS = 300; // 5 minutos

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
      console.error('[Worker] Falha ao fazer parse do body JSON:', parseErr.message);
      return jsonResp(
        { erro: 'Body da requisição não é JSON válido.', detalhe: parseErr.message },
        400,
        corsHeaders
      );
    }

    const { acao } = body;
    console.log(`[Worker] Ação recebida: "${acao}" | email: "${body.email || '(vazio)'}"`);

    try {
      if (acao === 'solicitar_pin') {
        return await handleSolicitarPin(body, env, corsHeaders);
      }

      if (acao === 'validar_pin') {
        return await handleValidarPin(body, env, corsHeaders);
      }

      return jsonResp({ erro: `Ação "${acao}" inválida. Use "solicitar_pin" ou "validar_pin".` }, 400, corsHeaders);
    } catch (err) {
      console.error('[Worker] Erro não capturado:', err.message, err.stack);
      return jsonResp(
        { erro: 'Erro interno do Worker.', detalhe: err.message },
        500,
        corsHeaders
      );
    }
  },
};

// ═══════════════════════════════════════════════════════════════
// AÇÃO: SOLICITAR PIN
// ═══════════════════════════════════════════════════════════════
async function handleSolicitarPin({ email }, env, corsHeaders) {
  // ── Validação do e-mail ──
  if (!email || !isValidEmail(email)) {
    return jsonResp({ erro: 'E-mail inválido ou ausente.' }, 400, corsHeaders);
  }

  // ── Verificação da API Key ──
  if (!env.RESEND_API_KEY) {
    console.error('[Worker] RESEND_API_KEY não está configurada nas variáveis de ambiente!');
    return jsonResp(
      { erro: 'Configuração do servidor incompleta: chave da API de e-mail ausente.' },
      500,
      corsHeaders
    );
  }

  // ── Verificação do segredo HMAC ──
  if (!env.MFA_SECRET) {
    console.error('[Worker] MFA_SECRET não está configurado nas variáveis de ambiente!');
    return jsonResp(
      { erro: 'Configuração do servidor incompleta: segredo MFA ausente.' },
      500,
      corsHeaders
    );
  }

  // ── Gerar PIN ──
  const pin = generateSecurePin();
  const timestamp = Date.now();
  console.log(`[Worker] PIN gerado para ${email} às ${new Date(timestamp).toISOString()}`);

  // ── Assinar com HMAC-SHA256 ──
  const pinHash = await hmacSign(pin, email, timestamp, env.MFA_SECRET);

  // ── Enviar e-mail via Resend ──
  const emailResult = await sendPinViaResend(email, pin, env.RESEND_API_KEY);

  if (!emailResult.success) {
    console.error('[Worker] Falha no envio Resend:', JSON.stringify(emailResult));
    return jsonResp(
      {
        erro: 'Falha ao enviar e-mail de verificação.',
        detalhe: emailResult.errorBody,
        statusResend: emailResult.statusCode,
      },
      502,
      corsHeaders
    );
  }

  console.log(`[Worker] E-mail enviado com sucesso! Resend ID: ${emailResult.resendId}`);

  // ── Resposta: NUNCA inclui o PIN ──
  return jsonResp(
    {
      pinHash,
      timestamp,
      expiresIn: PIN_EXPIRY_SECONDS,
      emailEnviado: true,
    },
    200,
    corsHeaders
  );
}

// ═══════════════════════════════════════════════════════════════
// AÇÃO: VALIDAR PIN
// ═══════════════════════════════════════════════════════════════
async function handleValidarPin({ email, pin, pinHash, timestamp }, env, corsHeaders) {
  if (!email || !pin || !pinHash || !timestamp) {
    return jsonResp(
      { valido: false, erro: 'Dados incompletos. Campos: email, pin, pinHash, timestamp.' },
      400,
      corsHeaders
    );
  }

  // ── Verificar expiração ──
  const agora = Date.now();
  const idadeSegundos = (agora - timestamp) / 1000;
  if (idadeSegundos > PIN_EXPIRY_SECONDS) {
    console.log(`[Worker] PIN expirado. Idade: ${idadeSegundos.toFixed(0)}s > ${PIN_EXPIRY_SECONDS}s`);
    return jsonResp(
      { valido: false, erro: 'Código expirado. Solicite um novo.' },
      200,
      corsHeaders
    );
  }

  // ── Recalcular HMAC com o PIN inserido pelo utilizador ──
  const hashRecalculado = await hmacSign(pin, email, timestamp, env.MFA_SECRET);
  const valido = hashRecalculado === pinHash;

  console.log(`[Worker] Validação PIN: ${valido ? 'SUCESSO' : 'FALHA'} para ${email}`);

  return jsonResp({ valido }, 200, corsHeaders);
}

// ═══════════════════════════════════════════════════════════════
// ENVIO DE E-MAIL VIA RESEND (api.resend.com/emails)
// ═══════════════════════════════════════════════════════════════
async function sendPinViaResend(toEmail, pin, apiKey) {
  const resendPayload = {
    from: 'Segurança +PROMO <seguranca@maispromo.site>',
    to: [toEmail],
    subject: `${pin} — Código de verificação +PROMO`,
    html: buildEmailHTML(pin),
  };

  console.log('[Worker] Payload Resend (sem html):', JSON.stringify({ ...resendPayload, html: '(omitido)' }));

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    });

    // SEMPRE ler o body — mesmo em sucesso — para diagnóstico
    const responseText = await res.text();
    console.log(`[Worker] Resend HTTP ${res.status}: ${responseText}`);

    if (!res.ok) {
      return {
        success: false,
        statusCode: res.status,
        errorBody: responseText,
      };
    }

    // Extrair ID do e-mail enviado
    let resendId = null;
    try {
      const parsed = JSON.parse(responseText);
      resendId = parsed.id || null;
    } catch (_) {}

    return { success: true, resendId };
  } catch (fetchErr) {
    console.error('[Worker] fetch para Resend lançou exceção:', fetchErr.message);
    return {
      success: false,
      statusCode: 0,
      errorBody: `Exceção de rede: ${fetchErr.message}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE HTML DO E-MAIL (clean, anti-spam)
// ═══════════════════════════════════════════════════════════════
function buildEmailHTML(pin) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:#1a1a1a;padding:28px 32px;text-align:center;">
          <span style="display:inline-block;width:32px;height:32px;background:#f7c500;border-radius:8px;line-height:32px;font-size:16px;font-weight:900;color:#1a1a1a;vertical-align:middle;">+</span>
          <span style="font-size:20px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;vertical-align:middle;margin-left:8px;">+PROMO</span>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 32px 28px;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1a1a1a;">Verificação de Saque</h1>
          <p style="margin:0 0 28px;font-size:15px;color:#666;line-height:1.6;">
            Recebemos uma solicitação de resgate de cashback na sua conta +PROMO. Use o código abaixo para confirmar:
          </p>

          <!-- PIN Box -->
          <div style="background:#fafafa;border:2px solid #f7c500;border-radius:14px;padding:24px;text-align:center;margin:0 0 28px;">
            <div style="font-size:40px;font-weight:900;letter-spacing:12px;color:#1a1a1a;font-family:'Courier New',monospace;">
              ${pin}
            </div>
            <div style="font-size:12px;color:#999;margin-top:8px;">Válido por 5 minutos</div>
          </div>

          <p style="margin:0 0 4px;font-size:13px;color:#999;line-height:1.5;">
            Se você não solicitou este código, ignore este e-mail. Sua conta permanece segura.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #ebebeb;text-align:center;">
          <p style="margin:0;font-size:11px;color:#bbb;">
            +Promo · maispromo.site<br>
            Este é um e-mail automático. Não responda.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════

/** Gera PIN aleatório de 6 dígitos usando crypto seguro */
function generateSecurePin() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100000 + (array[0] % 900000));
}

/** Valida formato básico de e-mail */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** HMAC-SHA256(pin + email + timestamp) usando Web Crypto API */
async function hmacSign(pin, email, timestamp, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const data = encoder.encode(`${pin}:${email}:${timestamp}`);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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
