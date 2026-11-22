  import { auth } from '../firebase-config.js';
  import {
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    onAuthStateChanged
  } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

  // ── Utilitarios ──────────────────────────────
  function toast(msg, type=''){
    const t = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    t.appendChild(el);
    setTimeout(()=>el.remove(), 3500);
  }

  function setLoading(btn, loading){
    btn.disabled = loading;
    btn.innerHTML = loading
      ? '<span class="spinner"></span> Entrando...'
      : 'Entrar na conta';
  }

  // ── Se ja logado, redirecionar ───────────────
  window.addEventListener('load',()=>{ document.getElementById('page-loader').classList.add('hide'); });
  onAuthStateChanged(auth,(user)=>{
    if(user) window.location.href = '/dashboard';
  });

  // ── Toggle visibilidade de senha ────────────
  const toggleSenha = document.getElementById('toggle-senha');
  const senhaInput = document.getElementById('senha');
  if (toggleSenha && senhaInput) {
    const eyeOpen = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>';
    const eyeOff = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>';
    toggleSenha.addEventListener('click', () => {
      const isPassword = senhaInput.type === 'password';
      senhaInput.type = isPassword ? 'text' : 'password';
      toggleSenha.innerHTML = isPassword ? eyeOff : eyeOpen;
    });
  }

  // ── Login com e-mail/senha ───────────────────
  document.getElementById('login-form').addEventListener('submit', async(e)=>{
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;
    const btn = document.getElementById('btn-login');

    // Validacoes basicas
    if(!email){ toast('Informe seu e-mail.','error'); return; }
    if(senha.length < 6){ toast('Senha deve ter pelo menos 6 caracteres.','error'); return; }

    setLoading(btn, true);
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      toast('Login realizado! Redirecionando...','success');
      setTimeout(()=>{ window.location.href = '/dashboard'; }, 1000);
    } catch(err){
      // Traduzir erros do Firebase para portugues
      const erros = {
        'auth/user-not-found':    'E-mail nao encontrado. Verifique ou crie uma conta.',
        'auth/wrong-password':    'Senha incorreta. Tente novamente.',
        'auth/invalid-email':     'E-mail invalido.',
        'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
        'auth/invalid-credential':'E-mail ou senha incorretos.',
        'auth/network-request-failed': 'Falha de conexao. Verifique sua internet.',
      };
      toast(erros[err.code] || `Erro: ${err.message}`, 'error');
      setLoading(btn, false);
    }
  });

  // ── Login com Google ─────────────────────────
  document.getElementById('btn-google').addEventListener('click', async()=>{
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast('Login com Google realizado!','success');
      setTimeout(()=>{ window.location.href = '/dashboard'; }, 800);
    } catch(err){
      const erros = {
        'auth/popup-closed-by-user':   null,
        'auth/cancelled-popup-request': null,
        'auth/popup-blocked':          'O pop-up foi bloqueado pelo navegador. Permita pop-ups e tente novamente.',
        'auth/account-exists-with-different-credential': 'Ja existe uma conta com este e-mail usando outro metodo de login.',
        'auth/network-request-failed': 'Falha de conexao. Verifique sua internet.',
      };
      if(erros[err.code] === null) return;
      toast(erros[err.code] || 'Erro ao entrar com Google. Tente novamente.', 'error');
    }
  });

  // ── Modal de Recuperacao de Senha ─────────────
  const overlay    = document.getElementById('reset-overlay');
  const modal      = document.getElementById('reset-modal');
  const btnForgot  = document.getElementById('btn-forgot');
  const btnClose   = document.getElementById('reset-close');
  const btnSend    = document.getElementById('btn-reset-send');
  const resetInput = document.getElementById('reset-email');
  const feedback   = document.getElementById('reset-feedback');

  function openResetModal(){
    // Pre-preencher com o e-mail do formulario de login, se houver
    const loginEmail = document.getElementById('email').value.trim();
    if(loginEmail) resetInput.value = loginEmail;
    feedback.className = 'reset-feedback';
    feedback.textContent = '';
    overlay.classList.add('active');
    setTimeout(()=> resetInput.focus(), 300);
  }

  function closeResetModal(){
    overlay.classList.remove('active');
  }

  btnForgot.addEventListener('click', openResetModal);
  btnClose.addEventListener('click', closeResetModal);

  // Fechar ao clicar fora do modal
  overlay.addEventListener('click', (e)=>{
    if(e.target === overlay) closeResetModal();
  });

  // Fechar com Escape
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && overlay.classList.contains('active')){
      closeResetModal();
    }
  });

  // Enviar e-mail de redefinicao
  btnSend.addEventListener('click', async()=>{
    const email = resetInput.value.trim();

    if(!email){
      feedback.className = 'reset-feedback show error';
      feedback.textContent = 'Informe um e-mail valido para continuar.';
      resetInput.focus();
      return;
    }

    btnSend.disabled = true;
    btnSend.innerHTML = '<span class="spinner"></span> Enviando...';

    try {
      await sendPasswordResetEmail(auth, email);
      feedback.className = 'reset-feedback show success';
      feedback.textContent = 'E-mail enviado! Verifique sua caixa de entrada e a pasta de spam.';
      btnSend.textContent = 'E-mail enviado';

      // Fechar apos alguns segundos
      setTimeout(()=>{
        closeResetModal();
        btnSend.disabled = false;
        btnSend.textContent = 'Enviar link de redefinicao';
      }, 4000);

    } catch(err){
      const erros = {
        'auth/user-not-found':    'Nenhuma conta encontrada com este e-mail.',
        'auth/invalid-email':     'Formato de e-mail invalido.',
        'auth/too-many-requests': 'Muitas solicitacoes. Aguarde alguns minutos.',
        'auth/network-request-failed': 'Falha de conexao. Verifique sua internet.',
      };
      feedback.className = 'reset-feedback show error';
      feedback.textContent = erros[err.code] || 'Erro ao enviar e-mail. Tente novamente.';
      btnSend.disabled = false;
      btnSend.textContent = 'Enviar link de redefinicao';
    }
  });

  // Enviar com Enter no campo de e-mail do modal
  resetInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      e.preventDefault();
      btnSend.click();
    }
  });
