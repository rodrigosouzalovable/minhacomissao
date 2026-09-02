# CPF obrigatório na importação de planilha (Envio Meta)

Tornar o CPF um campo exigido no mapeamento da planilha, com preenchimento automático de zeros e um botão para ligar/desligar a exigência.

## O que será feito

1. **Botão "CPF obrigatório" no card Destinatários**
   - Novo botão/switch ao lado de "Importar Excel", já **marcado como obrigatório por padrão** sempre que a página abre.
   - Ao desmarcar, a importação volta a aceitar planilha sem coluna de CPF (o aviso atual continua aparecendo).
   - O estado não fica salvo entre sessões: começa sempre ligado.

2. **Exigência no diálogo de mapeamento**
   - Com a opção ligada, o diálogo mostra o CPF/CNPJ como campo obrigatório (junto do Telefone) no texto de instruções e destaca a exigência quando nenhuma coluna está marcada.
   - O botão "Confirmar" bloqueia com a mensagem "Selecione a coluna de CPF / CNPJ" enquanto nenhuma coluna estiver marcada como CPF.
   - A detecção automática de coluna de CPF continua funcionando, então normalmente já vem pré-selecionada; quando não vier, o usuário é obrigado a escolher.

3. **Completar CPF encurtado automaticamente**
   - Quando a coluna de CPF trouxer menos dígitos que o normal (Excel remove zeros à esquerda), o sistema completa com zeros à esquerda: 5–11 dígitos viram CPF de 11; 12–14 dígitos viram CNPJ de 14.
   - O valor já completo é o que vai para a lista de destinatários, para a campanha e para a conversa do Inbox — nada de CPF pela metade.
   - Linhas cujo CPF fique inválido (vazio ou com mais de 14 dígitos) são sinalizadas com um aviso informando quantas linhas ficaram sem documento válido, sem travar o envio.

## Detalhes técnicos

- `src/pages/EnvioMeta.tsx`: novo estado `cpfObrigatorio` (default `true`), botão de alternância no header do card "3. Destinatários" e passagem de `requireCpf={cpfObrigatorio}` para `MapearColunasImportDialog`. Reaproveita `normalizeDocument` já existente (linhas 126-132).
- `src/components/meta/MapearColunasImportDialog.tsx`:
  - nova prop opcional `requireCpf?: boolean`;
  - em `confirmar()`, bloquear quando `requireCpf && idxCpf < 0`;
  - na coluna de saída `CPF/CNPJ`, aplicar padding (`padStart(11)` / `padStart(14)`) em vez do `replace(/\D/g,"")` puro, com contagem de documentos inválidos para o toast de aviso;
  - ajustar o texto do `DialogDescription` e o rótulo da coluna para indicar obrigatoriedade.
- Sem migração de banco, sem novo cron/polling — nenhum impacto de custo no Cloud.
