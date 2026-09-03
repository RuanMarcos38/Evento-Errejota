# Evento Errejota — SaaS de Lotação & Reservas

Plataforma para centralizar divulgação de eventos, relacionamento, reservas de mesas e acompanhamento de lotação.

## O que esta versão entrega

- Dashboard de capacidade, ocupação projetada e oportunidades
- Agenda de eventos
- CRM de contatos por canal, interesse e consentimento
- Campanhas de WhatsApp e Instagram
- Inbox unificada
- Agente de IA para triagem, sugestão de resposta, resumo e priorização
- Funil de reserva de mesas
- Lista VIP e confirmações
- Métricas de campanha e conversão
- Guardrails de opt-out, consentimento e frequência
- Endpoint seguro de campanha com `dry-run` habilitado por padrão
- Supabase Auth para cadastro/login
- Banco Supabase multiempresa com RLS

## Supabase — conectado

O módulo Evento Errejota está conectado ao projeto Supabase `iqrnytsgwaiegddfxfjs` usando apenas credenciais públicas no frontend.

URL pública:

`https://iqrnytsgwaiegddfxfjs.supabase.co`

Variáveis:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Nunca coloque `service_role`, senha do Postgres ou outros segredos em variáveis `NEXT_PUBLIC_*`.

### Isolamento do módulo

Para não alterar nem misturar dados de outros sistemas existentes no mesmo projeto Supabase, todo o módulo usa prefixo `erj_` e RLS por tenant.

Tabelas:

- `erj_tenants`
- `erj_members`
- `erj_events`
- `erj_contacts`
- `erj_campaigns`
- `erj_campaign_recipients`
- `erj_reservations`
- `erj_conversations`
- `erj_messages`
- `erj_tasks`
- `erj_integrations`
- `erj_audit_logs`

### Primeiro acesso

1. Abra o SaaS.
2. Use a tela de cadastro para criar o usuário administrador.
3. Confirme o e-mail se o Supabase Auth solicitar.
4. Entre no sistema.
5. A função `erj_bootstrap_tenant` cria automaticamente o workspace `Errejota` e vincula o primeiro usuário como `owner`.
6. As políticas RLS passam a liberar somente os dados desse tenant.

A função de bootstrap não pode ser executada pelo papel `anon`; somente usuários autenticados podem chamá-la.

## Estratégia operacional

A ferramenta foi desenhada para substituir tarefas repetitivas de uma equipe grande sem transformar a operação em spam.

1. Criar o evento e definir capacidade.
2. Importar contatos com origem e consentimento.
3. Segmentar público: VIP, clientes recorrentes, interessados, reservas incompletas etc.
4. Criar campanhas por etapa do funil.
5. Enviar somente por canais oficiais e para contatos elegíveis.
6. IA classifica respostas: interessado, reservar mesa, dúvida, não interessado, opt-out.
7. Interessados entram no funil de reserva.
8. Follow-ups são priorizados pelo contexto, não por disparo indiscriminado.
9. Painel acompanha ocupação, receita potencial e capacidade restante.

## WhatsApp Business Platform

Variáveis:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_GRAPH_VERSION`

Campanhas iniciadas pelo estabelecimento devem usar templates aprovados e contatos com consentimento compatível.

## Instagram Messaging API

Variáveis:

- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_ACCOUNT_ID`
- `INSTAGRAM_GRAPH_VERSION`

A integração usa IDs de usuários/conversas disponibilizados pela API oficial. Não existe scraping de seguidores nem automação de DMs em massa para perfis aleatórios.

## IA

Variável opcional:

- `OPENAI_API_KEY`

Uso: classificar intenção, sugerir respostas, resumir conversas e priorizar leads.

## API de campanhas

`POST /api/campaigns/dispatch`

Por padrão a rota roda como `dry-run` e apenas retorna quem seria elegível ou bloqueado. Para envio real, use `dryRun: false` e configure as credenciais oficiais.

O lote é limitado a 50 contatos por chamada; volumes maiores devem passar por uma fila/worker com controle de velocidade e retentativas.

## Health check

`GET /api/health`

Retorna o estado de configuração do Supabase, WhatsApp, Instagram, IA e banco server-side/worker.

## Rodar localmente

```bash
cp .env.example .env.local
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Próximas etapas de produção

1. Criar o primeiro usuário administrador pelo próprio SaaS.
2. Cadastrar o primeiro evento real.
3. Importar contatos com origem e consentimento.
4. Criar Meta App e conectar WhatsApp Business + Instagram profissional.
5. Cadastrar webhooks dos dois canais.
6. Aprovar templates de marketing do WhatsApp.
7. Adicionar fila de jobs para campanhas e follow-up em maior volume.
8. Configurar domínio e deploy de produção.

## Princípio de operação

Automatizar produtividade, não spam. Todo contato deve manter status de consentimento, origem e descadastro. O motor de campanha aplica supressão e limite de frequência antes do envio.
