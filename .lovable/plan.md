## Alterações em `src/pages/ModeloMensagem.tsx`

### 1. Copiar com um clique no Nome e na Mensagem
- **Nome (coluna Cliente):** envolver o texto `c.nome` em um `<span>` clicável que chama `navigator.clipboard.writeText(c.nome)` + toast "Nome copiado!". Manter `stopPropagation` para não disparar o `toggleContatado` da linha. Botão de copiar existente pode permanecer ou ser removido — proposta: manter para descoberta visual.
- **Mensagem:** o `<div>` que renderiza a prévia da mensagem passa a ser clicável e copia `msg` ao clicar (com `stopPropagation`). Botão de copiar permanece.
- **Telefone:** já funciona com 1 clique — sem mudanças.

### 2. Efeito "piscando lento" no último item clicado
- Adicionar estado `lastClicked: { cpf: string; field: 'nome' | 'telefone' | 'mensagem'; value?: string } | null`.
- Ao copiar Nome, Telefone (cada número individual) ou Mensagem, atualizar `lastClicked` com o identificador do item.
- Aplicar classe condicional `animate-pulse-slow` no elemento correspondente quando ele for o último clicado. Para telefones, usar `value` (o próprio número) para destacar somente o telefone clicado dentro da linha.
- Clicar em outro item troca o destaque (apenas um por vez, global na página).

### 3. Animação `pulse-slow` em `tailwind.config.ts`
Adicionar keyframe e animation reutilizáveis:
```
"pulse-slow": {
  "0%, 100%": { opacity: "1", backgroundColor: "transparent" },
  "50%":      { opacity: "1", backgroundColor: "hsl(var(--primary) / 0.18)" },
}
animation: { "pulse-slow": "pulse-slow 1.8s ease-in-out infinite" }
```
Aplicada como `className="... animate-pulse-slow rounded px-1"` no item ativo, dando o efeito de fundo piscando devagar para indicar o último clique.

### Escopo
- Arquivos alterados: `src/pages/ModeloMensagem.tsx`, `tailwind.config.ts`.
- Sem mudanças de backend, schema, ou lógica de negócio.
