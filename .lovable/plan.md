# Retomada rápida da espera por cota + destravar a campanha do Thiago

## 1. Fim da espera de 30 minutos

Hoje, quando todas as instâncias batem o teto, a campanha entra em "Aguardando cota" e só reavalia 30 minutos depois (é o "1328s" que você viu).

- A reavaliação passa a ser a cada **5 minutos** (em vez de 30), continuando o pulo para 08:00 BRT do próximo dia útil quando o dia já acabou.
- O painel deixa de mostrar contagem em segundos e passa a mostrar apenas "reavaliando automaticamente a cada 5 min — nada a reativar".
- Assim que qualquer número libera cota (freio recalcula, novo dia, instância adicionada), a campanha volta sozinha em poucos minutos.

Impacto de custo: a verificação passa de 2x/hora para 12x/hora por campanha em espera. É uma consulta leve e só roda enquanto existe campanha parada — aumento pequeno, mas é aumento; se preferir, uso 10 minutos.

## 2. Por que a campanha do Thiago está parada (confirmado no banco)

Campanha **"Odres 15 dias"** — 39 de 190 enviados, 151 pendentes, 0 erros, status `erro`, sem próxima tentativa agendada.

Motivo gravado: `Nenhuma instância disponível — AMARAL 62 8273-8416: teto diário atingido (171/15)`.

O que está por trás:

- A campanha usa **uma única instância**: AMARAL 62 8273-8416 (a única vinculada ao Thiago como parceiro).
- Esse número foi ativado **hoje** (primeira mensagem 27/08 09:02 BRT), então a rampa de proteção o coloca na **fase 1 = 15 envios/dia**, mesmo com cota Meta de 2.000.
- Ele já enviou **172 mensagens hoje** — muito acima do teto da fase 1. Ao chegar a vez da campanha, não havia nenhum número elegível e o job encerrou.
- Como esse job foi encerrado antes da nova lógica de espera, ele ficou em `erro` puro e não volta sozinho.

Ponto positivo: o engajamento do número está bom (resposta 44,8%, não lidas 30,2%), ou seja, o corte é da rampa de idade, não de qualidade.

## 3. É possível retomar de imediato — sim, com liberação consciente

Sem liberar cota não há como retomar: o único número da campanha está 172/15.

Proposta:

1. **Liberação manual do teto do dia** para AMARAL 62 8273-8416: ajustar o teto de hoje de 15 para **250** (bem abaixo do limite de segurança de 60% da cota Meta, que seria 1.200). Isso cobre os 151 pendentes com folga.
2. **Religar a campanha** do Thiago em modo normal (status `rodando`, próxima tentativa imediata) — os 151 pendentes continuam salvos e saem no ritmo configurado.
3. Criar uma ação reutilizável no painel de detalhe da campanha (visível para admin): **"Liberar mais envios hoje neste número"**, com registro de quem liberou, para não precisar de intervenção técnica na próxima vez.

Ressalva honesta: número novo enviando 300+ mensagens no primeiro dia é o perfil que mais leva a queda de qualidade/bloqueio. Recomendo liberar 250 hoje (não ilimitado) e deixar a rampa normal a partir de amanhã.

## Detalhes técnicos

- `supabase/functions/envio-meta-massa-tick/index.ts`: `proximaReavaliacao()` passa de `30 * 60 * 1000` para `5 * 60 * 1000`, mantendo o desvio para 08:00 BRT do próximo dia útil.
- `src/components/meta/CampanhaDetalheDialog.tsx`: banner de cota mostra "reavaliação automática a cada 5 min" em vez do horário/contador de segundos; adiciona botão admin "Liberar mais envios hoje" (upsert em `meta_instance_freio_diario` do dia BRT via ação nova em `envio-meta-massa-control`, limitada a 60% de `tier_diario` e apenas para admin).
- `supabase/functions/envio-meta-massa-control/index.ts`: nova ação `liberar_teto_hoje` (valida admin, instância pertencente ao job, teto máximo = `floor(tier_diario * pct_max_cota_meta)`) e reativação do job (`status='rodando'`, `status_motivo=null`, `proximo_em=now()`).
- Ação pontual de dados: teto de hoje de `89eaf081-f5d7-4c4d-8bca-4b28d3958597` para 250 e job `06da3b5d-a10c-4f7b-8c33-d7b3ca6e223a` de `erro` para `rodando`.
- Nada de furar quarentena, recuperação de qualidade ou bloqueio por falhas consecutivas — só o teto de rampa por idade, que é regra nossa e não da Meta.
