## Objetivo
Ao selecionar um template com placeholders numerais (`{{1}}`, `{{2}}`, ...) no diálogo "Nova conversa Meta", exibir um campo de input para cada variável, permitindo que o usuário preencha nome/número/valor livremente antes de disparar o template.

## Onde
`src/components/inbox/meta/MetaNovaConversaDialog.tsx`

## Comportamento
1. Ao trocar `selectedTemplate`, extrair os placeholders numéricos únicos do `body_text` **e** do header TEXT (via `variaveis._components`), ordenados por índice (1, 2, 3...).
2. Se houver ≥1 placeholder numeral, renderizar um `Input` por variável, rotulado como "Variável {{1}}", "Variável {{2}}"..., com dica opcional do campo mapeado (`variaveis["1"]` ex: `{nome}`) como placeholder.
3. Estado local `sampleValues: Record<string,string>` resetado a cada troca de template.
4. Passar esses valores no payload do envio como `cliente.vars` — o backend `send-whatsapp-meta` já consome `rowVars[k]` com prioridade sobre inferência automática (linhas 124-149 do `buildParameters`), então nenhuma mudança de backend é necessária.
5. Passar também `sampleValues` (array indexado) ao `<TemplateWhatsAppPreview>` para o preview refletir os valores digitados em tempo real (o componente já aceita a prop `sampleValues`).
6. Se o template só tiver placeholders nomeados (ex.: `{{name}}`) — comportamento atual (campo "Nome") permanece; não renderiza os inputs numerais.
7. Botão "Enviar template" fica desabilitado enquanto qualquer variável numeral obrigatória estiver em branco.

## Detalhes técnicos
- Regex de extração: `/\{\{\s*(\d+)\s*\}\}/g` aplicada em `body_text` + `header.text` (quando `header.format === "TEXT"`).
- Placeholder do input: usar `variaveis[k]` do template quando existir (mostra ao usuário o que aquela posição significa, ex.: `{nome}`, `{cpf}`).
- Não alterar edge functions; não tocar em outros componentes.

## Fora de escopo
- Templates com header IMAGE/VIDEO (imagem continua vinda do cadastro do template).
- Persistir valores digitados entre aberturas do diálogo.