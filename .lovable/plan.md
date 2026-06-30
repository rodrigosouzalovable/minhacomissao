# Trazer todas as funções do WhatsApp Inbox para o Inbox Meta Oficial

Vou recriar o Inbox Meta Oficial com paridade total ao WhatsApp Inbox, reaproveitando o máximo de componentes existentes (`ChatMessage`, `ChatInputBar`, `ConversaContextMenu`, `GerenciarEtiquetasDialog`, `NovaConversaDialog`, `MensagensRapidasDialog`) e adaptando o que a API Meta exige tratamento diferente.

## 1. Banco de dados (1 migration)

Adicionar nas tabelas Meta as colunas que faltam para suportar as mesmas features:

- `meta_whatsapp_contatos`: `fixado boolean default false`, `arquivado boolean default false`, `historico_inicial_importado_em timestamptz`.
- `meta_whatsapp_mensagens`: `lida boolean default false`, `whatsapp_msg_id_reply text` (id da mensagem citada), `conteudo_citado text`, `editada boolean default false`, `apagada_para_mim boolean default false`.
- Novas tabelas espelhando o sistema de etiquetas e mensagens rápidas, escopadas por usuário:
  - `meta_whatsapp_etiquetas` (nome, cor)
  - `meta_whatsapp_contato_etiquetas` (contato_id, etiqueta_id)
  - `meta_whatsapp_mensagens_rapidas` (titulo, tipo texto/audio/botoes, conteudo, audio_url, botoes_texto, botoes_choices)
- RLS + GRANTs (`authenticated` + `service_role`) em todas, escopadas por `user_id` ou pelo dono da instância.

## 2. Edge functions Meta novas/atualizadas

Equivalentes às que o inbox UAZAPI usa, todas respeitando a janela 24h da Meta:

- `send-whatsapp-meta-media` — envia imagem / documento via `messages` API (upload no storage `inbox-media` + URL pública, igual ao UAZAPI).
- `send-whatsapp-meta-audio` — envia áudio (voice) Meta.
- `send-whatsapp-meta-interactive` — envia botões interativos (limite 3 botões, dentro de 24h).
- `meta-whatsapp-webhook` — já recebe inbound; vou estender para gravar `whatsapp_msg_id_reply` (`context.id`) e `conteudo_citado`, e capturar respostas de botão/lista.
- `transcribe-audio` — já existe e é reutilizada para "Áudio transcrito".

Limitações Meta intransponíveis (vou mostrar como toast/aviso na UI, não como funcionalidade quebrada):
- **Editar mensagem**: a API oficial Meta não permite editar mensagens já enviadas. O botão fica oculto para mensagens Meta.
- **Apagar para todos**: a Meta não expõe endpoint de "delete for everyone"; só excluímos localmente ("Apagar para mim").
- **Texto livre / mídia / áudio / botões** só dentro da janela de 24h. Fora dela, a UI mostra o aviso atual e desativa só o envio livre.

## 3. UI: reescrita do `src/pages/InboxMeta.tsx`

Estrutura idêntica ao `WhatsAppInbox.tsx`, com as mesmas seções e componentes:

- **Cabeçalho da sidebar**: busca, filtro por número Meta, filtro por etiqueta, botão "Nova conversa", botão "Mensagens rápidas".
- **Abas Conversas / Arquivados** com badge de quantidade.
- **Lista de contatos**:
  - Ordenação: fixados no topo, depois por `ultima_mensagem_em`.
  - Badge de não lidas, badge de etiquetas coloridas, nome da instância.
  - Auto-arquivamento de números internos (mesmo critério já usado: sufixo das próprias instâncias Meta).
  - **Context menu** (`ConversaContextMenu` reutilizado, com prop `tabela="meta"` para usar as tabelas Meta): marcar não lida, fixar, arquivar/desarquivar, excluir, gerenciar etiquetas.
  - Modo seleção múltipla: arquivar várias, desarquivar várias, excluir várias.
- **Realtime + auto-reconexão + polling 20s + refetch on visibilitychange** — porta direta da lógica do WhatsApp Inbox para as tabelas `meta_whatsapp_contatos` e `meta_whatsapp_mensagens`.
- **Painel da conversa**:
  - Cabeçalho com nome, telefone, instância, badge da janela 24h (mantém o atual).
  - **Histórico paginado** (200 por página) com scroll infinito para carregar mensagens anteriores.
  - **Botão Clock** para buscar histórico mais antigo na Meta (Meta não expõe endpoint de histórico → o botão fica desabilitado com tooltip explicando, mantendo paridade visual).
  - Separadores de data (Hoje/Ontem/data).
  - `ChatMessage` reutilizado, incluindo status_envio (relógio/check/duplo check/lido), respostas citadas, mídia, áudio, botões interativos recebidos.
  - **Responder mensagem** (clicar → preenche `respondendoMsg`, envia com `context.message_id` na Meta).
  - **Apagar para mim** disponível; **Apagar para todos** oculto para mensagens Meta com toast explicando a limitação.
  - **Drag&drop** e **colar imagem** para enviar mídia.
- **Barra de input**: reutilizar `ChatInputBar`, passando handlers Meta (`send-whatsapp-meta-text`, `-media`, `-audio`, `-interactive`). Suporta texto, mídia, áudio (gravação + envio), áudio transcrito, atalhos rápidos, resposta. Toda a barra fica desabilitada fora da janela 24h, mantendo o aviso atual.
- **Diálogo Nova conversa Meta**: nova variante do `NovaConversaDialog` que lista instâncias Meta e envia via template HSM (única forma de iniciar fora de 24h) ou texto livre se já houver janela aberta.
- **Diálogos de Etiquetas e Mensagens rápidas Meta**: variantes apontando para as novas tabelas Meta.

## 4. Sidebar / badge

O badge vermelho já implementado em `AppLayout.tsx` continua válido (lê `meta_whatsapp_contatos.nao_lido`).

## 5. Detalhes técnicos

```text
src/pages/InboxMeta.tsx               (reescrito, ~1500 linhas, espelho do WhatsAppInbox.tsx)
src/components/inbox/                 (reutilizados, com pequenas props para alternar tabela Meta)
  ConversaContextMenu.tsx             → aceitar prop `mode: 'uazapi' | 'meta'`
  GerenciarEtiquetasDialog.tsx        → idem
  MensagensRapidasDialog.tsx          → idem
  NovaConversaDialog.tsx              → idem
supabase/functions/
  send-whatsapp-meta-media/           (nova)
  send-whatsapp-meta-audio/           (nova)
  send-whatsapp-meta-interactive/     (nova)
  meta-whatsapp-webhook/              (estendida: reply context + interactive responses)
1 migration                           (colunas + 3 tabelas + RLS + GRANTs)
```

## O que fica diferente do WhatsApp Inbox por restrição da Meta

- Editar mensagem enviada → botão oculto.
- "Apagar para todos" → só apaga localmente, com toast explicando.
- Botão de buscar histórico antigo na operadora → desabilitado (Meta não expõe).
- Envio livre (texto, mídia, áudio, botões, atalhos) → bloqueado fora da janela 24h, com o aviso atual sugerindo template HSM.

Quer que eu execute exatamente esse plano, ou prefere remover alguma dessas funções (ex.: pular áudio/botões interativos para reduzir custo de edge functions)?
