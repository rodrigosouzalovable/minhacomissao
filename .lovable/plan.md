# Logo do credor no topo do Modelo Mensagem (atalho da conversa)

## O que muda

No diálogo **Modelo Mensagem** aberto pelo atalho dentro da conversa, o canto superior direito passa a exibir a logo do layout selecionado:

- Aba **Layout Novo Mundo** → logo azul `nm.`
- Aba **Layout UME** → logo `ume.`

A logo troca automaticamente ao alternar de aba, servindo como identificação visual rápida do credor.

## Como fica

```text
+---------------------------------------------------+
| Modelo Mensagem                        [ nm. ]  X |
| Cole o print, confira os dados...                 |
| [Layout Novo Mundo] [Layout UME]                  |
+---------------------------------------------------+
```

## Detalhes técnicos

- Arquivo: `src/components/modelo-mensagem/ModeloMensagemDialog.tsx`.
- Reutiliza as logos já existentes no projeto via `src/lib/credorMarcas.ts` (`logo-novo-mundo.png` e `logo-ume.png`) — nenhum asset novo é necessário.
- O `DialogHeader` vira um flex com título/descrição à esquerda e a logo à direita (altura ~40px, `object-contain`, cantos arredondados), com `alt` do nome do credor.
- A logo é derivada do estado `aba` já existente no componente; nenhuma mudança de lógica de negócio.
- Apenas o diálogo de atalho é alterado; a página `/modelo-mensagem` continua igual.
