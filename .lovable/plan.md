

## Destacar Instância "CERTIFICADORA CNPJ" no Inbox

Alteração simples em `src/pages/WhatsAppInbox.tsx` para aplicar uma cor diferenciada ao nome da instância quando ela for a "62982458447 CERTIFICADORA CNPJ".

### O que muda

1. **Na lista de contatos** (linha ~786): o `<span>` que exibe o nome da instância receberá uma classe de cor especial (ex: `text-amber-500 font-semibold`) quando o nome contiver "CERTIFICADORA" — em vez do cinza padrão `text-muted-foreground/60`.

2. **No cabeçalho do chat** (linha ~824): o trecho que exibe `· nome_instancia` também será destacado com a mesma cor quando for a instância certificadora.

### Implementação

Adicionar uma função auxiliar simples:

```typescript
const isCertificadora = (nome: string | null) => 
  nome?.toUpperCase().includes('CERTIFICADORA') ?? false;
```

E aplicar condicionalmente as classes nos dois pontos de exibição:

```tsx
// Lista de contatos
<span className={cn(
  "text-[10px] mt-0.5 block truncate",
  isCertificadora(nomeInst)
    ? "text-amber-500 font-semibold"
    : "text-muted-foreground/60"
)}>

// Cabeçalho do chat - mesmo destaque
```

### Arquivo alterado
- `src/pages/WhatsAppInbox.tsx`

Nenhuma alteração no banco de dados.

