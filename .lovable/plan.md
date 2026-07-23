# Correção do preview de imagem em Envio Meta

## Problema
Ao selecionar uma instância (ex.: MemU 23) e o template `solicitacao_de_renegociacao`, o preview mostra "Sem imagem configurada" mesmo quando outras instâncias têm a imagem cadastrada no mesmo template.

## Causa
Em `src/pages/EnvioMeta.tsx` (linha ~914), o fallback de imagem só olha para `templateGroup.rows`, que é construído a partir de `templates.filter(t => instanciaIds.includes(t.instancia_id))` (linha 425). Ou seja, só considera linhas do template nas instâncias selecionadas. Se nenhuma das selecionadas tiver `_header_image_url`, a imagem não aparece — mesmo que outra instância já tenha a mesma imagem cadastrada.

O worker `send-whatsapp-meta` já faz o fallback global corretamente; o bug é apenas visual, no preview.

## Correção
Alterar o `imageUrlOverride` do `<TemplateWhatsAppPreview>` para procurar `_header_image_url` em **todos** os `templates` que tenham o mesmo `nome_template` + `idioma` do grupo selecionado, e não apenas nas linhas filtradas por instância selecionada.

Trecho a ajustar (`src/pages/EnvioMeta.tsx` ~910-920):

```tsx
imageUrlOverride={
  templates
    .filter(t => t.nome_template === templateGroup?.nome && t.idioma === templateGroup?.idioma)
    .map((t: any) => t?.variaveis?._header_image_url)
    .find((u: any) => typeof u === 'string' && u.trim().length > 0) || undefined
}
```

Nenhuma outra mudança é necessária — o envio real já usa o fallback correto.
