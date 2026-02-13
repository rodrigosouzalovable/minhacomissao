
## Plano: Corrigir formatação dos textos na seção Empréstimos

### Problema Identificado
Na seção "Empréstimos", os textos das linhas 58-61 estão quebrando de forma estranha, criando uma visual desagradável. O layout `flex items-start gap-2` com textos muito longos causa quebras inadequadas.

### Solução
Reformatar a lista de itens da seção "Empréstimos" (linhas 53-66) para:

1. Melhorar o spacing e distribuição do texto
2. Usar uma estrutura de grid ou melhor distribuição do layout flexbox
3. Garantir que palavras-chave em negrito apareçam na mesma linha que seu contexto quando possível
4. Adicionar melhor visual com padding e alinhamento

### Alterações Específicas

**Linha 53-66 (seção da lista de Empréstimos):**

Trocar de:
```tsx
<ul className="list-none pl-0 space-y-2">
  <li className="flex items-start gap-2">
    <span style={{ color: '#dc3545' }}>✕</span>
    <strong>NÃO oferecemos empréstimos</strong> ou concedemos crédito de qualquer espécie nesta plataforma;
  </li>
  <li className="flex items-start gap-2">
    <span style={{ color: '#dc3545' }}>✕</span>
    Qualquer contato dessa finalidade é <strong>ilegítimo, fraudulento</strong> e não apresenta qualquer vínculo com esta plataforma;
  </li>
  <li className="flex items-start gap-2">
    <span style={{ color: '#dc3545' }}>✕</span>
    <strong>NÃO exigimos qualquer tipo de depósito prévio</strong> ou fazemos solicitações desse tipo por meio de correspondentes ou intermediários.
  </li>
</ul>
```

Para:
```tsx
<ul className="list-none pl-0 space-y-3">
  <li className="flex gap-3 items-start">
    <span style={{ color: '#dc3545' }} className="shrink-0 font-bold text-lg">✕</span>
    <div className="pt-0.5">
      <strong>NÃO oferecemos empréstimos</strong> ou concedemos crédito de qualquer espécie nesta plataforma;
    </div>
  </li>
  <li className="flex gap-3 items-start">
    <span style={{ color: '#dc3545' }} className="shrink-0 font-bold text-lg">✕</span>
    <div className="pt-0.5">
      Qualquer contato dessa finalidade é <strong>ilegítimo, fraudulento</strong> e não apresenta qualquer vínculo com esta plataforma;
    </div>
  </li>
  <li className="flex gap-3 items-start">
    <span style={{ color: '#dc3545' }} className="shrink-0 font-bold text-lg">✕</span>
    <div className="pt-0.5">
      <strong>NÃO exigimos qualquer tipo de depósito prévio</strong> ou fazemos solicitações desse tipo por meio de correspondentes ou intermediários.
    </div>
  </li>
</ul>
```

### Mudanças Principais
1. Aumentar spacing entre itens de `space-y-2` para `space-y-3`
2. Aumentar gap entre ícone e texto de `gap-2` para `gap-3`
3. Usar `shrink-0` no ícone ✕ para evitar redimensionamento
4. Envolver o texto em uma `<div>` para melhor controle de layout
5. Adicionar `pt-0.5` (padding-top) para alinhar melhor o texto com o ícone
6. Tornar o ícone ✕ mais visível com `font-bold` e `text-lg`

### Resultado Esperado
- Textos com melhor distribuição visual
- Ícone ✕ bem alinhado com o texto
- Palavras-chave em negrito aparecem de forma mais clara
- Layout responsivo mantido
