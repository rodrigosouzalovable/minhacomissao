## Objetivo

Fazer os números que já estão dentro do grupo **Família Souza e Ribeiro** começarem a conversar entre si de forma natural — texto, áudio e imagem — durante o dia, simulando uma família real. Cada novo número adicionado ao grupo entra automaticamente na fila de conversa após 24h de carência.

## Como vai funcionar

### Volume e janela
- **15 a 25 mensagens/dia** no grupo (somando todos os membros).
- Janela: **07h–21h BRT**, **nunca aos domingos** (regra global do projeto).
- Cadência irregular: rajadas curtas (2–4 msgs em 1–3 min, simulando uma conversa) intercaladas com silêncios de 20–90 min — não distribui linearmente.

### Mix de mídia (sorteio por mensagem)
- **70% texto**
- **20% áudio** (TTS via Edge TTS Microsoft pt-BR — provedor gratuito que já usamos no projeto)
- **10% imagem** (pool de imagens "família" upload pelo admin, igual ao pool de status)

### Pool curado de diálogos (sem IA externa, custo zero)
Vou popular um novo pool com **200+ mensagens** organizadas em **cenas/contextos** ("bom_dia", "almoço", "fofoca_novela", "futebol", "receita", "neto/criança", "religião_domingo_véspera", "boa_noite", "figurinha_reação", "áudio_curto_resposta", etc.). Cada cena tem:
- Mensagem inicial (ex: "Bom dia família, Deus abençoe 🙏")
- 2–5 respostas plausíveis ("Bom dia minha filha!", "Amém amém", "Bom dia, durmiu bem?")
- Tipo: texto / áudio / imagem
- Quem fala: aleatório entre membros elegíveis

O motor sorteia uma cena por "rajada", escolhe 2–4 membros diferentes do grupo para encenar, e dispara as mensagens em sequência com delays de 15–80s entre cada.

### Quem participa
- Todos os membros do grupo com `status='ok'` em `whatsapp_aquecimento_grupo_membros` + `user_whatsapp_instances.ativo=true` + conectados na UAZAPI.
- **Carência de 24h**: novo membro só entra na rotação 24h após `adicionado_em`.
- Round-robin com peso anti-repetição: quem falou por último tem menos chance de ser sorteado de novo na próxima rajada (evita 1 número monopolizando).

### Limites anti-ban por instância
- Máximo **6 mensagens/dia por número** dentro do grupo (independente de outros aquecimentos que ele já faça).
- Máximo **2 áudios/dia por número** e **1 imagem/dia por número**.
- Nunca o mesmo número manda 2 mensagens seguidas.

### Novos membros entrando no grupo
Hoje `add-to-warming-group` já marca `status='ok'` quando confirma que o número entrou. Vou usar essa mesma marcação como gatilho: a função de conversa só considera membros com `adicionado_em <= now() - 24h`, então a "fila de conversa" é automática — sem tabela extra.

### Tratamento de erros
- Se UAZAPI retornar `disconnected` → loga, pula a mensagem, segue (HTTP 200 + `fallback:true`, regra do projeto).
- Se um número der erro 3x seguidas no grupo, fica em cooldown 6h.

## O que vou criar/mexer

### 1. Migration (schema)
- Nova tabela `whatsapp_aquecimento_grupo_dialogos_pool`: `id, contexto, ordem_na_cena, tipo (texto/audio/imagem), conteudo, peso, ativo`. Para imagens, `conteudo` aponta para storage path ou usa pool já existente de status.
- Nova tabela `whatsapp_aquecimento_grupo_conversas_log`: `id, grupo_id, instancia_id, contexto, tipo, conteudo_preview, enviado_em, sucesso, erro`. Para auditoria + UI.
- Nova tabela `whatsapp_aquecimento_grupo_config`: `grupo_id, msgs_min_dia, msgs_max_dia, ativo, mix_texto, mix_audio, mix_imagem, carencia_horas`. Default 15/25/70/20/10/24.
- Índices: `(grupo_id, enviado_em)` no log; `(contexto, ativo)` no pool.
- RLS: admins gerenciam, autenticados leem.

### 2. Seed do pool (insert tool)
- 200+ linhas em `whatsapp_aquecimento_grupo_dialogos_pool` cobrindo ~25 cenas de família típica brasileira (bom dia, café, almoço, neto, igreja, novela, futebol, receita, saudade, foto de comida, áudio de risada, áudio "tô indo aí", boa noite, etc.).

### 3. Edge function nova: `aquecimento-grupo-conversa`
Roda via cron a cada **15 min**. A cada execução:
1. Confere janela horária + domingo.
2. Para cada grupo ativo com `ativo=true`:
   - Conta msgs já enviadas hoje no grupo via `whatsapp_aquecimento_grupo_conversas_log` → se já bateu o teto, pula.
   - Decide se vai disparar agora (probabilidade ponderada para fechar o range 15-25 ao longo do dia).
   - Se sim: sorteia 1 cena, sorteia membros elegíveis (filtra carência 24h, limites diários, último-falante), envia a sequência via `setTimeout` com delays randomizados (15–80s).
3. Para cada envio, chama UAZAPI:
   - **Texto**: `POST /send/text` com `number = group_jid`.
   - **Áudio**: gera TTS via Edge TTS (já temos integração), faz `POST /send/audio`.
   - **Imagem**: pega URL pública do pool de imagens, `POST /send/media`.
4. Loga tudo em `whatsapp_aquecimento_grupo_conversas_log`.

### 4. Cron job (insert tool, não migration — contém URL/anon key)
```sql
select cron.schedule(
  'aquecimento-grupo-conversa-15min',
  '*/15 * * * *',
  $$ select net.http_post(url:='.../functions/v1/aquecimento-grupo-conversa', ...) $$
);
```

### 5. UI: nova aba "Conversa no Grupo" dentro de `GrupoAquecimentoCard.tsx`
- Toggle **Ativo/Pausado**.
- Sliders: msgs/dia min e max, mix de mídia, carência (horas).
- Mini-painel com **stats do dia**: msgs enviadas, por tipo, por membro.
- Botão **"Disparar rajada agora"** (admin) para testar.
- Tabela com últimas 30 mensagens enviadas no grupo (do log).

### 6. Memória do projeto
Adicionar em `mem://features/whatsapp/warming/grupo-conversa-intra-grupo` documentando: 15-25 msgs/dia, 70/20/10, carência 24h, pool curado, cron 15 min.

## O que NÃO vou mexer
- `add-to-warming-group` continua igual (responsável só por adicionar e promover admin).
- Webhooks de grupo permanecem desativados (regra "never load group messages" — só envio, sem ler respostas).
- Não vou usar IA externa (custo zero, conforme escolhido).

## Riscos / observações
- Como webhooks de grupo estão desativados, não conseguimos detectar se a mensagem foi entregue/lida — fica só o status HTTP da UAZAPI.
- O pool de imagens precisa ser populado pelo admin (vou reaproveitar o bucket `aquecimento-status-images`). Sem imagens cadastradas, o motor cai pra texto/áudio automaticamente.
- TTS gera arquivos pequenos a cada áudio, mas é grátis (Edge TTS) — sem aumento perceptível de custo Lovable Cloud.

## Confirmações antes de codar
1. OK reaproveitar o bucket `aquecimento-status-images` para as imagens da conversa do grupo, ou prefere bucket separado?
2. OK começar com **1 grupo só** (Família Souza e Ribeiro) e depois generalizar, ou já deixo a config por-grupo desde o início (resposta default = por-grupo)?
