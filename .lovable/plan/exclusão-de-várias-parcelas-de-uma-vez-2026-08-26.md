# Exclusão de várias parcelas de uma vez

No detalhe do acordo, o botão de lixeira de cada parcela hoje só exclui aquela parcela. A mudança adiciona um modo de seleção múltipla para apagar várias parcelas em uma única ação.

## Como vai funcionar

- No cabeçalho do bloco "Parcelas" aparece o botão "Selecionar parcelas" (visível para quem já pode excluir: admin, ou dono do acordo para parcelas pendentes).
- Ao ativar, cada parcela exibe uma caixinha de seleção no lugar da lixeira individual, e surge uma barra com: quantidade selecionada, "Selecionar todas", "Cancelar" e "Excluir selecionadas".
- Parcelas já pagas só ficam selecionáveis para admin; para o dono do acordo elas permanecem bloqueadas (mesma regra atual).
- "Excluir selecionadas" abre uma confirmação listando os números das parcelas. Ao confirmar, as parcelas são excluídas uma a uma; ao final aparece um resumo (quantas foram excluídas e, se houver, quais falharam e o motivo).
- Fora do modo de seleção nada muda: a lixeira individual continua funcionando como hoje.

## Detalhes técnicos

- Arquivo: `src/pages/AcordoDetalhe.tsx`.
- Novos estados locais: `modoSelecao: boolean` e `selecionadas: Set<string>`.
- Reaproveitar a RPC existente `excluir_parcela_pendente`, chamada em sequência para cada id selecionado (sem mudança de banco de dados), atualizando `pagamentos` apenas com os ids realmente excluídos.
- Extrair a checagem `isAdmin || (isOwner && pagamento.status !== 'pago')` para um helper `podeExcluirParcela(p)` usado tanto pela lixeira individual quanto pela seleção múltipla.
- Usar `Checkbox` do shadcn e `AlertDialog` já importados/disponíveis no projeto; sem novas dependências.
