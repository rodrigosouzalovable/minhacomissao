## O que muda

### 1. Preview WhatsApp ao selecionar um template

Na aba **Aplicar em Lote**, quando um template mestre for escolhido no dropdown, aparecerá um bloco (não dialog modal — pode ser um card colapsável logo abaixo do select, mais fluido para o fluxo atual, mas se preferir modal eu troco) mostrando o preview no estilo WhatsApp, igual ao print da Meta:

- Balão verde/creme com sombra e "papel de parede" ao fundo.
- Cabeçalho (se houver): TEXT / IMAGE / DOCUMENT.
- Corpo com variáveis destacadas (`{{name}}` amarelo).
- Rodapé em cinza.
- Botões (QUICK_REPLY com ícone de resposta, URL com seta externa, PHONE com telefone).
- Horário fictício no canto do balão.

Reaproveito o componente **`TemplateWhatsAppPreview`** que já existe (usado em outras telas), passando os campos do mestre convertidos para o formato `_components` que ele espera. Fica um código único, sem duplicação.

### 2. Botão excluir apenas quando não anexado

Regra: só mostra o botão de excluir o **template mestre** se **não existir nenhuma linha em `meta_templates_instancia`** para aquele mestre — ou seja, ele nunca foi enviado a nenhuma WABA. Assim que houver 1 envio (mesmo FALHA_ENVIO ou REJECTED), o botão some, para evitar apagar histórico de auditoria.

Aplica-se na aba **Status & Aprovação** (onde o botão já existe hoje). O ícone da lixeira só renderiza quando `filhas.length === 0`.

## Fora do escopo

- Excluir templates já enviados: a Meta não permite realmente "deletar" um template criado. O que dá para fazer no futuro é um botão "Descartar mestre + limpar registros" que apaga o mestre e as linhas locais, mas isso é potencialmente destrutivo — deixo para uma próxima iteração se você pedir.
- Modal completamente separado: se preferir modal em vez do card inline abaixo do select, é ajuste rápido — me diz.

## Custo

Zero. Só render no cliente.
