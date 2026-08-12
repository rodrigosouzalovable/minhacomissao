# Baixar Excel deve exportar todos os enviados (não só 200)

## O que está acontecendo

O botão "Baixar Excel" exporta exatamente o que está carregado na tela. Para economizar dados, o detalhe da campanha carrega no máximo 200 registros por vez (enviados + erros juntos), com botão "Carregar mais". Por isso o arquivo saiu com 200 linhas mesmo com 758 enviados.

## O que será corrigido

A exportação passa a buscar os dados direto do banco, em páginas, até o fim — independente do que está visível na tela:

- "Baixar Excel" em **Enviados** exporta 100% dos enviados da campanha (ex.: 758 linhas).
- "Baixar Excel" em **Erros** e em **Falhas de entrega** também passam a exportar a lista completa.
- Durante o download o botão mostra progresso (ex.: "Baixando... 600") e o aviso final traz o total real exportado.
- O status de entrega (Aceito / Entregue / Lida / Falhou) é resolvido para todas as linhas, buscando os registros de entrega em lotes.
- A lista na tela continua paginada em 200 (economia de dados); só a exportação baixa tudo.

Nenhuma regra de envio, delay, rodízio de instâncias ou contagem de campanha é alterada.

## Detalhes técnicos

- `src/contexts/EnvioMetaSendingContext.tsx`
  - Nova função `exportarItensJob(jobId, onProgresso?)`: lê `envio_meta_job_item` (status `enviado`/`erro`) em páginas de 1.000 via `.range()` até a página vir incompleta, sem gravar no cache de tela.
  - Nova função auxiliar para resolver entrega em massa: consulta `meta_whatsapp_envios_log` filtrando por `user_id` + `enviado_em >= iniciado_em` em lotes de ~300 telefones (`.in()`), montando o mapa telefone → melhor status (mesma lógica de ranking já usada em `carregarLogs`).
  - Expostas no contexto, sem alterar `carregarItens` (paginação visual permanece em 200).
- `src/components/meta/CampanhaDetalheDialog.tsx`
  - `baixarEnviados`, `baixarErros` e `baixarFalhasEntrega` passam a chamar `exportarItensJob` e filtrar em memória (enviados / erros / entrega falhou), em vez de usar `detalhes.*`.
  - Estado de "exportando" por botão, com rótulo de progresso e desabilitado durante a busca.
  - Mesmas colunas e mesmo padrão de nome de arquivo.

Impacto de custo: baixo e sob demanda — as páginas extras só são baixadas quando o usuário clica em exportar.
