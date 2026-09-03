# Evento Errejota — SaaS de Lotação & Reservas

Plataforma para centralizar divulgação de eventos, relacionamento, reservas de mesas, conversas de WhatsApp/Instagram e automação com agente de IA.

## O que esta versão entrega

- Dashboard de capacidade, ocupação projetada e oportunidades
- Agenda de eventos
- CRM de contatos por canal, interesse e consentimento
- Campanhas de WhatsApp e Instagram
- Inbox unificada
- Agente de IA com contexto de eventos e reservas
- Handoff automático para atendimento humano
- Funil de reserva de mesas
- Lista VIP e confirmações
- Métricas de campanha e conversão
- Guardrails de opt-out, consentimento e frequência
- Endpoint de campanha com `dry-run` habilitado por padrão
- Supabase Auth para cadastro/login
- Banco Supabase multiempresa com RLS
- Webhook Meta executado em Supabase Edge Functions
- Idempotência de webhooks e mensagens para evitar respostas duplicadas

## Supabase — conectado

O módulo Evento Errejota está conectado ao projeto Supabase `iqrnytsgwaiegddfxfjs` usando apenas credenciais públicas no frontend.

URL pública:

`https://iqrnytsgwaiegddfxfjs.supabase.co`

Variáveis públicas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Nunca coloque `service_role`, senha do Postgres, token da Meta, App Secret ou chave OpenAI em variáveis `NEXT_PUBLIC_*`.

### Isolamento do módulo

Todo o módulo usa prefixo `erj_` e RLS por tenant para não misturar dados com outros sistemas no mesmo Supabase.

Tabelas principais:

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
- `erj_ai_agents`
- `erj_webhook_events`
- `erj_audit_logs`

### Primeiro acesso

1. Abra o SaaS.
2. Crie o usuário administrador.
3. Confirme o e-mail se o Supabase Auth solicitar.
4. Entre no sistema.
5. `erj_bootstrap_tenant` cria o workspace `Errejota`, vincula o usuário como `owner` e cria as integrações `whatsapp`, `instagram` e `openai` como pendentes.
6. O agente padrão também é criado para o tenant.

A função de bootstrap não pode ser executada pelo papel `anon`.

## Webhook Meta — ativo no Supabase

Edge Function:

`errejota-meta-webhook`

Callback URL para cadastrar no Meta Developers:

`https://iqrnytsgwaiegddfxfjs.supabase.co/functions/v1/errejota-meta-webhook`

A função aceita `GET` para verificação do webhook e `POST` para eventos. O `POST` só é aceito quando a assinatura `X-Hub-Signature-256` é válida usando o `META_APP_SECRET`.

### Segredos obrigatórios no Supabase Edge Functions

Configure como secrets do projeto, nunca no GitHub:

- `META_WEBHOOK_VERIFY_TOKEN`
- `META_APP_SECRET`
- `WHATSAPP_ACCESS_TOKEN`
- `INSTAGRAM_ACCESS_TOKEN`
- `OPENAI_API_KEY`

O Supabase já fornece automaticamente à função:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Variáveis opcionais/configuráveis:

- `WHATSAPP_GRAPH_VERSION=v26.0`
- `INSTAGRAM_GRAPH_VERSION=v26.0`
- `INSTAGRAM_GRAPH_HOST=https://graph.instagram.com`
- `OPENAI_MODEL=gpt-5.6-luna`

## Fluxo automático WhatsApp / Instagram

Quando chega uma mensagem oficial da Meta:

1. A função valida a assinatura do webhook.
2. Identifica a conta Meta e o tenant Errejota.
3. Registra o evento em `erj_webhook_events`.
4. Cria ou atualiza o contato em `erj_contacts`.
5. Abre ou reutiliza a conversa em `erj_conversations`.
6. Salva a mensagem em `erj_messages`.
7. Verifica opt-out, handoff humano e configuração do agente.
8. Carrega contexto de eventos e reservas desse contato.
9. Chama a OpenAI Responses API com `store: false`.
10. Responde pelo mesmo canal oficial.
11. Salva a resposta da IA no histórico.
12. Em falhas ou pedido de atendimento humano, cria tarefa em `erj_tasks`.

Mensagens duplicadas da Meta não geram respostas duplicadas porque `provider_message_id` e `external_event_id` possuem proteção de idempotência.

## Agente IA

Configuração por tenant em `erj_ai_agents`:

- ativar/desativar
- modelo
- instruções
- palavras de handoff
- limite de histórico

Modelo padrão: `gpt-5.6-luna`.

Regras iniciais:

- Português do Brasil
- Mensagens curtas
- No máximo uma pergunta por resposta
- Não inventar preço, disponibilidade, endereço, condições ou políticas
- Usar somente dados existentes no sistema
- Encaminhar para humano quando necessário
- Não confirmar reserva sem registro real
- Respeitar opt-out

## WhatsApp Business Platform

Variáveis para o frontend/backend tradicional, quando aplicável:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_GRAPH_VERSION`

Campanhas iniciadas pelo estabelecimento devem usar templates aprovados e contatos elegíveis.

## Instagram profissional

Variáveis:

- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_ACCOUNT_ID`
- `INSTAGRAM_GRAPH_VERSION`
- `INSTAGRAM_GRAPH_HOST`

A integração usa somente a API oficial e IDs disponibilizados pela Meta. Não existe scraping de seguidores nem DM em massa para perfis aleatórios.

## API de campanhas

`POST /api/campaigns/dispatch`

Por padrão a rota roda como `dry-run`. Para envio real, use `dryRun: false` e configure as credenciais oficiais.

O lote é limitado a 50 contatos por chamada; volumes maiores devem passar por fila com controle de velocidade e retentativas.

## Health check

`GET /api/health`

Retorna o estado de configuração do Supabase, WhatsApp, Instagram, IA e worker server-side.

O próprio webhook também responde a `GET` sem parâmetros com um diagnóstico que informa apenas se cada segredo está presente, sem revelar valores.

## Rodar localmente

```bash
cp .env.example .env.local
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Ativação final no Meta Developers

1. Criar/selecionar o Meta App oficial do Errejota.
2. Configurar `META_WEBHOOK_VERIFY_TOKEN` e `META_APP_SECRET` nos secrets do Supabase.
3. Configurar `WHATSAPP_ACCESS_TOKEN`, `INSTAGRAM_ACCESS_TOKEN` e `OPENAI_API_KEY`.
4. Cadastrar a Callback URL da Edge Function no Meta Developers.
5. Assinar os eventos de mensagens do WhatsApp e Instagram.
6. Fazer o primeiro login no SaaS para criar o tenant.
7. Enviar uma mensagem real de teste para o WhatsApp/Instagram do Errejota.
8. O primeiro webhook válido vincula automaticamente a conta Meta ao único conector pendente daquele canal.
9. Conferir `erj_integrations`, `erj_webhook_events`, `erj_contacts`, `erj_conversations` e `erj_messages`.

## Princípio de operação

Automatizar produtividade, não spam. Todo contato mantém origem, consentimento e descadastro. O motor de campanha aplica supressão e limites antes de envios iniciados pelo estabelecimento.
