

## Plano: Impedir Navegação ao Clicar no Botão de Copiar

### Problema Identificado
O componente `CopyButton` está dentro de um `<Link>` que envolve todo o card. Quando o usuário clica no botão de copiar CPF ou Telefone, o evento de clique propaga para o `<Link>` pai, abrindo a ficha do cliente.

### Solução
Adicionar `e.stopPropagation()` e `e.preventDefault()` no handler de clique do `CopyButton` para impedir a propagação do evento, igual ao que já é feito nos botões de WhatsApp e Excluir.

---

### Alteração em `src/components/CopyButton.tsx`

**Situação Atual (linha 14-20):**
```typescript
const handleCopy = async () => {
  if (!value) return;
  await navigator.clipboard.writeText(value.replace(/\D/g, ''));
  setCopied(true);
  toast.success(`${label || 'Texto'} copiado!`);
  setTimeout(() => setCopied(false), 2000);
};
```

**Nova Implementação:**
```typescript
const handleCopy = async (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  if (!value) return;
  await navigator.clipboard.writeText(value.replace(/\D/g, ''));
  setCopied(true);
  toast.success(`${label || 'Texto'} copiado!`);
  setTimeout(() => setCopied(false), 2000);
};
```

---

### Resumo

| Arquivo | Alteração |
|---------|-----------|
| `src/components/CopyButton.tsx` | Adicionar parâmetro de evento e chamar `stopPropagation()` + `preventDefault()` |

---

### Seção Técnica

**Por que essa solução funciona:**
- `e.stopPropagation()`: Impede que o evento de clique "suba" para o elemento pai (`<Link>`)
- `e.preventDefault()`: Previne o comportamento padrão do evento (navegação)

**Padrão existente no código:**
Os botões de WhatsApp e Excluir já usam essa mesma abordagem (linhas 109-112 e 116-119 do `Acordos.tsx`):
```typescript
onClick={e => {
  e.preventDefault();
  e.stopPropagation();
  // ação aqui
}}
```

