## Objetivo

1. Corrigir o envio de áudio na aba **Inbox Meta Oficial** (texto funciona, áudio falha silenciosamente).
2. Exibir no cabeçalho da conversa um aviso visível quando a **instância** que atende aquele cliente estiver **restringida, com qualidade baixa ou banida** pela Meta.

---

## 1. Diagnóstico do envio de áudio

Fluxo atual (`useMetaAudioRecorder.tsx` → `send-whatsapp-meta-media/index.ts`):

- O navegador grava com `MediaRecorder`, tentando `audio/ogg;codecs=opus` e caindo para `audio/webm;codecs=opus`.
- O arquivo é salvo no bucket `inbox-media` como `.ogg` ou `.webm`.
- A edge function envia para a Meta usando `type: "audio"` com `{ link: media_url }`.

Problemas:

- A Meta Cloud API **só aceita** áudio nos containers `audio/aac`, `audio/mp4`, `audio/mpeg`, `audio/amr` ou `audio/ogg` (com OPUS). **Não aceita `audio/webm`** — que é o formato padrão do Chrome desktop atualmente, já que o suporte a `ogg;codecs=opus` no `MediaRecorder` do Chrome é instável.
- Quando a Meta rejeita, a edge function hoje retorna `success:false` com `status:200` e o toast some rápido; por isso "não envia" sem erro claro no chat.
- Além disso, iOS/Safari grava em `audio/mp4` e cai fora do branch tratado.

## 2. Correções — envio de áudio

**a) Edge function `send-whatsapp-meta-media`**

- Quando `type === "audio"`, **não usar mais `{ link }`**. Em vez disso:
  1. Baixar o arquivo do `media_url` (fetch do Storage público).
  2. Fazer upload via **Meta Media API resumível**: `POST https://graph.facebook.com/v21.0/{phone_number_id}/media` (multipart, campos `messaging_product=whatsapp`, `type=audio/ogg`, `file=<binário>`).
  3. Usar o `id` retornado no envio: `audio: { id }` em vez de `audio: { link }`.
- Se o container original for `webm`, remontar como `ogg` apenas trocando o content-type no upload multipart não basta (Meta valida container). Nesse caso, retornar erro amigável orientando o operador a usar Chrome/Edge atualizados ou tentar novamente (fallback documentado).
- Logar `data.error.message` da Meta em qualquer falha (`console.log`) para conseguirmos ver nos logs.
- Retornar o `error.message` exato da Meta no `success:false` para o toast do frontend expor a causa (janela 24h, mídia inválida, número inválido, etc.).

**b) Client `useMetaAudioRecorder.tsx`**

- Priorizar `audio/ogg;codecs=opus`; se indisponível, tentar `audio/mp4` (Safari/iOS) antes de cair no `webm`.
- Se acabar em `webm`, exibir toast avisando "Formato do navegador não suportado — grave novamente ou use Chrome/Edge" e **não subir** para o Storage (evita gastar upload).
- Salvar o arquivo no Storage com o content-type correto (`audio/ogg` ou `audio/mp4`) e extensão correspondente.

**c) Toast na UI**

- Ao retornar `success:false`, exibir o `error` bruto da Meta no toast (já temos o `throw` — só precisa de mensagem melhor).

## 3. Indicador de instância restringida/banida na conversa

Já existe a edge function `check-meta-instance-health` que persiste em `meta_whatsapp_instances`:
`saude_status`, `saude_quality`, `saude_tier`, `saude_name_status`, `saude_ban_info`, `saude_checked_at`.

**Frontend (`src/pages/InboxMeta.tsx`)**

- Estender a interface `MetaInstance` e o `select` (linha 140) para incluir os campos `saude_status`, `saude_quality`, `saude_ban_info`, `saude_name_status`, `saude_checked_at`.
- Criar componente pequeno `MetaInstanceHealthBanner` (novo arquivo em `src/components/inbox/meta/MetaInstanceHealthBanner.tsx`) que recebe a instância e decide o que exibir:

```text
Regras de exibição
------------------
- ban_info presente               → banner VERMELHO "Número banido pela Meta"
- status !== "CONNECTED"          → banner VERMELHO "Instância desconectada/restringida ({status})"
- quality_rating === "RED"        → banner AMBAR  "Qualidade baixa — risco de restrição"
- name_status ∈ {FLAGGED, PENDING_REVIEW, REJECTED}
                                  → banner AMBAR "Nome do WhatsApp {name_status}"
- caso contrário                  → não renderiza nada
```

- Inserir o banner **logo abaixo do cabeçalho da conversa** (após a `div` com o nome/telefone do contato, por volta da linha 713 de `InboxMeta.tsx`) e também um pequeno ícone de alerta ao lado do "via {instância}" quando há qualquer problema, com tooltip resumido.
- Trigger de refresh: ao trocar de contato, disparar `supabase.functions.invoke("check-meta-instance-health", { body: { instancia_id }})` em background se `saude_checked_at` for mais antigo que 30 min, para manter o status razoavelmente atual sem custo extra.

## 4. Escopo fora deste plano

- Não alteramos o fluxo de envio de texto, imagens, documentos ou vídeo (funcionam hoje).
- Não mexemos em templates, aba Envio Meta Massa nem na aba API Oficial Meta / Configurar Meta.
- Sem migrations: todas as colunas de saúde já existem em `meta_whatsapp_instances`.
- Sem alterações no webhook Meta.

## Detalhes técnicos

Arquivos tocados:

- `supabase/functions/send-whatsapp-meta-media/index.ts` — troca de `link` por upload/`id` para áudio, melhor logging, mensagem de erro repassada.
- `src/hooks/useMetaAudioRecorder.tsx` — priorização de mimetypes, content-type correto no upload, bloqueio de webm com toast.
- `src/pages/InboxMeta.tsx` — select estendido, uso do novo banner, refresh do health ao abrir conversa.
- `src/components/inbox/meta/MetaInstanceHealthBanner.tsx` — novo componente de aviso.

Regras respeitadas: nenhuma mudança de custo (a `check-meta-instance-health` só é chamada a cada 30 min por instância aberta), sem novas secrets, sem novas tabelas.
