# Baixar os números "acionados recentemente" no Envio Meta

## O que está acontecendo

Ao agendar/iniciar uma campanha, o diálogo "Contatos acionados recentemente" mostra apenas a contagem (ex.: 1.156 de 3.756). Os números identificados são calculados na hora, mas descartados — não há como baixá-los.

## O que será feito

1. **Guardar os números identificados.** A checagem `contarJaEnviadosRecentes` passa a devolver também a lista dos telefones encontrados (com a data do último envio de cada um), e o diálogo passa a manter essa lista em estado.
2. **Botão "Baixar números" no diálogo.** Um botão com ícone de download (ao lado de "Cancelar") exporta um Excel (`exportarParaExcel`) com as colunas:
   - Telefone
   - Último envio (data/hora)
   - Campanha (nome do job, quando disponível)
   - Nome do arquivo: `contatos-acionados-recentemente-<data>.xlsx`
3. **Sem mudança de comportamento.** Os botões "Ignorar recentes" e "Enviar para todos" continuam funcionando exatamente como hoje; o download é apenas informativo e não altera o disparo.

## Detalhes técnicos

- `src/pages/EnvioMeta.tsx`
  - `contarJaEnviadosRecentes`: além do total, monta um mapa sufixo → `{ telefone, processado_em, job_id }` (último envio por sufixo) durante a paginação já existente em `envio_meta_job_item`; resolve o nome da campanha via `envio_meta_job` em lote (`.in()` sobre os job_ids encontrados).
  - Estado `reenvioDlg` ganha o campo `recentesLista: { telefone, ultimoEnvio, campanha }[]`.
  - Novo botão "Baixar números" (variant ghost/outline, ícone `Download`) no rodapé do diálogo, desabilitado quando a lista está vazia; chama `exportarParaExcel` de `src/lib/exportExcel.ts`.
- Sem alteração no servidor, nas regras de antirrepetição ou no agendamento.

Impacto de custo: nenhum — reutiliza a consulta já feita hoje; só adiciona o download sob clique.
