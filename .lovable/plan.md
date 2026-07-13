## Problema

Ao importar a planilha e mapear `Coluna B → {{2}}` (CNPJ) e `Coluna C → {{1}}` (Razão Social), o campo **Destinatários** mostra somente o telefone (ex.: `5516997232580`). O usuário achou que "ficou errado" — parece que o mapeamento não funcionou.

Na verdade os valores das variáveis são salvos em `varsByTel` e enviados corretamente no backend (o `send-whatsapp-meta` já prioriza `cliente.vars`). O que falta é **feedback visual**: mostrar no textarea de destinatários que cada telefone tem os valores das variáveis atrelados a ele.

## Correção (só front-end / apresentação)

### 1. `src/components/meta/MapearColunasImportDialog.tsx` — `confirmar()`

Ao montar cada linha do CSV de saída, incluir os valores das variáveis do template **na ordem dos placeholders** logo após os campos padrão. Formato final por linha:

```
telefone, nome, cpf, atraso, saldo, <valor {{1}}>, <valor {{2}}>, ...
```

Quando não houver mapeamento padrão (nome/cpf/etc), o formato simplifica para:

```
5516997232580, Rodrigo, 67949227000159
```

Isso mantém `varsByTel` como fonte da verdade (o backend continua usando `cliente.vars`), mas garante que o usuário **veja** os valores no campo de destinatários e confirme que cada linha tem os dados certos.

### 2. `src/pages/EnvioMeta.tsx` — `removerSemWhatsApp()`

Ao reconstruir `recipientsRaw` após remover números sem WhatsApp, hoje só reusa `[telefone, nome, cpf, atraso, saldo]` (linha 265). Vamos preservar as colunas extras (variáveis do template) usando `varsByTel[normalizeTelKey(r.telefone)]` para reanexar os valores originais, mantendo a exibição consistente.

### 3. Nada muda no envio

- `varsByTel` continua alimentando `clientesComVars` (linha 567-572).
- Backend (`envio-meta-massa-iniciar` e `send-whatsapp-meta`) já usa `cliente.vars` para renderizar `{{1}}`/`{{2}}` — sem alteração.

## Fora do escopo

- Não altero `parseRecipients` (as colunas extras são apenas visuais; `parseRecipients` já ignora colunas após a 5ª).
- Não altero migrations, edge functions nem `EnvioMetaSendingContext`.
- O comportamento de limpar `varsByTel` quando o usuário edita o textarea manualmente permanece igual (evita descasamento).

## Resultado

Após importar a planilha do print:
- Destinatários mostrará `5516997232580, Rodrigo, 67949227000159` em vez de só `5516997232580`.
- O envio real renderiza `Olá *Rodrigo*! O CNPJ 67949227000159 foi validado…` como esperado.
