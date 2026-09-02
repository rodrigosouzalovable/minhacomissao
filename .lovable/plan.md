# Credor obrigatório na importação (Envio Meta)

Adicionar, ao lado do botão "CPF obrigatório", um botão para exigir (ou não) a coluna de Credor na importação de planilha — ligado por padrão.

## O que será feito

1. **Novo botão "Credor obrigatório" no card "3. Destinatários"**
   - Fica ao lado do botão de CPF, com o mesmo visual (sólido quando ligado, contornado quando desligado).
   - Vem sempre ligado ao abrir a página; o estado não é salvo entre sessões.
   - Ao desligar, a importação volta a aceitar planilha sem coluna de Credor (exceto quando o modo "template por credor" já exigir, que continua mandando).

2. **Comportamento no diálogo de mapeamento**
   - Com a exigência ligada, o botão "Confirmar e importar" bloqueia enquanto nenhuma coluna estiver marcada como **Credor**, com a mensagem já existente.
   - A validação atual continua: linhas com credor vazio ou não reconhecido (fora de UME / NOVO MUNDO) impedem a importação e mostram quantas linhas estão erradas.
   - A detecção automática da coluna Credor continua funcionando, então normalmente ela já vem pré-selecionada.

3. **Texto de instruções**
   - A descrição do card e o texto do diálogo passam a indicar que Telefone, CPF/CNPJ e Credor são obrigatórios quando as respectivas exigências estiverem ligadas.

## Detalhes técnicos

- `src/pages/EnvioMeta.tsx`: novo estado `credorObrigatorio` (default `true`); botão de alternância ao lado do de CPF; passar `requireCredor={credorObrigatorio || templatePorCredor}` ao `MapearColunasImportDialog` (hoje passa apenas `templatePorCredor`).
- `src/components/meta/MapearColunasImportDialog.tsx`: apenas ajuste do texto do `DialogDescription` para citar Credor quando `requireCredor` estiver ativo. A lógica de bloqueio em `confirmar()` já existe e é reaproveitada.
- Sem mudanças de banco, cron ou edge functions — nenhum impacto de custo no Cloud.
