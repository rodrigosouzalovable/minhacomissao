## Objetivo

Melhorar o campo "Destinatários" (passo 3) do envio Meta em massa para (a) não mostrar vírgulas de campos vazios e (b) exibir os dados como uma tabela com cabeçalhos, deixando claro qual valor foi mapeado para cada variável do template.

## Problema atual

Hoje o `MapearColunasImportDialog.confirmar()` gera cada linha como CSV posicional fixo:

```
telefone, nome, cpf, atraso, saldo, {{1}}, {{2}}, ...
```

Quando a planilha só tem `Telefone + {{2}} + {{1}}`, os campos padrão ficam vazios e o resultado vira `5516997232580, , , , , Ykosten..., 6794...` — exatamente o que aparece na imagem. Além disso, o textarea é só texto, sem cabeçalho, então o usuário não vê qual coluna corresponde a qual variável.

## O que vai mudar

### 1. Gerar apenas as colunas que foram mapeadas (com cabeçalho)

Em `src/components/meta/MapearColunasImportDialog.tsx` → `confirmar()`:

- Descobrir dinamicamente quais papéis foram mapeados (telefone sempre, e só os outros que o usuário selecionou: nome / cpf / atraso / saldo / cada `tplvar:*` na ordem dos placeholders do template).
- Para cada linha, gerar o CSV somente com essas colunas — sem os "buracos" `, , , ,`.
- Enviar junto o cabeçalho (ex.: `Telefone, {{1}}, {{2}}`) como primeira linha do array retornado (ou via um novo parâmetro `headers` no `onConfirm`).

Assinatura atualizada de `onConfirm`:

```ts
onConfirm: (
  csvLines: string[],
  stats: { total; ignorados; duplicados },
  varsByTel: Record<string, Record<string, string>>,
  headers: string[],   // novo
) => void;
```

### 2. Exibir como tabela em vez de textarea

Em `src/pages/EnvioMeta.tsx`, no bloco do passo 3 "Destinatários":

- Guardar `recipientsHeaders: string[]` no estado (vindo do dialog).
- Se `recipientsHeaders.length > 0` e `recipientsRaw` foi gerado via import, renderizar uma tabela `<table>` estilo shadcn com scroll:
  - `<thead>`: cabeçalhos ex. `Telefone | {{1}} — Razão Social | {{2}} — CNPJ`
  - `<tbody>`: uma linha por destinatário, cada célula = valor separado por `,`.
  - Altura fixa com `overflow-auto`, primeira coluna sticky opcional.
- Manter o textarea como fallback quando o usuário digitou manualmente (sem headers).
- Botão "Editar como texto" que alterna para o textarea atual (mantendo o fluxo manual de colar linhas).

### 3. Ajustar `removerSemWhatsApp()` e `parseRecipients()`

- `parseRecipients()` continua igual (só usa `telefone`); os valores das variáveis já vêm via `varsByTel`.
- `removerSemWhatsApp()` reconstrói `recipientsRaw` respeitando a mesma ordem/colunas do `headers` atual (usar `varsByTel[key]` + valores de nome/cpf/atraso/saldo quando estavam presentes).

### 4. Sem mudanças de backend

- `varsByTel` já é o que alimenta `clientesComVars`. O envio real (`envio-meta-massa-iniciar` → `send-whatsapp-meta`) continua usando `cliente.vars`, então a mensagem final permanece correta: `Olá *Ykosten...*! O CNPJ 67949227000159 foi validado...`.

## Detalhes técnicos

- Cabeçalho de `tplvar:X`: reaproveitar `placeholderContext(bodyText, key)` para mostrar um trecho do template ao lado da variável (ex.: `{{1}} — Olá … !`), ajudando o usuário a confirmar o mapeamento.
- Preservar comportamento atual de deduplicação por sufixo de 8 dígitos.
- Tabela usa `text-xs font-mono` e `max-h-64 overflow-auto` para caber no card do passo 3 sem quebrar o layout já existente.

## Resultado esperado

Depois de importar a planilha do exemplo (só Telefone + {{2}} + {{1}}), o passo 3 mostra:

```
| Telefone       | {{1}} — Razão Social            | {{2}} — CNPJ         |
| 5516997232580  | Ykosten Tecnologia Da Info Ltda | 67949227000159       |
| 5516997033382  | Ykosten Tecnologia Da Info Ltda | 67949227000159       |
...
```

Sem vírgulas vazias, com cabeçalho e alinhamento tabular.
