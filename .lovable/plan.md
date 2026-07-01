## Diagnóstico

Confirmei no banco: existem **47 contatos com `nao_lido > 0`** (batendo com o "47" da bolinha vermelha da sidebar). Os dados estão corretos.

O problema é **visual**, na lista de conversas em `src/pages/InboxMeta.tsx`:

1. **Falta destaque de "não lida"**: o nome, a prévia e o horário usam sempre o mesmo peso/opacidade. No WhatsApp Inbox tradicional, conversa não lida fica em **negrito** e o horário em verde. Aqui tudo aparece igual, dando a impressão de que já foi aberta.
2. **A "bolinha verde" (badge com quantidade)** é renderizada com `<Badge>` (variant default = `bg-primary`) + override `bg-emerald-500`. Dependendo da resolução do tailwind-merge, o `bg-primary` pode vencer e o badge some no fundo azul quando a conversa está ativa (`bg-accent`), ficando praticamente invisível.
3. **Ordenação não prioriza não lidas**: hoje só `fixado` sobe. Uma conversa não lida fica misturada com as já lidas, reforçando a percepção do usuário.

## Correções (só UI, sem mexer em regra de negócio)

Arquivo: `src/pages/InboxMeta.tsx`

1. Substituir o `<Badge>` verde por um `<span>` puro com estilo inline (`bg-emerald-500 text-white rounded-full`), garantindo que sempre apareça — inclusive quando o item está selecionado — e com contraste claro. Mostrar `99+` quando `nao_lido > 99`.
2. Adicionar estilo de **não lida**:
   - Nome em `font-bold` (em vez de `font-medium`) quando `c.nao_lido > 0`.
   - Prévia da última mensagem em `text-foreground font-medium` (em vez de `text-muted-foreground`) quando não lida.
   - Horário em `text-emerald-600 font-semibold` quando não lida.
3. Ajustar o `sort` de `contatosFiltrados` para priorizar, nesta ordem: fixadas → não lidas → resto (mantendo ordem por `ultima_mensagem_em` desc dentro de cada grupo).
4. Garantir que ao abrir uma conversa (`fetchMensagens` sem `loadMore`), além de zerar no banco, o estado local `contatos` também zere aquele `nao_lido` imediatamente (hoje depende de esperar o realtime — o que dá impressão de "atraso"). Isso mantém a UI consistente sem esperar o round-trip.

## Verificação após implementar

- Recarregar `/admin/inbox-meta`: as 47 conversas não lidas devem aparecer com nome em negrito, prévia destacada, horário verde e badge verde com o número (ex.: 12, 8, 4…).
- Clicar em uma conversa: nome deve voltar a peso normal, badge some, `nao_lido` no card zera na hora.
- A bolinha vermelha da sidebar deve cair para 46 após abrir uma delas.