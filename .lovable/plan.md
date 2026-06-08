# Mais motivação no Dashboard do funcionário

5 features novas, todas visíveis só para não-admin (exceto config admin).

## 1. Avatar evolutivo com moldura dourada

- Novo componente `src/components/AvatarComMoldura.tsx`: wrapper sobre `Avatar` shadcn que aceita `tier: 'none' | 'bronze' | 'prata' | 'ouro' | 'diamante'`.
- Moldura via `ring` + gradiente (`ring-4 ring-offset-2`) e brilho animado (`animate-pulse` suave) só no ouro/diamante.
- Regra de tier (mês atual):
  - 0–49% meta: none
  - 50–79%: bronze
  - 80–99%: prata
  - 100–119%: ouro (com brilho)
  - ≥120%: diamante (gradiente arco-íris animado)
- Usar no header (`AppLayout`) ao redor do avatar do próprio usuário e no `MuralTop3` (item 2).
- Tier vem de hook novo `useTierMeta()` que reusa `useMetaMes()`.

## 2. Mural mensal Top 3

- Novo componente `src/components/MuralTop3.tsx` renderizado no Dashboard (acima do `MotivacaoCard`, só para não-admin, só se visível).
- Visual: pódio com 3 cards (2º à esquerda mais baixo, 1º centro alto com 🏆 e confete sutil contínuo, 3º à direita), foto com moldura dourada/prata/bronze, nome, valor recebido no mês.
- Dados: reusa RPC existente `ranking_mensal` (top 3).
- Admin define visibilidade: nova chave em `system_settings` (ou tabela `configuracoes_motivacao` — ver item 6) `mural_top3_visivel` (bool, default true).
- Admin controla via novo dialog `ConfigMotivacaoDialog` (item 6), aberto por botão no Dashboard admin.

## 3. Mensagem motivacional do dia (com banco de frases)

- Banner novo `src/components/FraseDoDiaBanner.tsx` no topo do dashboard do funcionário (acima do `MetaMesBanner`).
- Visual: card com gradiente sutil, ícone de aspas, frase grande, autor "— da gestão" ou nome do admin.
- Fontes da frase, em ordem de prioridade:
  1. Frase customizada do admin para a data de hoje (campo `frase_custom` + `frase_data` em `configuracoes_motivacao`).
  2. Frase do pool fixo (50+ frases curadas no arquivo `src/lib/frasesMotivacionais.ts`) — seleção determinística por `dia-do-ano % total` (mesma frase para todos no mesmo dia).
- Eu (Lovable) escrevo as 50+ frases agora, divididas em categorias: garra/disciplina (15), foco em meta (15), virada de jogo (10), gratidão/equipe (10). Todas curtas (≤120 chars), pt-BR, tom direto, sem clichês de coach raso.
- Admin escreve frase via `ConfigMotivacaoDialog` (item 6): textarea + date picker; gravar em `configuracoes_motivacao`.

## 4. Meta semanal (4 semanas) com prêmio R$ 50

- Novo componente `src/components/MetaSemanalCard.tsx` abaixo do `MetaMesBanner`.
- Lógica:
  - Divide `valorMeta` mensal por 4 → `metaSemana = valorMeta / 4`.
  - Define 4 janelas: semana 1 = dias 1–7 do mês, semana 2 = 8–14, semana 3 = 15–21, semana 4 = 22–fim. (Calendário, não dias úteis — mais simples de visualizar.)
  - Para cada semana, soma `pagamentos.valor_parcela` (status pago) cuja `data_paga` cai na janela.
- Visual: 4 "cofrinhos" lado a lado:
  - Semana futura: cinza, cadeado.
  - Semana corrente: barra de progresso animada verde com % e "Faltam R$ X para R$ 50 💰".
  - Semana batida: cofrinho dourado pulsante + selo "R$ 50 LIBERADO ✅" + animação confete pequeno ao bater (uma vez, guardar em localStorage `semana-batida-{mesAno}-{n}-{user}`).
  - Semana fechada não batida: cinza com "Não bateu".
- Som opcional de "ca-ching" desligado por padrão (toggle futuro).
- Registro de prêmios: insere em nova tabela `premios_semanais` (user_id, mes_ano, semana 1-4, valor 50, atingido_em, status 'pendente'). Admin vê lista no `ConfigMotivacaoDialog` aba "Prêmios a pagar" para marcar como pago.

## 5. Comparativo com recorde pessoal

- Adicionar à `MotivacaoCard` (ou cartão separado pequeno `RecordePessoalCard.tsx` ao lado do streak):
  - Query: agrega `pagamentos.valor_parcela` (pago) por mês para o user_id, todos os meses, retorna o maior → `melhorMes` (mes_ano + valor).
  - Texto: 
    - Se mês atual > melhor histórico: "🏅 NOVO RECORDE! Você superou {mesAnterior} em R$ X!" (badge dourado).
    - Se ainda não: "Seu recorde é R$ X em {mes}. Faltam R$ Y para superar 🚀".
    - Se primeiro mês com dados: "Esse é seu primeiro mês registrado — vamos cravar a régua! 📏".
  - Cache via react-query 5 min.

## 6. Tabelas novas + dialog admin

### `configuracoes_motivacao` (singleton — id fixo)
```
id uuid PK
mural_top3_visivel bool default true
frase_custom text
frase_data date
frase_autor text
atualizado_por uuid
criado_em / atualizado_em timestamptz
```
RLS: SELECT para `authenticated`; UPDATE só admin.

### `premios_semanais`
```
id uuid PK
user_id uuid → auth.users
mes_ano text          -- 'YYYY-MM'
semana int            -- 1..4
valor numeric default 50
atingido_em timestamptz default now()
status text default 'pendente'   -- pendente | pago
pago_em timestamptz
UNIQUE (user_id, mes_ano, semana)
```
RLS: user vê os próprios + admin vê tudo; INSERT pelo próprio user (trigger client-side ao bater); UPDATE só admin (marcar pago).

GRANTs em ambas para `authenticated` + `service_role`.

### `ConfigMotivacaoDialog.tsx`
Aberto via novo botão "Motivação" no Dashboard admin (ao lado de "Definir Meta"). 3 abas:
- **Frase do dia**: textarea + date picker + autor (default "Equipe"). Lista próximas frases agendadas + pool fixo (preview).
- **Mural Top 3**: toggle visível/oculto.
- **Prêmios semanais**: lista `premios_semanais` (pendentes primeiro), botão "Marcar como pago".

## Arquivos

Novos:
- `src/components/AvatarComMoldura.tsx`
- `src/components/MuralTop3.tsx`
- `src/components/FraseDoDiaBanner.tsx`
- `src/components/MetaSemanalCard.tsx`
- `src/components/RecordePessoalCard.tsx`
- `src/components/ConfigMotivacaoDialog.tsx`
- `src/lib/frasesMotivacionais.ts` (50+ frases que escrevo)
- `src/hooks/useTierMeta.tsx`
- migration: `configuracoes_motivacao` + `premios_semanais` + RLS + GRANTs

Editados:
- `src/pages/Dashboard.tsx` (montar novos componentes + botão admin "Motivação")
- `src/components/layout/AppLayout.tsx` (avatar com moldura no header)
- `src/hooks/useMetaMes.tsx` (expor `tier`)

## Fora de escopo

- Pagamento automático do PIX (admin marca manualmente como pago; integração PIX fica para outra iteração).
- Som de cha-ching (proposto mas adiado).
- Sistema de XP/níveis acumulativo entre meses.
- Notificação WhatsApp ao bater semana (pode ser próxima iteração, com botão "avisar admin").

## Aviso sobre custo

Nenhuma das features usa IA generativa ou storage novo — frases são estáticas no código, dados em tabelas pequenas. **Impacto em custo de Lovable Cloud: desprezível.**
