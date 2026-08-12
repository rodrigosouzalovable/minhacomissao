# Corrigir contagem "Enviados (200)" no detalhe da campanha

## O que está acontecendo

Nada foi perdido no disparo: a campanha CSIM 36 realmente processou 504 de 977 (os contadores da barra vêm direto do banco, do próprio job).

O número entre parênteses em "Enviados (200)" não é um contador — é apenas o tamanho da lista carregada na tela. Para reduzir custo de dados (egress), o sistema baixa no máximo **200 registros mais recentes** (enviados + erros juntos) ao abrir o detalhe da campanha. Por isso a lista trava em 200, mesmo com 493 enviados.

O mesmo limite afeta os chips de entrega (Aceito / Entregue / Lida / Falhou): eles são calculados só sobre esses 200 registros, então também ficam menores que a realidade.

## O que será corrigido

1. **Números reais nos títulos**: "Enviados" e "Erros" passam a mostrar a contagem oficial do job (ex.: Enviados (493), Falharam (11)), não o tamanho da lista.
2. **Aviso de amostra + carregar mais**: abaixo da lista aparece "mostrando os 200 mais recentes de 493" com um botão **Carregar mais** que traz mais 200 por clique (paginado, sem baixar tudo de uma vez).
3. **Chips de entrega corretos**: os totais de Aceito/Entregue/Lida/Falhou passam a ser calculados no banco (agregação leve que retorna só 5 números), em vez de derivarem da amostra de 200.
4. **Exportação Excel intacta**: já usa fluxo paginado próprio e continua trazendo 100% dos registros.

Nenhuma regra de envio, delay, rodízio de instâncias ou lógica de campanha é alterada.

## Detalhes técnicos

- `src/contexts/EnvioMetaSendingContext.tsx`
  - `carregarItens`: aceitar `offset`/append (páginas de 200 via `.range()`), mantendo o cache por job.
  - Guardar por job: `itensOffset` e flag `temMais`.
  - `getDeliveryResumoJob`: passar a ler o resultado da nova agregação; fallback para o cálculo local se a chamada falhar.
- Nova RPC `envio_meta_job_delivery_resumo(_job_id uuid)` (SECURITY DEFINER, checando dono do job / admin) agregando por status de entrega em `envio_meta_job_item` + `meta_whatsapp_envios_log` e retornando `aceito, entregue, lida, falhou, aguardando`.
- `src/components/meta/CampanhaDetalheDialog.tsx`
  - Títulos usam `job.enviados` / `job.erros`.
  - Rodapé de cada lista com aviso de amostra e botão "Carregar mais" chamando o novo carregamento paginado.

Impacto de custo: neutro a positivo — as páginas extras só carregam por ação explícita do usuário, e os chips deixam de exigir dados brutos.
