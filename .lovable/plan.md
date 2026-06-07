
## Objetivo
Criar a aba **Estratégias** (`/estrategias`) que importa a planilha CLIENTES SOUZA E RIBEIRO uma vez, cruza os dados internamente e permite que admin/funcionários gerem listas inteligentes de 50 ou 100 CPFs prontos para acionar via WhatsApp, baixando como Excel.

## Estrutura da planilha analisada
Abas usadas: `Cobrança` (CPF/idade/credor/contrato/atraso/risco), `CSIM` (CPF→telefone localizado), `CNAO` (sem localização), `ACORDO QUEBRADO` (CPFs com acordo quebrado) e `PARCELA 1..18+` (CPF + nº parcela + vencimento + valor da parcela em aberto).

## Banco de dados (1 migração)

Tabelas novas (todas com RLS, GRANT para `authenticated` e `service_role`):

1. **`estrategia_importacao`** — cada upload de planilha (nome arquivo, total CPFs, totais por aba, `importado_por`, `criado_em`, `ativo`). Só a importação `ativo=true` é usada.
2. **`estrategia_cliente`** — uma linha por CPF da última importação consolidando:
   - `cpf` (normalizado), `nome`, `telefone` (vindo da CSIM), `localizado` (bool, CSIM vs CNAO)
   - `idade`, `credor`, `tipo_credor` (APORTE/INADIMPLENTE), `contrato`
   - `atraso_dias`, `risco_total` (soma das parcelas em aberto)
   - `parcelas_abertas_qtd` (1..18+), `proxima_parcela_num`, `proxima_parcela_valor`, `proxima_parcela_vencimento`
   - `valor_minimo_parcela`, `valor_maximo_parcela`
   - `acordo_quebrado` (bool)
   - `faixa_valor_parcela` enum: `<100`, `100-199`, `200-299`, `300-399`, `400-499`, `500+`
   - `score` (0-100, calculado na importação — ver fórmula abaixo)
   - `reservado_por uuid`, `reservado_ate timestamptz` (anti-repetição)
3. **`estrategia_reserva_log`** — auditoria de cada download (user, qtd, filtro usado, lista de CPFs).

Índices em `cpf`, `score desc`, `(localizado, reservado_ate, score)`.

## Fórmula do score (calculada uma vez na importação)
Pontos somados (0-100):
- **+30** se `localizado=true` (CSIM)
- **+25** se `parcelas_abertas_qtd = 1` (mais fácil fechar)
- **+10** se `acordo_quebrado=true` (já negociou antes → renegocia)
- **+15** por faixa de valor: `200-499` = 15 pts (sweet spot), `500+` = 10, `100-199` = 8, `<100` = 3
- **+10** se atraso entre 60 e 360 dias (janela quente), +5 se 30-59, +3 se >360
- **+5** se `tipo_credor = APORTE` (recupera mais)
- **-10** se sem telefone localizado mas com endereço (vai pra fila bot)

Resultado: campo `score` fica indexado para ranqueamento instantâneo.

## Edge Function `estrategia-importar` (admin only)
- Recebe XLSX via upload, parseia com `xlsx` (Deno).
- Limpa importação anterior (`ativo=false`).
- Insere lote em `estrategia_cliente` (chunks de 500).
- Roda em < 60s para ~30k CPFs. Log de progresso.

## UI — Página `src/pages/Estrategias.tsx`

Rota nova `/estrategias` em `App.tsx`, atrás de `PermissionRoute` (admin libera para funcionários via permissões existentes). Item de menu no `AppLayout`.

### Seção 1 — Importar planilha (admin)
Card com upload do XLSX + indicador "Última importação: X CPFs em DD/MM HH:mm". Botão "Reimportar".

### Seção 2 — Listas prontas (atalhos de 1 clique)
Cards visuais mostrando o que o sistema considera "melhor":
- 🎯 **Top score geral** — CPFs com maior score
- 📞 **Localizados + 1 parcela só** — alvo mais fácil
- 💰 **Ticket alto (R$ 500+) localizados**
- 🔁 **Acordos quebrados localizados** — recuperação rápida
- 🟡 **Aporte localizado** — Novo Mundo Aporte
- ⏱️ **Atraso 60-180 dias** — janela quente

Cada card tem: contagem total disponível + seletor **50 / 100** + botão **Baixar Excel**.

### Seção 3 — Filtros manuais
Painel com:
- Faixa de valor de parcela (multi-select): `<100`, `100-199`, `200-299`, `300-399`, `400-499`, `500+`
- Qtd de parcelas em aberto (1, 2, 3, 4-6, 7+)
- Localizado (sim / não / qualquer)
- Acordo quebrado (sim / não / qualquer)
- Tipo credor (APORTE / INADIMPLENTE / qualquer)
- Faixa de atraso (slider em dias)
- Quantidade: **50 / 100 / 250**
- Ordenação: Score / Maior valor / Menor atraso
- Botão **Baixar Excel**

### Seção 4 — Histórico
Tabela das últimas 20 reservas do usuário (data, filtro, qtd CPFs). Botão "Liberar" para devolver CPFs ao pool antes do prazo.

## Anti-repetição (reserva por 48h)
Ao baixar, RPC `estrategia_reservar(p_filtro jsonb, p_qtd int)`:
1. Seleciona CPFs que batem nos filtros, `reservado_ate < now() OR reservado_por = auth.uid()`, ordena por score desc, LIMIT p_qtd.
2. Marca `reservado_por = auth.uid()`, `reservado_ate = now() + 48h`.
3. Insere log em `estrategia_reserva_log`.
4. Retorna a lista (CPF, nome, telefone, parcela, valor, vencimento, atraso, credor, contrato).

Admin tem botão **"Resetar todas as reservas"**.

## Excel gerado (download)
Usa `src/lib/exportExcel.ts` (já existe). Colunas:
`CPF | Nome | Telefone | Próxima parcela | Vencimento | Valor parcela | Faixa valor | Atraso (dias) | Parcelas abertas | Credor | Tipo | Contrato | Acordo quebrado | Score`

Nome do arquivo: `estrategia_{tipo}_{qtd}_{YYYYMMDD-HHmm}.xlsx`.

## Permissão
Adicionar `estrategias` em `user_permissions.abas_permitidas` para liberar a funcionários (admins sempre têm).

## Sugestões extras (opcionais — me confirma o que quer)
1. **Botão "Abrir no Inbox"** em cada CPF da lista — já leva para conversa pronta com template.
2. **Indicador "Já tem conversa ativa"** — cruza com `whatsapp_mensagens` pelo sufixo de 8 dígitos.
3. **Heatmap semanal** — mostrar quais horários da semana esses CPFs respondem mais (cruzando com histórico).
4. **Auto-distribuição** — em vez de o funcionário baixar, admin clica "Distribuir 500 CPFs entre os 5 operadores ativos" e o sistema reserva 100/cada.
5. **Tag visual no Inbox** — quando uma conversa receber resposta de um CPF reservado, aparece um badge "🎯 Estratégia".

## Arquivos a tocar
- Migração nova (3 tabelas + RPC `estrategia_reservar` + RPC `estrategia_resumo`)
- `supabase/functions/estrategia-importar/index.ts` (nova)
- `src/pages/Estrategias.tsx` (nova)
- `src/App.tsx` — rota
- `src/components/layout/AppLayout.tsx` — item de menu
- `src/components/EditPermissionsDialog.tsx` — checkbox "Estratégias"

## Custo Lovable Cloud
Baixo: 1 tabela com ~30k linhas (~5-10 MB), uma edge function chamada manualmente quando reimporta. Sem cron. Sem chamadas de IA. **Não aumenta custo recorrente.**
