# Mapear informações digitadas manualmente no Envio Meta

## Objetivo

Permitir que o usuário digite uma linha separada por vírgulas em **Destinatários** e defina claramente o significado de cada posição antes de continuar, inclusive as variáveis exigidas pelo template selecionado.

## Experiência na tela

1. Ao digitar a primeira linha e pressionar **Enter**, abrir automaticamente o mapeamento de campos.
2. Mostrar cada informação da linha em uma coluna separada, com seleção para:
   - Telefone
   - Nome
   - CPF/CNPJ
   - Credor
   - Atraso
   - Saldo
   - Ignorar
   - Variáveis do template, como `{{1}}`, `{{2}}` e demais variáveis disponíveis
3. Exibir uma prévia com os valores informados e o texto do template preenchido.
4. Exigir Telefone e respeitar os controles atuais de CPF/CNPJ e Credor obrigatórios.
5. Ao confirmar, aplicar a ordem definida às demais linhas desse bloco e apresentar os destinatários em tabela para conferência.
6. Não salvar o mapeamento como preferência permanente: ao iniciar uma nova entrada manual em texto, o sistema solicitará a definição novamente.
7. Manter **Editar como texto**; ao voltar para texto e iniciar um novo bloco manual, o Enter volta a abrir o mapeamento.

## Detalhes técnicos

- Reaproveitar o mapeador que já atende a importação Excel, evitando uma segunda lógica para os mesmos campos.
- Identificar a origem do mapeamento como **Excel** ou **digitação manual**, preservando o comportamento atual da planilha.
- No Enter da primeira linha manual, separar os valores com o mesmo leitor atual de vírgula, ponto e vírgula ou tabulação, preservando valores monetários com vírgula decimal.
- Fazer o mapeador aceitar o bloco manual sem confundir a primeira linha com cabeçalho.
- Ao confirmar, atualizar em conjunto o texto normalizado, os títulos da tabela, as variáveis por telefone e o credor por telefone.
- Não alterar o formato enviado ao processamento da campanha nem as regras existentes de deduplicação, validação de WhatsApp, custos, qualidade ou antirrepetição.

## Validação

- Testar uma linha manual com telefone, nome, CPF, credor e variáveis do template.
- Testar várias linhas no mesmo bloco e confirmar que todas seguem o mapeamento escolhido.
- Testar CPF/CNPJ e Credor nos modos obrigatório e opcional.
- Testar valor com vírgula decimal, como `R$ 1.250,50`.
- Confirmar que importação Excel e edição em tabela continuam funcionando sem mudança.
