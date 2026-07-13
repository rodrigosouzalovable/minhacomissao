## Objetivo

No fluxo "Importar planilha" da página Envio Meta, permitir que cada coluna do Excel seja associada diretamente a uma variável do template selecionado (ex.: `{{1}}` = Nome, `{{2}}` = CNPJ), além dos campos fixos (Telefone, Nome, CPF/CNPJ, Atraso, Saldo).

Assim o cliente pode importar uma planilha "5516... | YKOSTEN..." e mapear a coluna B como `{{2}}` do template, sem precisar reeditar as variáveis do template.

## Escopo

Somente o fluxo de importação → envio em massa Meta. Não altera envio de teste, envio manual, nem outros disparadores.

## Mudanças

### 1. `MapearColunasImportDialog.tsx`

- Nova prop opcional `template`: `{ nome_template, body_text, variaveis, placeholders: string[] }` (lista de chaves como `["1","2"]` ou nomeadas).
- `ColRole` passa a aceitar também `tplvar:<key>` (ex.: `tplvar:1`).
- Header do modal ganha um bloco compacto mostrando o corpo do template com os `{{N}}` destacados, para o usuário saber a que se refere cada variável.
- Select de cada coluna passa a listar, além de Ignorar/Telefone/Nome/CPF/Atraso/Saldo, uma seção "Variáveis do template" com uma opção por placeholder (rótulo: `{{1}} — trecho ao redor`). O trecho ao redor é extraído do `body_text` para dar contexto (ex.: `{{1}} — "Olá * ... !"`).
- Autodetecção: se `template.variaveis[k]` já mapeia para `{nome}`/`{cpf}`/etc, sugerir o mesmo ao encontrar cabeçalho equivalente.
- Restrição: cada `tplvar:k` só pode ser atribuída a uma coluna.
- Saída (`onConfirm`) evolui:
  ```ts
  onConfirm(
    csvLines: string[],
    stats: { total; ignorados; duplicados },
    varsByTel: Record<string /* telKey */, Record<string /* placeholder */, string>>
  )
  ```
  As colunas mapeadas para `tplvar:*` **não** entram no CSV; elas alimentam `varsByTel`, indexado pela chave normalizada do telefone (últimos 8 dígitos, mesmo padrão de dedup existente).

### 2. `EnvioMeta.tsx`

- Novo state `varsByTel: Record<string, Record<string, string>>`.
- Ao chamar o diálogo, passar o `template` selecionado com sua lista de placeholders (extraída do `body_text` via regex `/\{\{\s*([^}]+)\s*\}\}/g`).
- `onConfirm` do diálogo: além de preencher `recipientsRaw`, guardar `varsByTel`. Limpar `varsByTel` quando o usuário limpar/recolar recipients manualmente.
- Ao montar `clientesFinal` para `iniciar()`, anexar `vars` em cada `ClienteRow` a partir de `varsByTel[normalizeTelKey(...)]`.
- Estender o tipo `ClienteRow` com `vars?: Record<string,string>`.

### 3. `envio-meta-massa-iniciar/index.ts`

- Aceitar `vars` no payload de cada cliente e persistir em `envio_meta_job_item.vars` (jsonb, novo campo).

### 4. Migração SQL

- Adicionar coluna `vars jsonb` em `public.envio_meta_job_item` (default `'{}'::jsonb`).
- Nenhuma mudança de RLS/GRANT (tabela já existente).

### 5. `envio-meta-massa-tick/index.ts`

- Ao chamar `send-whatsapp-meta`, incluir `vars` do item no objeto `cliente` enviado.

### 6. `send-whatsapp-meta/index.ts` (substituição de variáveis)

- Em `buildParameters` e no `bodyRendered.replace(/\{\{\s*(\d+)\s*\}\}/g, ...)`:
  - **Prioridade nova**: se `cliente.vars?.[k]` existir e não for vazio, usar esse valor bruto.
  - Fallback: comportamento atual (`variaveis[k]` → `inferFieldForPlaceholder` → `resolveNamedVar`).
- Idem para placeholders nomeados (`{{nome_variavel}}`): se `cliente.vars?.[nome]` existir, usa.

### Fora do escopo

- Não altera `EditarVariaveisTemplateDialog` (mapeamento default do template continua funcionando).
- Não persiste o mapeamento escolhido no diálogo entre importações (é por importação).
- Não altera a preview do template em `CustoEstimadoEnvio` etc.

## Diagrama de dados

```text
Planilha            MapearColunasImportDialog        EnvioMeta                envio_meta_job_item
Col A (tel)  ---->  Telefone            ---------->  recipientsRaw (CSV)
Col B (CNPJ) ---->  tplvar:2            ---------->  varsByTel[tel][2]  --->  vars = {"2":"12.345..."}
Col C (Nome) ---->  Nome (ou tplvar:1)  ---------->  CSV nome / vars[1]
```

## Testes manuais

1. Importar planilha do exemplo (Tel/CNPJ/Nome), mapear B=`{{2}}` e C=Nome. Enviar teste para 1 contato — verificar no WhatsApp que `{{2}}` recebeu o CNPJ da linha.
2. Importar sem mapear nenhum `tplvar:*` — comportamento antigo permanece igual.
3. Trocar o template selecionado após abrir o diálogo — lista de placeholders atualiza.