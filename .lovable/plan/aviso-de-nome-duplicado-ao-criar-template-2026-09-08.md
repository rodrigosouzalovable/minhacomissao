# Aviso de nome duplicado ao criar template

## O que muda

Em **Templates Meta → Criar template**, enquanto você digita o nome do template o sistema compara automaticamente com os modelos que já existem na aba **"Aplicar em lote"** (a lista de modelos mestre já carregada na página):

- Se o nome **já existe**, aparece um aviso em amarelo logo abaixo do campo: *"Já existe um modelo com esse nome (categoria X). A Meta rejeita nomes duplicados na mesma conta."*
- A comparação ignora maiúsculas/minúsculas (o campo já força minúsculas) e reage a cada letra digitada, sem precisar clicar em nada.
- O botão **Salvar** fica bloqueado enquanto o nome estiver duplicado, evitando um envio que a Meta rejeitaria.

## Detalhes técnicos

- Apenas `src/pages/MetaTemplates.tsx`: um `useMemo` derivado (`nomeDuplicado = mestres.find(m => m.nome === nome.trim())`), exibição condicional do aviso e inclusão da condição no `disabled`/validação do salvar.
- Sem banco, Edge Functions, cron ou custo adicional — reaproveita a lista `mestres` já carregada.
