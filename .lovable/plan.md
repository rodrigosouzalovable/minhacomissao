## Resumo
Na aba **Modelo Mensagem**, remover a pré-visualização do texto das mensagens na lista de clientes, mantendo apenas os botões **"Mensagem 1"** e **"Mensagem 2"**.

## Alteração
**Arquivo:** `src/pages/ModeloMensagem.tsx`

Na coluna **Mensagens** da tabela de clientes (linhas ~631–659):
- Remover os dois blocos `<div className="text-xs whitespace-pre-wrap line-clamp-3 ...">` que exibem o conteúdo de `msg1` e `msg2`.
- Manter os dois botões **"Mensagem 1"** e **"Mensagem 2"** com o comportamento de cópia ao clicar.
- Simplificar o layout da célula para que os botões fiquem um abaixo do outro sem o texto lateral.

**Antes:**
```
[Mensagem 1]  [botão Mensagem 1]
---
[Mensagem 2]  [botão Mensagem 2]
```

**Depois:**
```
[botão Mensagem 1]
[botão Mensagem 2]
```

Nenhuma outra funcionalidade é alterada — apenas a remoção da pré-visualização do texto na tabela.