# Política de Privacidade — +Promo

**Última atualização:** 14 de abril de 2026  
**Versão:** 1.0

---

## 1. Introdução

A sua privacidade é coisa séria para o +Promo. Esta Política de Privacidade explica, de forma clara e direta, **quais dados pessoais coletamos, por que coletamos, como os protegemos e quais são os seus direitos** sobre eles.

Esta política foi elaborada em conformidade com a **Lei Geral de Proteção de Dados Pessoais** (Lei nº 13.709/2018 — LGPD), o **Marco Civil da Internet** (Lei nº 12.965/2014) e boas práticas internacionais de proteção de dados.

Ao utilizar a plataforma +Promo, você declara ter lido e compreendido esta Política.

---

## 2. Quem é o responsável pelos seus dados?

O **controlador** dos seus dados pessoais é:

**MaisPromo Tecnologia Ltda.**  
CNPJ: [INSERIR CNPJ]  
Endereço: [INSERIR ENDEREÇO]  
E-mail do Encarregado (DPO): **sacmaispromo@gmail.com**

Nos termos do art. 41 da LGPD, o encarregado pelo tratamento de dados pessoais pode ser contatado pelo e-mail acima para qualquer solicitação relativa a dados pessoais.

---

## 3. Quais dados coletamos?

Coletamos apenas os dados **estritamente necessários** para o funcionamento da plataforma. Seguimos o princípio da **minimização**: não pedimos o que não precisamos.

### 3.1. Dados fornecidos diretamente por você

| Dado | Para que usamos | Base legal (LGPD) |
|------|-----------------|---------------------|
| **Nome e sobrenome** | Identificação no painel, personalização e comprovantes de resgate | Execução de contrato (art. 7º, V) |
| **Endereço de e-mail** | Login, recuperação de senha, comunicações essenciais | Execução de contrato (art. 7º, V) |
| **Senha** | Autenticação segura na plataforma | Execução de contrato (art. 7º, V) |
| **Plano escolhido** | Definir percentuais de cashback e benefícios | Execução de contrato (art. 7º, V) |

### 3.2. Dados gerados pelo uso da plataforma

| Dado | Para que usamos | Base legal (LGPD) |
|------|-----------------|---------------------|
| **Gastos por categoria** (supermercado, farmácia, restaurante, combustível) | Calcular o cashback e gerar relatórios no painel | Execução de contrato (art. 7º, V) |
| **Saldo de cashback e milhas** | Exibir saldo disponível e processar saques | Execução de contrato (art. 7º, V) |
| **Pontos e nível de fidelidade** | Sistema de gamificação e benefícios progressivos | Execução de contrato (art. 7º, V) |
| **Histórico de transações de resgate** | Comprovantes, protocolo de saque e auditoria | Execução de contrato + Obrigação legal (art. 7º, II) |
| **Notificações recebidas** | Histórico de comunicações da plataforma para o usuário | Legítimo interesse (art. 7º, IX) |
| **Dados de indicação** | Rastrear indicações válidas e creditar bônus | Execução de contrato (art. 7º, V) |

### 3.3. Dados que **NÃO** coletamos

Queremos ser transparentes sobre o que **não** fazemos:

- ❌ **Não coletamos CPF, RG ou documentos de identidade;**
- ❌ **Não coletamos dados bancários** (chaves Pix são informadas apenas no momento do saque e não ficam armazenadas permanentemente);
- ❌ **Não coletamos dados de localização (GPS);**
- ❌ **Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins de marketing.**

---

## 4. Cookies e armazenamento local

### 4.1. O que usamos

| Tecnologia | Finalidade | Duração |
|------------|-----------|---------|
| **localStorage** | Salvar preferência de tema (claro/escuro) | Permanente até exclusão manual |
| **IndexedDB (Firebase)** | Cache offline dos seus dados do painel para acesso sem internet | Sessão da aplicação |
| **Service Worker** | Funcionamento offline da PWA e carregamento rápido | Cache versionado |

### 4.2. O que **não** usamos

- ❌ Não utilizamos cookies de rastreamento publicitário;
- ❌ Não usamos pixels de rastreamento de terceiros;
- ❌ Não fazemos *fingerprinting* do dispositivo.

---

## 5. Onde seus dados ficam armazenados?

Seus dados são armazenados nos servidores do **Google Firebase** — especificamente:

| Serviço | Função | Localização dos servidores |
|---------|--------|---------------------------|
| **Firebase Authentication** | Gerencia login e autenticação | Servidores Google (EUA) |
| **Cloud Firestore** | Banco de dados que armazena seu perfil, saldos e notificações | Servidores Google (EUA) |

### 5.1. Transferência internacional de dados

Conforme exigido pelo art. 33 da LGPD, informamos que seus dados são processados em servidores do Google localizados nos **Estados Unidos**. Essa transferência é amparada por:

- As **cláusulas contratuais padrão** do Google, que garantem nível adequado de proteção;
- O compromisso do Google com padrões internacionais de segurança (certificações ISO 27001, SOC 2, SOC 3);
- Os termos do **Data Processing Addendum (DPA)** do Google Cloud, disponível publicamente.

---

## 6. Como protegemos seus dados?

Levamos a segurança dos seus dados muito a sério. As proteções implementadas incluem:

### 6.1. Proteções de infraestrutura (Firebase/Google)
- **Criptografia em trânsito:** Toda comunicação entre seu navegador e nossos servidores utiliza **TLS (HTTPS)**;
- **Criptografia em repouso:** Todos os dados armazenados no Firestore são **criptografados automaticamente** pelo Google antes de serem gravados em disco;
- **Autenticação segura:** Utilizamos o Firebase Authentication, que implementa padrões como **bcrypt/scrypt** para hash de senhas — nós **nunca** temos acesso à sua senha em texto puro;

### 6.2. Proteções implementadas pelo +Promo
- **Regras de segurança (Firestore Rules):** Cada usuário só pode acessar seus próprios dados. Um usuário com UID "ABC" **não pode, em nenhuma circunstância**, ler ou alterar dados de outro usuário;
- **Proteção contra adulteração de saldo:** As regras do banco impedem que campos financeiros (cashback, milhas, pontos) sejam modificados diretamente pelo navegador do usuário. Somente processos internos do servidor podem alterar esses valores;
- **Proteção contra XSS (Cross-Site Scripting):** Todo dado exibido no painel é **sanitizado** antes de ser renderizado, impedindo que código malicioso seja executado;
- **Headers de segurança:** Implementamos cabeçalhos HTTP de proteção conforme melhores práticas (via Cloudflare);

### 6.3. Práticas de acesso interno
- O acesso ao painel administrativo do Firebase é restrito aos operadores autorizados do +Promo;
- Utilizamos autenticação de dois fatores (2FA) para acesso ao console de administração;
- Não armazenamos logs contendo dados pessoais identificáveis em texto aberto.

---

## 7. Por quanto tempo guardamos seus dados?

| Tipo de dado | Período de retenção | Justificativa |
|-------------|---------------------|---------------|
| Dados de perfil (nome, e-mail, plano) | Enquanto a conta estiver ativa | Necessário para a prestação do serviço |
| Saldos e histórico financeiro | Enquanto a conta estiver ativa + **5 anos após exclusão** | Obrigações fiscais e contábeis (art. 7º, II, LGPD c/c Código Tributário) |
| Notificações | Enquanto a conta estiver ativa | Registro de comunicações |
| Dados de autenticação (Firebase Auth) | Enquanto a conta estiver ativa | Segurança de acesso |

Após a exclusão da conta, os dados são tratados conforme nossa Política de Cancelamento e Exclusão de Conta.

---

## 8. Seus direitos (LGPD, art. 18)

Você tem os seguintes direitos garantidos por lei sobre os seus dados pessoais:

| Direito | O que significa | Como exercer |
|---------|----------------|--------------|
| **Confirmação e acesso** | Saber se tratamos seus dados e acessar todos eles | E-mail ao DPO |
| **Correção** | Corrigir dados incompletos ou desatualizados | Diretamente no painel ou por e-mail |
| **Anonimização ou eliminação** | Solicitar que dados desnecessários sejam anonimizados ou excluídos | E-mail ao DPO |
| **Portabilidade** | Receber seus dados em formato legível por máquina (JSON/CSV) | E-mail ao DPO |
| **Informação sobre compartilhamento** | Saber com quem compartilhamos seus dados | Descrito nesta política (seção 9) |
| **Revogação do consentimento** | Retirar qualquer consentimento dado | E-mail ao DPO |
| **Eliminação de conta** | Excluir sua conta e todos os dados associados | Procedimento descrito na Política de Cancelamento |

**Prazo de resposta:** Responderemos qualquer solicitação em **até 15 dias corridos**, conforme art. 18, §5º da LGPD.

Para exercer qualquer direito, envie um e-mail para **sacmaispromo@gmail.com** com o assunto "Direitos LGPD — [seu e-mail de cadastro]".

---

## 9. Com quem compartilhamos seus dados?

### 9.1. Prestadores de serviço essenciais

| Parceiro | Dados compartilhados | Finalidade |
|----------|---------------------|-----------|
| **Google (Firebase)** | Todos os dados armazenados na plataforma | Infraestrutura de autenticação e banco de dados |
| **Cloudflare** | Endereço IP (transitório, não armazenado por nós) | CDN, proteção contra DDoS e entrega da aplicação |
| **Google Fonts** | Endereço IP (automaticamente, ao carregar fontes) | Carregamento de tipografia |

### 9.2. O que NÃO fazemos com seus dados

- ❌ **Não vendemos seus dados** para ninguém, em nenhum cenário;
- ❌ **Não compartilhamos com anunciantes** ou redes de publicidade;
- ❌ **Não usamos seus dados para criar perfis de consumo** para terceiros;
- ❌ **Não fornecemos dados a parceiros comerciais** sem o seu consentimento expresso.

### 9.3. Exceções legais

Poderemos compartilhar seus dados, sem o seu consentimento, apenas quando exigido por:

- Ordem judicial ou decisão de autoridade competente;
- Solicitação da Autoridade Nacional de Proteção de Dados (ANPD);
- Obrigação legal ou regulatória.

---

## 10. Dados de menores

O +Promo é destinado a pessoas com **18 anos ou mais**. Não coletamos intencionalmente dados de menores de idade. Se tomarmos conhecimento de que um menor criou conta sem autorização dos responsáveis, excluiremos a conta e os dados imediatamente.

---

## 11. Incidentes de segurança

Na hipótese de um incidente de segurança que possa causar risco ou dano relevante aos nossos usuários, nós:

1. **Comunicaremos a ANPD** em prazo razoável, conforme art. 48 da LGPD;
2. **Notificaremos os usuários afetados** por e-mail, descrevendo a natureza do incidente, os dados potencialmente comprometidos e as medidas adotadas;
3. **Registraremos internamente** todo o incidente, as providências tomadas e as medidas preventivas implementadas.

---

## 12. Alterações nesta Política

Podemos atualizar esta Política periodicamente. Quando isso acontecer:

- A data de "Última atualização" no início do documento será alterada;
- Se a mudança for significativa, enviaremos uma notificação ao seu e-mail ou pelo painel;
- O uso continuado da plataforma após a publicação implica ciência das alterações.

Recomendamos que você consulte esta página periodicamente.

---

## 13. Contato

Para qualquer dúvida, solicitação ou reclamação sobre seus dados pessoais ou sobre esta Política de Privacidade:

- **E-mail do Encarregado (DPO):** sacmaispromo@gmail.com
- **Assunto sugerido:** "Privacidade — [descreva brevemente]"
- **Prazo de resposta:** até 15 dias corridos

Se entender que sua reclamação não foi adequadamente atendida, você tem o direito de apresentar reclamação perante a **Autoridade Nacional de Proteção de Dados (ANPD)**, nos termos do art. 18, §1º da LGPD.

---

*Esta Política de Privacidade é parte integrante dos Termos de Uso do +Promo.*
