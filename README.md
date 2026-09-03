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

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Próximas etapas de produção

1. Conectar Supabase/Postgres multiempresa com RLS.
2. Criar autenticação, usuários e permissões.
3. Criar Meta App e conectar WhatsApp Business + Instagram profissional.
4. Cadastrar webhooks dos dois canais.
5. Aprovar templates de marketing do WhatsApp.
6. Persistir campanhas, contatos, conversas, reservas e auditoria.
7. Adicionar fila de jobs para campanhas e follow-up.
8. Configurar domínio e deploy.

## Princípio de operação

Automatizar produtividade, não spam. Todo contato deve manter status de consentimento, origem e descadastro. O motor de campanha aplica supressão e limite de frequência antes do envio.
