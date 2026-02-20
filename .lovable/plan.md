

## Ajustar formatacao do Word para ficar identico ao modelo

### Resumo

O documento Word modelo nao possui logo no cabecalho nem rodape repetido em todas as paginas. O conteudo comeca diretamente com o texto do credor. Ajustar a funcao `handleDownloadNotifWord` para remover esses elementos e ajustar espaçamento dos bullets.

### Alteracoes em `src/pages/DevedorDetalhe.tsx`

**1. Remover logo do cabecalho Word (linhas 546-551)**

Remover o bloco `<div style="mso-element:header">` que insere o logo no topo, ou deixar o header vazio. O documento deve comecar direto com o texto do credor.

Substituir:
```html
<div style="mso-element:header" id="h1">
<p align="center" style="margin:0;padding:0;">
${logoBase64 ? `<img src="${logoBase64}" ...>` : ''}
</p>
<p style="margin:0;">&nbsp;</p>
</div>
```
Por um header vazio:
```html
<div style="mso-element:header" id="h1">
<p style="margin:0;">&nbsp;</p>
</div>
```

**2. Remover rodape repetido (linhas 555-560)**

Remover o bloco `<div style="mso-element:footer">` com endereco, telefone e email. O documento modelo nao tem rodape em todas as paginas.

Substituir por footer vazio:
```html
<div style="mso-element:footer" id="f1">
<p style="margin:0;">&nbsp;</p>
</div>
```

**3. Aumentar espacamento entre bullets (linha 451)**

Ajustar o margin dos bullets de `2pt` para `8pt` para dar mais espaco entre cada item, como no modelo:

```html
<table ... style="margin:8pt 0 8pt 36pt;">
```

**4. Remover chamada `getLogoBase64` (linha 416)**

Como o logo nao sera mais usado no Word, remover a chamada `await getLogoBase64()` no inicio da funcao (a funcao `getLogoBase64` em si sera mantida caso seja usada em outro lugar).

### Secao tecnica

- Arquivo modificado: `src/pages/DevedorDetalhe.tsx`
- Sem novas dependencias
- A funcao `getLogoBase64` sera mantida no codigo (pode ser util futuramente)
- O texto editavel no textarea nao e afetado

