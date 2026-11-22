# Política de Cancelamento e Exclusão de Conta — +Promo

**Última atualização:** 14 de abril de 2026  
**Versão:** 1.0

---

## 1. Sobre esta Política

Esta Política descreve, passo a passo, como você pode cancelar sua assinatura e/ou solicitar a exclusão completa da sua conta e dos seus dados pessoais do +Promo.

Elaborada em conformidade com a **Lei Geral de Proteção de Dados** (LGPD — Lei nº 13.709/2018), especialmente os arts. 15 e 16, que tratam do término do tratamento de dados pessoais.

---

## 2. Cancelamento da assinatura vs. Exclusão da conta

É importante entender que são **duas coisas diferentes**:

| Ação | O que acontece |
|------|---------------|
| **Cancelar a assinatura** | Você deixa de pagar o plano mensal, mas sua conta e dados continuam existindo. Você pode reativar futuramente. |
| **Excluir a conta** | Todos os seus dados pessoais são permanentemente removidos dos nossos sistemas. Essa ação é **irreversível**. |

Você pode fazer apenas uma das duas, ou ambas.

---

## 3. Como cancelar a assinatura

### Passo a passo

1. Acesse o seu painel em **maispromo.site/dashboard**;
2. Clique no seu avatar ou nome no menu lateral;
3. Selecione a opção **"Gerenciar plano"**;
4. Clique em **"Cancelar assinatura"**;
5. Confirme o cancelamento.

### O que acontece após o cancelamento da assinatura

- Sua conta **continua ativa** com acesso ao painel;
- O **saldo de cashback aprovado** permanece disponível para saque durante **90 dias** após o cancelamento;
- As **milhas e pontos** continuam no seu perfil, porém ficam **congelados** (não acumulam nem podem ser utilizados enquanto não houver plano ativo);
- Após **90 dias** sem reativação de plano, o saldo de cashback não resgatado será **expirado** e não poderá mais ser sacado;
- Após **12 meses** de inatividade total (sem login), a conta poderá ser considerada inativa e tratada conforme item 6 desta Política.

### Reativação

Você pode reativar sua assinatura a qualquer momento, escolhendo qualquer plano disponível. Ao reativar:
- Seu histórico e nível de fidelidade serão preservados;
- Milhas e pontos congelados voltam a ficar ativos;
- Saldos de cashback já expirados **não** serão restaurados.

---

## 4. Como solicitar a exclusão total da conta

Se você deseja que **todos os seus dados pessoais** sejam permanentemente removidos dos nossos sistemas, siga o procedimento abaixo.

### 4.1. Antes de pedir a exclusão

> ⚠️ **Atenção:** A exclusão da conta é **permanente e irreversível**. Antes de prosseguir, considere:

- **Resgate seu saldo:** Qualquer saldo de cashback aprovado que não tiver sido sacado será **perdido**. Não há possibilidade de recuperação após a exclusão;
- **Salve seus dados:** Se desejar manter uma cópia dos seus dados, solicite a **portabilidade** antes da exclusão (veja seção 5);
- **Cupons ativos:** Cupons não utilizados serão invalidados;
- **Indicações:** Seus indicados continuam com suas contas normalmente, mas seu bônus de indicação pendente será cancelado.

### 4.2. Passo a passo para exclusão

**Opção 1 — Por e-mail (recomendado)**

1. Envie um e-mail para **sacmaispromo@gmail.com**;
2. Use o assunto: **"Solicito exclusão de conta — [seu e-mail de cadastro]"**;
3. No corpo do e-mail, confirme:
   - O e-mail vinculado à sua conta;
   - A declaração: *"Estou ciente de que a exclusão é irreversível e que perderei qualquer saldo de cashback não resgatado."*
4. Aguarde a confirmação.

**Opção 2 — Pelo painel**

1. Acesse **maispromo.site/dashboard**;
2. Clique no seu avatar ou nome no menu lateral;
3. Selecione **"Conta e privacidade"**;
4. Clique em **"Excluir minha conta permanentemente"**;
5. Leia o aviso e confirme digitando seu e-mail;
6. Clique em **"Excluir conta"**.

### 4.3. Prazos de processamento

| Etapa | Prazo |
|-------|-------|
| Confirmação do recebimento da solicitação | Até **2 dias úteis** |
| Processamento e exclusão efetiva dos dados | Até **15 dias corridos** |
| Confirmação final de exclusão (por e-mail) | Enviada ao término do processo |

---

## 5. O que acontece com seus dados após a exclusão

### 5.1. Dados excluídos imediatamente

Os seguintes dados serão **permanentemente apagados** dos nossos sistemas (Firebase Auth + Cloud Firestore):

- Nome e sobrenome;
- Endereço de e-mail;
- Senha (hash de autenticação);
- Dados de perfil (plano, nível, pontos);
- Saldo de cashback e milhas;
- Gastos por categoria;
- Notificações recebidas;
- Link e histórico de indicações;
- Cupons vinculados à conta.

### 5.2. Dados retidos temporariamente (obrigação legal)

Conforme permitido pelo **art. 16, I e II, da LGPD**, alguns dados poderão ser mantidos de forma **anonimizada ou pseudonimizada** por prazo determinado:

| Dado retido | Prazo de retenção | Motivo legal |
|-------------|-------------------|-------------|
| Registros de transações financeiras (saques realizados) | **5 anos** após a exclusão | Obrigação fiscal e contábil (Código Tributário Nacional, art. 173) |
| Protocolos de saque e comprovantes | **5 anos** após a exclusão | Documentação fiscal e defesa em eventuais litígios |
| Registros de acesso à aplicação (logs de IP) | **6 meses** após a exclusão | Marco Civil da Internet (Lei nº 12.965/2014, art. 15) |

Esses registros retidos **não conterão seu nome ou e-mail** — serão associados apenas a um identificador interno anonimizado.

### 5.3. Dados em cache e backups

- **IndexedDB / Cache local (seu dispositivo):** O +Promo não controla o cache armazenado no seu navegador. Recomendamos que limpe os dados do site manualmente nas configurações do navegador após a exclusão;
- **Backups automatizados (Firebase):** O Google Firebase mantém backups de segurança por período limitado. Dados excluídos deixam de constar nos backups dentro de **30 dias** após a exclusão no sistema ativo.

---

## 6. Contas inativas

Se sua conta ficar **inativa por mais de 12 meses** (sem nenhum login):

1. Enviaremos um **e-mail de aviso** para o endereço cadastrado, informando que a conta será encerrada em 30 dias;
2. Se não houver resposta ou atividade dentro dos 30 dias:
   - A conta será **desativada**;
   - O saldo de cashback não resgatado será **expirado**;
   - Os dados pessoais serão tratados como se uma exclusão tivesse sido solicitada (seção 5).

---

## 7. Saldo de cashback em caso de cancelamento ou exclusão

Este é um ponto importante. Veja o resumo:

| Situação | O que acontece com o saldo |
|----------|---------------------------|
| Cancelou apenas a assinatura | Saldo **fica disponível para saque por 90 dias**. Após isso, expira. |
| Solicitou exclusão da conta (com saldo pendente) | Saldo é **perdido imediatamente**. Não há reembolso. |
| Solicitou exclusão da conta (após resgatar tudo) | Exclusão normal, sem perdas. |
| Conta banida por fraude | Saldo é **cancelado integralmente**, sem direito a resgate. |
| Conta inativa (12+ meses) | Saldo expira conforme seção 6. |

> **Recomendação:** Sempre resgate seu saldo disponível **antes** de solicitar a exclusão da conta.

---

## 8. Portabilidade de dados (antes da exclusão)

Antes de excluir sua conta, você tem o direito de solicitar uma **cópia completa** de todos os seus dados em formato legível por máquina (**JSON** ou **CSV**), conforme garantido pelo art. 18, V, da LGPD.

### Como solicitar

1. Envie um e-mail para **sacmaispromo@gmail.com**;
2. Use o assunto: **"Portabilidade de dados — [seu e-mail de cadastro]"**;
3. Prazo de entrega: até **15 dias corridos**.

Você receberá um arquivo contendo:
- Todos os dados de perfil;
- Histórico completo de saldos, gastos, saques e protocolos;
- Histórico de notificações;
- Dados de indicações.

---

## 9. Arrependimento após solicitar a exclusão

- **Dentro do prazo de processamento (15 dias):** Se você mudar de ideia antes da conclusão do processo, entre em contato imediatamente pelo e-mail sacmaispromo@gmail.com solicitando o cancelamento da exclusão. Faremos o possível para reverter, mas não podemos garantir reversão se o processo já estiver em estágio final;
- **Após a conclusão:** A exclusão é **irreversível**. Será necessário criar uma conta nova, sem vinculação ao histórico anterior.

---

## 10. Contato

Para qualquer solicitação relativa a cancelamento, exclusão de conta ou portabilidade de dados:

- **E-mail:** sacmaispromo@gmail.com  
- **Assunto sugerido:** "Cancelamento / Exclusão — [seu e-mail]"
- **Prazo de resposta:** até **2 dias úteis** para confirmação de recebimento; até **15 dias corridos** para conclusão.

---

*Esta Política de Cancelamento e Exclusão de Conta é parte integrante dos Termos de Uso e da Política de Privacidade do +Promo.*
