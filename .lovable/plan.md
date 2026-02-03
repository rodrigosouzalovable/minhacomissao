
## Plano: Adicionar Botão Copiar ao Lado do Nome do Cliente

### Objetivo
Adicionar um botão de copiar ao lado do nome de cada cliente em todas as páginas onde o nome é exibido, permitindo que o usuário copie o nome rapidamente para a área de transferência.

---

### Análise dos Locais Afetados

Após análise do código, identifiquei os seguintes locais onde o nome do cliente é exibido e precisa do botão de copiar:

| Arquivo | Local | Linha Aprox. |
|---------|-------|--------------|
| `src/pages/Acordos.tsx` | Card de acordo (AcordoCard) | L59 |
| `src/pages/AcordoDetalhe.tsx` | Cabeçalho da página (h1) | L468 |
| `src/pages/Retornos.tsx` | Card de retorno | L850 |
| `src/pages/EquipeAcordos.tsx` | Card de acordo da equipe | L652 |
| `src/pages/Comissoes.tsx` | Accordion de acordo | L315 |
| `src/pages/UsuarioComissoes.tsx` | Accordion de acordo | L441 |
| `src/components/PaymentReminders.tsx` | Lembrete de pagamento | L63 e L106 |

---

### Modificação Necessária no CopyButton

O componente `CopyButton` atual remove caracteres não-numéricos (`.replace(/\D/g, '')`), o que é ideal para CPF/telefone mas **não funciona para nomes**. 

Preciso criar uma prop opcional para desabilitar essa limpeza ou usar o valor diretamente quando for nome:

**Alteração em `src/components/CopyButton.tsx`:**
- Adicionar prop `preserveText?: boolean` para manter o texto original
- Quando `preserveText` for `true`, copiar o valor sem modificação

---

### Mudanças Detalhadas

#### 1. `src/components/CopyButton.tsx`
Adicionar prop `preserveText` para permitir cópia de texto sem limpeza:

```typescript
interface CopyButtonProps {
  value: string;
  label?: string;
  preserveText?: boolean; // Nova prop
}

// Na função handleCopy:
const textToCopy = preserveText ? value : value.replace(/\D/g, '');
await navigator.clipboard.writeText(textToCopy);
```

#### 2. `src/pages/Acordos.tsx` (linha ~59)
Adicionar CopyButton ao lado do nome no AcordoCard:
```tsx
<h3 className="font-semibold flex items-center gap-1">
  {acordo.cliente_nome}
  <CopyButton value={acordo.cliente_nome} label="Nome" preserveText />
</h3>
```

#### 3. `src/pages/AcordoDetalhe.tsx` (linha ~468)
Adicionar CopyButton ao lado do título h1:
```tsx
<h1 className="text-2xl font-bold flex items-center gap-2">
  {acordo.cliente_nome}
  <CopyButton value={acordo.cliente_nome} label="Nome" preserveText />
</h1>
```

#### 4. `src/pages/Retornos.tsx` (linha ~850)
Adicionar CopyButton ao lado do nome no card de retorno:
```tsx
<span className="font-semibold flex items-center gap-1">
  {retorno.cliente_nome}
  <CopyButton value={retorno.cliente_nome} label="Nome" preserveText />
</span>
```

#### 5. `src/pages/EquipeAcordos.tsx` (linha ~652)
Adicionar CopyButton ao lado do nome no card de acordo da equipe:
```tsx
<h3 className="font-semibold flex items-center gap-1">
  {acordo.cliente_nome}
  <CopyButton value={acordo.cliente_nome} label="Nome" preserveText />
</h3>
```

#### 6. `src/pages/Comissoes.tsx` (linha ~315)
Adicionar CopyButton ao lado do nome no accordion:
```tsx
<span className="font-semibold flex items-center gap-1">
  {acordo.cliente_nome}
  <CopyButton value={acordo.cliente_nome} label="Nome" preserveText />
</span>
```

#### 7. `src/pages/UsuarioComissoes.tsx` (linha ~441)
Adicionar CopyButton ao lado do nome no accordion:
```tsx
<span className="font-medium flex items-center gap-1">
  {acordo.cliente_nome}
  <CopyButton value={acordo.cliente_nome} label="Nome" preserveText />
</span>
```

#### 8. `src/components/PaymentReminders.tsx` (linhas ~63 e ~106)
Adicionar CopyButton ao lado do nome nos lembretes:
```tsx
<span className="font-medium text-foreground text-sm block truncate flex items-center gap-1">
  {lembrete.cliente_nome}
  <CopyButton value={lembrete.cliente_nome} label="Nome" preserveText />
</span>
```

---

### Resumo das Alterações

| Arquivo | Ação |
|---------|------|
| `src/components/CopyButton.tsx` | Adicionar prop `preserveText` |
| `src/pages/Acordos.tsx` | Adicionar CopyButton ao nome |
| `src/pages/AcordoDetalhe.tsx` | Adicionar CopyButton ao nome |
| `src/pages/Retornos.tsx` | Adicionar CopyButton ao nome |
| `src/pages/EquipeAcordos.tsx` | Adicionar CopyButton ao nome |
| `src/pages/Comissoes.tsx` | Adicionar CopyButton ao nome |
| `src/pages/UsuarioComissoes.tsx` | Adicionar CopyButton ao nome |
| `src/components/PaymentReminders.tsx` | Adicionar CopyButton ao nome (2 locais) |

---

### Comportamento Esperado
- Ao clicar no botão de copiar ao lado do nome, o nome completo do cliente será copiado para a área de transferência
- Aparecerá um toast "Nome copiado!"
- O ícone mudará para um check verde por 2 segundos
- O clique não acionará navegação ou outros eventos (já tem `stopPropagation`)
