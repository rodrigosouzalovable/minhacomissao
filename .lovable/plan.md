## Problema

Na aba **Colar imagem**, o campo "Mensagem gerada" não reflete o desconto salvo em **Editar Modelo** por dois motivos confirmados no código:

1. **`ColarImagemTab` está fixo em "Mensagem 2"** (`ModeloMensagem.tsx` linhas 681-686 passam `template2`, `descVistaGlobal2`, `descParceladoGlobal2`, `parceladoQtdGlobal2`). Se o usuário edita e salva a aba **Mensagem 1** do diálogo (a que abre por padrão), o Colar imagem continua usando os valores da Mensagem 2 e nada muda.
2. **Descontos não são recarregados do banco.** A hidratação do template (`ModeloMensagem.tsx` linhas 201-216) lê apenas `template` e `template_2`, ignorando `desconto_padrao*`, `desconto_parcelado_padrao*` e `parcelas_padrao*`. Ao recarregar a página, os descontos voltam para os defaults (50 / 30 / 12), sobrescrevendo o que foi salvo.

## Correção

### 1. `src/pages/ModeloMensagem.tsx` — hidratar descontos salvos
No `useEffect` que lê `modelo_mensagem_template`, aplicar também:
- `desconto_padrao` → `setDescVistaGlobal`
- `desconto_parcelado_padrao` → `setDescParceladoGlobal`
- `parcelas_padrao` → `setParceladoQtdGlobal`
- `desconto_padrao_2` → `setDescVistaGlobal2`
- `desconto_parcelado_padrao_2` → `setDescParceladoGlobal2`
- `parcelas_padrao_2` → `setParceladoQtdGlobal2`

Assim os valores editados persistem após refresh.

### 2. `ColarImagemTab` — refletir o modelo escolhido
Alterar a chamada no `TabsContent value="imagem"` para passar os dois conjuntos (Mensagem 1 e Mensagem 2), e adicionar um seletor **"Modelo 1 / Modelo 2"** no topo do `ColarImagemTab.tsx`. A `useMemo` da mensagem passa a usar o par correspondente ao modelo selecionado (padrão: Modelo 1, que é o que aparece primeiro no diálogo Editar Modelo).

Isso garante que:
- Editando os descontos da Mensagem 1 e salvando, o Colar imagem já usa esses valores (padrão).
- O usuário pode alternar para Modelo 2 caso queira testar o outro template.
- Como `useMemo` já depende de `descVistaGlobal`/`descParceladoGlobal`/`parceladoQtdGlobal`/`template`, a atualização é automática assim que `onSaved1`/`onSaved2` propaga o novo estado.

### Fora de escopo
Nenhuma mudança em `EditarTemplateMensagemDialog.tsx`, `renderMensagem` ou schema — o salvamento já grava tudo corretamente; só faltava ler de volta e conectar ao Colar imagem.