

## Melhorar layout dos eventos na ficha do cliente

### Arquivo: `src/pages/DevedorDetalhe.tsx`

### Problemas atuais
- Badge de tipo, data/hora e botao de menu ficam apertados numa unica linha
- Nomes de arquivos longos ultrapassam os limites do card
- Espacamento entre elementos inconsistente

### Alteracoes

**1. Reorganizar o cabecalho de cada evento**
- Primeira linha: Badge de tipo (esquerda) + botao de menu (direita)
- Segunda linha: Data/hora em texto pequeno

**2. Truncar nomes de arquivos longos**
- Aplicar `truncate` e `max-w` no botao de download para que nomes longos sejam cortados com reticencias

**3. Melhorar espacamento geral**
- Ajustar padding e gaps entre elementos para um visual mais limpo

### Trecho resultante (cada evento):

```tsx
<div key={evt.id} className="border rounded-lg p-3 space-y-2">
  <div className="flex items-center justify-between">
    <Badge variant={...}>
      {/* icone + tipo */}
    </Badge>
    <DropdownMenu>
      {/* menu de acoes */}
    </DropdownMenu>
  </div>
  <p className="text-xs text-muted-foreground">
    {/* data e hora */}
  </p>
  {evt.descricao && <p className="text-sm">{evt.descricao}</p>}
  {evt.arquivo_url && (
    <Button variant="outline" size="sm" className="w-full justify-start truncate">
      <Download className="h-3 w-3 mr-1 shrink-0" />
      <span className="truncate">{evt.arquivo_nome}</span>
    </Button>
  )}
</div>
```

Apenas alteracoes visuais, sem mudanca de logica ou dados.
