import { auth, db } from '../firebase-config.js';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ═══════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════

window.addEventListener('load', () => {
  document.getElementById('page-loader')?.classList.add('hide');
});

// ── Pré-selecionar plano via URL (?plano=plus) ────────────────
const urlPlano = new URLSearchParams(window.location.search).get('plano');
if (urlPlano && ['basic', 'plus', 'premium'].includes(urlPlano)) {
  const sel = document.getElementById('plano-select');
  if (sel) sel.value = urlPlano;
  document.querySelectorAll('input[name="plano-side"]').forEach(r => {
    r.checked = r.value === urlPlano;
    r.parentElement.classList.toggle('selected', r.value === urlPlano);
  });
}

// ── Se já logado, ir para dashboard ───────────────────────────
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = '/dashboard';
});

// ═══════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════

function toast(msg, type = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function setLoading(btn, loading, defaultText = 'Criar conta e assinar →') {
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner"></span> Criando conta...'
    : defaultText;
}

// ═══════════════════════════════════════════════════════════════
// MEDIDOR DE FORÇA DA SENHA
// ═══════════════════════════════════════════════════════════════

const senhaInput = document.getElementById('senha');
if (senhaInput) {
  senhaInput.addEventListener('input', function () {
    const valor = this.value;
    const fill = document.getElementById('ps-fill');
    const label = document.getElementById('ps-label');
    if (!fill || !label) return;

    let forca = 0;
    if (valor.length >= 6) forca++;
    if (valor.length >= 10) forca++;
    if (/[A-Z]/.test(valor)) forca++;
    if (/[0-9]/.test(valor)) forca++;
    if (/[^A-Za-z0-9]/.test(valor)) forca++;

    const configs = [
      { w: '0%', c: '#ccc', t: 'Digite sua senha' },
      { w: '25%', c: 'var(--red)', t: 'Muito fraca' },
      { w: '50%', c: 'var(--yellow-d)', t: 'Fraca' },
      { w: '75%', c: '#F59E0B', t: 'Boa' },
      { w: '90%', c: 'var(--green)', t: 'Forte' },
      { w: '100%', c: 'var(--green)', t: 'Muito forte ✓' },
    ];
    const cfg = configs[Math.min(forca, 5)];
    fill.style.width = cfg.w;
    fill.style.background = cfg.c;
    label.textContent = cfg.t;
    label.style.color = cfg.c;
  });
}

// ═══════════════════════════════════════════════════════════════
// TOGGLE VISIBILIDADE DE SENHA
// ═══════════════════════════════════════════════════════════════

const toggleSenhaBtn = document.getElementById('toggle-senha');
if (toggleSenhaBtn && senhaInput) {
  const eyeOpen = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>';
  const eyeOff = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>';
  toggleSenhaBtn.addEventListener('click', () => {
    const isPassword = senhaInput.type === 'password';
    senhaInput.type = isPassword ? 'text' : 'password';
    toggleSenhaBtn.innerHTML = isPassword ? eyeOff : eyeOpen;
  });
}

// ═══════════════════════════════════════════════════════════════
// SINCRONIZAR SELETOR DE PLANO LATERAL
// ═══════════════════════════════════════════════════════════════

document.querySelectorAll('input[name="plano-side"]').forEach(radio => {
  radio.addEventListener('change', () => {
    document.querySelectorAll('.plan-opt').forEach(opt => opt.classList.remove('selected'));
    radio.parentElement.classList.add('selected');
    const select = document.getElementById('plano-select');
    if (select) select.value = radio.value;
  });
});

const planoSelect = document.getElementById('plano-select');
if (planoSelect) {
  planoSelect.addEventListener('change', function () {
    document.querySelectorAll('input[name="plano-side"]').forEach(radio => {
      radio.checked = radio.value === this.value;
      radio.parentElement.classList.toggle('selected', radio.value === this.value);
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// CADASTRO COM E-MAIL E SENHA
// ═══════════════════════════════════════════════════════════════

async function criarContaFirestore(user, nome, sobrenome, plano) {
  await setDoc(doc(db, 'usuarios', user.uid), {
    nome: `${nome} ${sobrenome}`.trim(),
    email: user.email,
    plano: plano,
    cashback: 0,
    milhas: 0,
    nivel: 'Iniciante',
    pontos: 0,
    criadoEm: serverTimestamp(),
    ativo: true,
    gastoMes: 0,
    cashbackMes: 0,
  });
}

const cadastroForm = document.getElementById('cadastro-form');
if (cadastroForm) {
  cadastroForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('nome')?.value.trim() || '';
    const sobrenome = document.getElementById('sobrenome')?.value.trim() || '';
    const email = document.getElementById('email')?.value.trim() || '';
    const senha = document.getElementById('senha')?.value || '';
    const plano = document.getElementById('plano-select')?.value || 'plus';
    const btn = document.getElementById('btn-cadastro');
    const termosChecked = document.getElementById('termos')?.checked;

    // Validações
    if (!nome) { toast('Informe seu nome.', 'error'); return; }
    if (!email) { toast('Informe seu e-mail.', 'error'); return; }
    if (senha.length < 8) { toast('A senha deve ter pelo menos 8 caracteres.', 'error'); return; }
    if (!termosChecked) { toast('Aceite os termos para continuar.', 'warning'); return; }

    setLoading(btn, true);

    try {
      // 1. Criar usuário no Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      const user = cred.user;

      // 2. Salvar nome de exibição
      await updateProfile(user, { displayName: `${nome} ${sobrenome}`.trim() });

      // 3. Enviar e-mail de verificação
      await sendEmailVerification(user);

      // 4. Criar documento do usuário no Firestore
      await criarContaFirestore(user, nome, sobrenome, plano);

      toast('Conta criada! Enviamos um e-mail de verificação para ' + email, 'success');
      setTimeout(() => { window.location.href = '/dashboard'; }, 1500);

    } catch (err) {
      const erros = {
        'auth/email-already-in-use': 'Este e-mail já está cadastrado. Faça login.',
        'auth/invalid-email': 'E-mail inválido.',
        'auth/weak-password': 'Senha muito fraca. Use pelo menos 8 caracteres.',
      };
      
      // Diagnostico: Expor erro de envio de falhas de autenticacao
      console.error("[DEBUG AUTH] Falha no cadastro ou verificacao:", err);
      
      toast(erros[err.code] || 'Erro ao criar conta. Tente novamente.', 'error');
      setLoading(btn, false);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// CADASTRO/LOGIN COM GOOGLE (sem senha)
// ═══════════════════════════════════════════════════════════════

const btnGoogle = document.getElementById('btn-google');
if (btnGoogle) {
  btnGoogle.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    const plano = document.getElementById('plano-select')?.value || 'plus';

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const isNewUser = result._tokenResponse?.isNewUser;

      if (isNewUser) {
        // Novo usuário via Google: criar perfil no Firestore
        const [nome, ...sobrenomeParts] = (user.displayName || 'Usuário').split(' ');
        await criarContaFirestore(user, nome, sobrenomeParts.join(' '), plano);
        toast('Conta criada com Google! Bem-vindo!', 'success');
      } else {
        toast('Login com Google realizado!', 'success');
      }

      setTimeout(() => { window.location.href = '/dashboard'; }, 800);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        toast('Erro ao entrar com Google. Tente novamente.', 'error');
      }
    }
  });
}
