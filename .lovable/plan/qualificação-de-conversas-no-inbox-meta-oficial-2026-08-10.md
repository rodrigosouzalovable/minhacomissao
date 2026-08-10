# Qualificação de conversas no Inbox Meta Oficial

Objetivo: marcar cada conversa com um tipo de qualificação, ver de longe o que ainda não foi qualificado, controlar isso por caixa de mensagens, e levar esses números para o relatório de WhatsApp/grupo + um Excel próprio.

## 1. Botão "Qualificação" na conversa

- Novo botão no topo da conversa, **à esquerda do selo "Aberta/Fechada em 24h"**.
- Ao clicar, abre um diálogo com os tipos de qualificação ativos (botões coloridos). Um clique marca; clicar no mesmo desmarca.
- Uma qualificação por conversa (a nova substitui a anterior). Guarda quem qualificou e quando.
- Quando já qualificada, o botão mostra o nome da qualificação atual.

## 2. Configuração dos tipos (só admin)

- Dentro do mesmo diálogo, engrenagem "Gerenciar qualificações" visível apenas para admin:
  - criar, renomear, escolher cor, ativar/inativar e excluir.
  - inativar mantém o histórico; excluir só é permitido quando não há conversas usando (senão sugere inativar).

## 3. Pisca azul nas conversas não qualificadas

- Na lista da esquerda, conversas **sem qualificação** ganham um pulso lento em azul (borda/fundo suave, ~2s por ciclo).
- Vale apenas para caixas com qualificação ativada e para conversas que tiveram resposta do cliente (evita piscar disparo sem retorno).
- Ao qualificar, a conversa volta imediatamente à aparência normal.

## 4. Configuração por caixa de mensagens

- No clique direito sobre a aba da caixa, além de "Atendentes desta caixa", entra **"Configurar caixa"**:
  - liga/desliga a qualificação naquela caixa (inclui a caixa Padrão).
- Com a qualificação desligada, o botão na conversa e o efeito de pisca não aparecem naquela caixa.

## 5. Relatório de WhatsApp / grupo

- Nos envios já existentes (parciais 10h/13h/17h e consolidado 19h30), entra um bloco novo:

```text
*🏷 Qualificações do dia:*
  Interessado: 12
  Sem interesse: 5
  Já pagou: 3
  Aguardando boleto: 8
  Não qualificadas: 21
```

- Conta as qualificações lançadas no dia (fuso BRT), listando todos os tipos ativos, inclusive os com zero, mais o total pendente.

## 6. Excel de qualificações

- No sino de Consultas de CPF, o botão **Excel** passa a abrir um menu com duas opções:
  1. **Consultas de CPF ao portal** (comportamento atual).
  2. **Qualificações lançadas** — planilha com telefone, nome, qualificação, caixa de mensagens, atendente que qualificou, data/hora; uma aba/coluna por qualificação para filtrar rápido.
- Exportação paginada (sem limite de 1.000), com indicador de progresso, no mesmo padrão já usado.

## Detalhes técnicos

- Banco:
  - `meta_qualificacoes` (nome, cor, ordem, ativo) — leitura autenticada, escrita admin.
  - `meta_contato_qualificacao` (contato_id único, qualificacao_id, user_id, created_at) com GRANTs + RLS seguindo o padrão das tabelas do inbox (acesso conforme a caixa do contato).
  - `meta_inbox_folders.qualificacao_ativa boolean default true`; a caixa Padrão usa uma chave em `system_settings`.
- Frontend: novos `MetaQualificacaoDialog.tsx` e `MetaFolderConfigDialog.tsx` em `src/components/inbox/meta/`, ajustes em `InboxMeta.tsx` (header da conversa, lista, menu de contexto das abas) e em `NotificacoesCpfBell.tsx` (menu do Excel). Cores e animação via tokens do design system.
- Relatório: `supabase/functions/relatorio-acionamentos-sync/index.ts` ganha uma consulta agregada por qualificação no período — sem novo cron, sem novo canal Realtime, custo praticamente inalterado.
