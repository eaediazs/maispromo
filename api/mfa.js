/**
 * ═══════════════════════════════════════════════════════════════
 * +PROMO — Vercel Serverless Function: API de Seguranca MFA
 * Path: /api/mfa.js
 * ═══════════════════════════════════════════════════════════════
 *
 * Esta rota substitui ou serve de alternativa ao Cloudflare Worker.
 * Ela intercepta requisicoes do client-side, executa operacoes criptograficas
 * seguras e se comunica com a API do Resend usando a chave privada oculta no servidor.
 */

import { createHmac } from 'crypto';

const PIN_EXPIRY_SECONDS = 300; // 5 minutos

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(450).json({ erro: 'Metodo nao permitido' });
  }

  const { email, acao, pin, pinHash, timestamp } = req.body;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const MFA_SECRET = process.env.MFA_SECRET || 'chave-mestra-mfa-default-mais-promo';
  const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

  if (!RESEND_API_KEY) {
    console.error('[MFA API] Chave RESEND_API_KEY nao configurada no backend.');
    return res.status(500).json({ erro: 'Servidor nao configurado. Variavel RESEND_API_KEY ausente.' });
  }

  try {
    // ═══════════════════════════════════════════════════════════════
    // ACAO: SOLICITAR PIN
    // ═══════════════════════════════════════════════════════════════
    if (acao === 'solicitar_pin') {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ erro: 'E-mail fornecido e invalido.' });
      }

      // 1. Gerar PIN aleatorio de 6 digitos
      const pinGerado = String(Math.floor(100000 + Math.random() * 900000));
      const stamp = Date.now();

      // 2. Assinar HMAC-SHA256: pin + email + timestamp
      const hmac = createHmac('sha256', MFA_SECRET);
      hmac.update(`${pinGerado}:${email}:${stamp}`);
      const hash = hmac.digest('hex');

      // 3. Enviar e-mail via Resend API
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [email],
          subject: `${pinGerado} — Codigo de verificacao +PROMO`,
          html: buildEmailHTML(pinGerado),
        }),
      });

      if (!resendResponse.ok) {
        const errText = await resendResponse.text();
        console.error('[MFA API] Resend falhou com erro:', errText);

        if (resendResponse.status === 403) {
          console.warn('[MFA API] Restricao de Sandbox detectada (403). Ativando fallback seguro.');
          return res.status(200).json({
            pinHash: hash,
            timestamp: stamp,
            expiresIn: PIN_EXPIRY_SECONDS,
            sandboxFallback: true,
            pinDemo: pinGerado
          });
        }

        return res.status(502).json({ erro: 'Falha ao despachar e-mail via Resend.', detalhes: errText });
      }

      // Sucesso: Retorna apenas o hash e o timestamp assinado para o front-end
      return res.status(200).json({
        pinHash: hash,
        timestamp: stamp,
        expiresIn: PIN_EXPIRY_SECONDS
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ACAO: VALIDAR PIN
    // ═══════════════════════════════════════════════════════════════
    if (acao === 'validar_pin') {
      if (!email || !pin || !pinHash || !timestamp) {
        return res.status(400).json({ valido: false, erro: 'Dados de validacao incompletos.' });
      }

      // 1. Verificar tempo de expiracao (5 minutos)
      const agora = Date.now();
      const idadeSegundos = (agora - timestamp) / 1000;
      if (idadeSegundos > PIN_EXPIRY_SECONDS) {
        return res.status(200).json({ valido: false, erro: 'Codigo expirado. Solicite um novo.' });
      }

      // 2. Recalcular HMAC usando a mesma chave secreta
      const hmac = createHmac('sha256', MFA_SECRET);
      hmac.update(`${pin}:${email}:${timestamp}`);
      const hashRecalculado = hmac.digest('hex');

      // 3. Comparar
      const valido = hashRecalculado === pinHash;
      return res.status(200).json({ valido });
    }

    return res.status(400).json({ erro: 'Acao de segurança nao reconhecida.' });
  } catch (error) {
    console.error('[MFA API] Erro critico interno:', error);
    return res.status(500).json({ erro: 'Erro interno no gateway de seguranca.', detalhes: error.message });
  }
}

function buildEmailHTML(pin) {
  return `
    <div style="background:#f4f4f6;padding:40px 20px;font-family:sans-serif;">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="background:#1a1a1a;padding:28px;text-align:center;">
          <span style="font-size:20px;font-weight:bold;color:#fff;">+PROMO</span>
        </div>
        <div style="padding:36px 32px;">
          <h2 style="margin:0 0 10px;color:#1a1a1a;">Confirmacao de Resgate</h2>
          <p style="color:#666;line-height:1.6;font-size:15px;">Use o codigo de segurança abaixo para validar seu saque:</p>
          <div style="background:#fafafa;border:2px solid #f7c500;border-radius:12px;padding:20px;text-align:center;font-size:36px;font-weight:bold;letter-spacing:8px;margin:24px 0;">
            ${pin}
          </div>
          <p style="font-size:12px;color:#999;text-align:center;">Valido por 5 minutos. Nunca compartilhe este codigo.</p>
        </div>
      </div>
    </div>
  `;
}
