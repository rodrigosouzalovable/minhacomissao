## Objetivo
Na aba "Colar imagem" da página Modelo Mensagem, a mensagem gerada após "Extrair dados" deve usar o **modelo 2** (template_2) em vez do modelo 1.

## Alteração

**Arquivo:** `src/pages/ModeloMensagem.tsx` (linha ~681)

Trocar as props passadas para `<ColarImagemTab />` para usar os valores do modelo 2:

```tsx
<ColarImagemTab
  template={template2}
  descVistaGlobal={descVistaGlobal2}
  descParceladoGlobal={descParceladoGlobal2}
  parceladoQtdGlobal={parceladoQtdGlobal2}
/>
```

Nenhuma alteração em `ColarImagemTab.tsx` — ele já é agnóstico ao template recebido via props.

## Observação
O diálogo "Editar Modelo" continua editando os dois modelos (aba Mensagem 1 e Mensagem 2). Apenas a saída da aba "Colar imagem" passa a refletir o Modelo 2.