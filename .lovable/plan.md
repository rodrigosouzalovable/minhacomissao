
# Motivação do funcionário no Dashboard

## 1. Barra de progresso sempre verde

Em `src/components/MetaMesBanner.tsx`, remover a lógica `barColor` baseada em percentual.
- Barra sempre `bg-gradient-to-r from-emerald-400 via-emerald-500 to-green-600`.
- Mantém status badge (Acima/Abaixo/Batida) à direita.
- Projeção continua verde/vermelho conforme estiver acima/abaixo da meta.

## 2. Camada de gamificação ("Conquistas e Motivação")

Novo componente `src/components/MotivacaoCard.tsx` renderizado logo abaixo do `MetaMesBanner` (só para não-admin). Combina várias mecânicas visuais:

### a) Mensagem dinâmica de parabéns/incentivo
Banner com gradiente animado + emoji grande + frase contextual baseada na faixa de progresso:
- 0–25%: "Bora começar forte! 🚀 Cada acordo conta."
- 25–50%: "Você já está construindo o resultado! 💪"
- 50–75%: "Mais da metade! Continua nesse ritmo 🔥"
- 75–99%: "Quase lá! Falta pouquíssimo para bater a meta 🎯"
- ≥100%: "META BATIDA! 🏆 Parabéns, você é fera!" + confete (canvas-confetti) ao montar.
- Projeção ≥ meta mas ainda não batida: "Sua projeção indica que vai bater! 📈 Mantém o foco."

### b) Medalhas / Badges desbloqueadas no mês
Linha de selos coloridos com tooltip. Cada um acende quando atingido:
- 🥉 Primeiro acordo do mês
- 🥈 25% da meta
- 🥇 50% da meta
- 💎 75% da meta
- 🏆 100% da meta
- ⭐ Acima de 120% (overachiever)
- 📅 5 dias seguidos recebendo pagamento (streak)

### c) Streak / Sequência de dias produtivos
Mini-cartão "Sequência atual: X dias 🔥" — conta dias úteis consecutivos com pelo menos 1 pagamento recebido.

### d) Ranking pessoal vs. equipe (opcional, visível só se houver dados)
"Você está em #N de M no mês" — usa query agregada de `pagamentos` por user_id no mês.

### e) Próxima recompensa visível
"Faltam R$ X para desbloquear 🥇 50% da meta" — gera senso de progresso.

### f) Confete ao bater meta
Lib: `canvas-confetti`. Dispara uma vez por sessão quando `recebido >= valorMeta` (guardar em localStorage `meta-confete-{mesAno}-{user}` para não repetir a cada refresh).

## 3. Painel "Como bater a meta" (quando abaixo)

Novo componente `src/components/SugestoesMetaCard.tsx`, renderizado abaixo do MotivacaoCard SOMENTE quando `projecao < valorMeta` OU `percentual < 70` no fim do mês.

Visual: card com borda âmbar, ícone 💡, título "Vamos virar esse mês!". Conteúdo:

### a) Diagnóstico automático
Calcula e mostra:
- "Para bater a meta você precisa receber R$ X em Y dias úteis = R$ Z/dia."
- "Sua média atual é R$ W/dia útil. Precisa subir M%."
- Sugere faixas a priorizar (lógica abaixo).

### b) Recomendações de cobrança baseadas em dados reais
Query em `devedores` (filtrada por user via RLS):
- **Faixa de atraso mais lucrativa em aberto**: agrupa devedores ativos por bucket (30-60d, 60-90d, 90-180d, 180-360d, 360d+) e mostra top 2 com `valor_total_aberto` + qtd clientes. Sugere "Foca nesta faixa: ROI histórico maior."
- **Clientes com promessa quebrada recente**: acordos com status `quebrado` nos últimos 30 dias → "Reabordar X clientes que quebraram acordo."
- **Clientes que pagaram parcela 1 mas pararam**: acordos ativos com 1 parcela paga e próximas vencidas → alta probabilidade de retomada.
- **Aniversariantes do mês** (se `data_nascimento` existir em devedores): script social para abordagem.

### c) Botão "Solicitar nova planilha de cobrança ao admin"
Abre dialog `SolicitarPlanilhaDialog`:
- Seleciona faixa de atraso desejada (checkboxes: 30-60d, 60-90d, etc.)
- Seleciona credor (multi-select de `acordos.credor` distintos)
- Quantidade desejada de clientes
- Campo de observação livre
- Submit → insere em nova tabela `solicitacoes_planilha` (user_id, faixas, credores, qtd, observacao, status='pendente', criado_em).
- Notifica admin via WhatsApp usando edge function existente `notificar-admin` (admin 62991672674).

### d) Dicas rápidas (chips)
- "Ligue antes de mandar WhatsApp em 60-90d (3x mais conversão)"
- "Envie áudio personalizado para 180d+"
- "Use desconto de 50% à vista para 360d+"

## 4. Migração: tabela `solicitacoes_planilha`

```sql
CREATE TABLE public.solicitacoes_planilha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  faixas_atraso text[] NOT NULL DEFAULT '{}',
  credores text[] NOT NULL DEFAULT '{}',
  qtd_clientes int,
  observacao text,
  status text NOT NULL DEFAULT 'pendente',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.solicitacoes_planilha TO authenticated;
GRANT ALL ON public.solicitacoes_planilha TO service_role;
ALTER TABLE public.solicitacoes_planilha ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own requests"
  ON public.solicitacoes_planilha FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own requests"
  ON public.solicitacoes_planilha FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update status"
  ON public.solicitacoes_planilha FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'));
```

## 5. Onde aparece para o admin

Em `Dashboard.tsx` (admin), pequeno badge "📨 N solicitações pendentes" linkando para nova rota `/admin/solicitacoes` (lista simples para marcar como atendido). **Fora deste escopo** — apenas o badge + lista mínima.

## Arquivos

- editar `src/components/MetaMesBanner.tsx` (barra verde)
- criar `src/components/MotivacaoCard.tsx` (gamificação + confete + medalhas + streak)
- criar `src/components/SugestoesMetaCard.tsx` (diagnóstico + faixas + dicas)
- criar `src/components/SolicitarPlanilhaDialog.tsx`
- editar `src/pages/Dashboard.tsx` (montar os dois cards para não-admin; badge admin)
- migration `solicitacoes_planilha`
- adicionar dep `canvas-confetti`

## Fora de escopo

- Página completa de gestão de solicitações para o admin (apenas badge + lista simples).
- Sistema global de XP/níveis acumulando por mês — fica para próxima iteração se você gostar das medalhas.
- Notificação push/email — usaremos só o WhatsApp do admin já existente.

## Ideias extras de motivação (para você escolher se quer incluir já)

1. **Som de "cha-ching" 💰** ao receber pagamento novo (detectado via realtime).
2. **Avatar evolutivo**: foto do funcionário ganha moldura dourada ao bater meta.
3. **Mural mensal**: top 3 do mês com foto na home (admin define visibilidade).
4. **Mensagem do admin**: campo onde admin escreve frase motivacional do dia que aparece no banner.
5. **Meta semanal**: divide a meta mensal em 4 e celebra cada semana batida.
6. **Comparativo com seu próprio recorde**: "Seu melhor mês foi R$ X — falta Y para superar!"

Me diga quais dessas extras quer que eu inclua no build.
