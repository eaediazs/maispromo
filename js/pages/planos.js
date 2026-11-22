  import { auth, db } from '../firebase-config.js';
  import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
  import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

  window.addEventListener('load',()=>{ document.getElementById('page-loader').classList.add('hide'); });

  // ═══════════════════════════════════════════════
  // INOVAÇÃO 1 — Magic Card Spotlight Glow
  // Rastreia mouse em cada card e atualiza --mx/--my
  // ═══════════════════════════════════════════════
  document.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mx', x + 'px');
      card.style.setProperty('--my', y + 'px');
    });
    card.addEventListener('mouseleave', () => {
      // Reset suavemente ao centro
      card.style.setProperty('--mx', '50%');
      card.style.setProperty('--my', '50%');
    });
  });

  // ═══════════════════════════════════════════════
  // INOVAÇÃO 2 — Cascade Checkmarks (IntersectionObserver)
  // Cada .plan-feat anima em cascata quando o card entra na viewport
  // ═══════════════════════════════════════════════
  function initCascade() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const feats = entry.target.querySelectorAll('.plan-feat');
          feats.forEach((feat, i) => {
            setTimeout(() => {
              feat.classList.add('cascaded');
            }, 80 + i * 60);
          });
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    document.querySelectorAll('.plan-card').forEach(card => observer.observe(card));
  }
  initCascade();

  // ── Toggle mensal/anual ──────────────────────
  const precos = { basic:[19,15], plus:[39,31], premium:[69,55] };
  let anual = false;

  function flipPrice(id, val) {
    const el = document.getElementById(id);
    el.classList.add('price-flipping');
    setTimeout(() => {
      el.textContent = val;
      el.classList.remove('price-flipping');
    }, 200);
  }

  function updatePrices(){
    Object.entries(precos).forEach(([p,[m,a]])=>{
      const v = anual ? a : m;
      const partes = v.toFixed(2).split('.');
      flipPrice(`price-${p}`, partes[0]);
      flipPrice(`cents-${p}`, ','+partes[1]);
      setTimeout(() => {
        document.getElementById(`period-${p}`).textContent = anual
          ? `R$ ${(v*12).toFixed(0)} cobrado anualmente`
          : 'por mês · cobrado mensalmente';
      }, 200);
    });
  }

  document.getElementById('btn-mensal').addEventListener('click',()=>{
    anual=false;
    document.getElementById('btn-mensal').classList.add('on');
    document.getElementById('btn-anual').classList.remove('on');
    document.getElementById('annual-tip').classList.add('hidden');
    updatePrices();
  });
  document.getElementById('btn-anual').addEventListener('click',()=>{
    anual=true;
    document.getElementById('btn-anual').classList.add('on');
    document.getElementById('btn-mensal').classList.remove('on');
    document.getElementById('annual-tip').classList.remove('hidden');
    updatePrices();
  });
  updatePrices();

  // ── FAQ ──────────────────────────────────────
  const faqs = [
    { q:'Como funciona o cashback?', a:'Ao comprar em um parceiro +Promo, uma porcentagem do valor cai automaticamente no seu saldo. Você pode sacar quando atingir o valor mínimo do seu plano.' },
    { q:'Posso cancelar quando quiser?', a:'Sim! Não há fidelidade. Você pode cancelar a qualquer momento pelo painel do usuário, sem nenhuma taxa de cancelamento.' },
    { q:'Como resgato o cashback?', a:'No seu Dashboard, basta clicar em "Resgatar saldo". Você pode transferir para sua conta bancária ou usar como desconto na próxima fatura.' },
    { q:'O que são as milhas aéreas?', a:'Disponíveis nos planos Plus e Premium, as milhas são acumuladas a cada R$1 gasto em parceiros. Elas podem ser trocadas por passagens aéreas, upgrades e produtos.' },
    { q:'Qual a diferença entre os planos?', a:'Os planos diferem em % de cashback (2%, 4% ou 6%), quantidade de parceiros disponíveis, presença de milhas e cupons mensais.' },
    { q:'Como funciona o programa de níveis?', a:'Cada compra em parceiros gera pontos. Com mais pontos você sobe de nível (Iniciante → Explorador → Fiel → VIP → Embaixador) e desbloqueia cashback bônus.' },
    { q:'Posso indicar amigos?', a:'Sim! No painel de Indicações você gera um link único. Quando alguém assina pelo seu link, você ganha R$15 de cashback bônus e o indicado ganha 1 mês de upgrade.' },
    { q:'O pagamento é seguro?', a:'Absolutamente. Usamos criptografia de ponta a ponta e não armazenamos dados de cartão. O pagamento é processado por operadoras certificadas.' },
  ];

  const grid = document.getElementById('faq-grid');
  grid.innerHTML = faqs.map((f,i)=>`
    <div class="faq-item" id="faq-${i}">
      <div class="faq-q" onclick="toggleFaq(${i})">
        <span>${f.q}</span>
        <svg class="faq-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="faq-a">${f.a}</div>
    </div>`).join('');

  window.toggleFaq = (i)=>{
    const el = document.getElementById(`faq-${i}`);
    el.classList.toggle('open');
  };

  // ── Modal ──────────────────────────────────────
  let planoSelecionado = '';
  const planNames = { basic:'Plano Basic', plus:'Plano Plus', premium:'Plano Premium' };
  const planCosts = { basic:'R$ 19,90', plus:'R$ 39,90', premium:'R$ 69,90' };

  window.openModal = (plano)=>{
    planoSelecionado = plano;
    document.getElementById('m-title').textContent = `Assinar ${planNames[plano]}`;
    document.getElementById('m-sub').textContent   = `${planCosts[plano]}/mês · Cancele quando quiser`;
    document.getElementById('modal-overlay').classList.add('open');
    onAuthStateChanged(auth,(u)=>{
      if(u){
        document.getElementById('sub-email').value = u.email||'';
        document.getElementById('sub-nome').value  = u.displayName||'';
      }
    });
  };
  window.closeModal = ()=>{
    document.getElementById('modal-overlay').classList.remove('open');
  };
  document.getElementById('modal-overlay').addEventListener('click',(e)=>{
    if(e.target===e.currentTarget) closeModal();
  });

  // ── Submissão ─────────────────────────────────
  function toast(msg,type=''){
    const t=document.getElementById('toast-container');
    const el=document.createElement('div'); el.className=`toast ${type}`; el.textContent=msg;
    t.appendChild(el); setTimeout(()=>el.remove(),3500);
  }

  document.getElementById('sub-form').addEventListener('submit', async(e)=>{
    e.preventDefault();
    const btn=document.getElementById('sub-btn');
    const user = auth.currentUser;
    btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Processando...';
    if(!user){
      sessionStorage.setItem('plano_escolhido', planoSelecionado);
      toast('Crie sua conta para assinar!','warning');
      setTimeout(()=>{ window.location.href = '/cadastro'; },1000);
      return;
    }
    try {
      await updateDoc(doc(db,'usuarios',user.uid),{ plano: planoSelecionado });
      toast(`${planNames[planoSelecionado]} ativado com sucesso! `,'success');
      closeModal();
      setTimeout(()=>{ window.location.href = '/dashboard'; },1500);
    } catch(err){
      toast('Erro ao atualizar plano. Tente novamente.','error');
      btn.disabled=false; btn.innerHTML='Confirmar assinatura →';
    }
  });

  // Máscara CPF
  document.getElementById('sub-cpf').addEventListener('input',function(){
    let v = this.value.replace(/\D/g,'').slice(0,11);
    if(v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4');
    else if(v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d+)/,'$1.$2.$3');
    else if(v.length > 3) v = v.replace(/(\d{3})(\d+)/,'$1.$2');
    this.value = v;
  });
