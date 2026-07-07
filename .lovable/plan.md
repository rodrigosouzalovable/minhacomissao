## Objetivo

Dois ajustes no **Inbox Meta Oficial** (`/admin/inbox-meta`):

1. Padronizar o nome exibido no prefixo `*Atendente ...:*` para cada funcionário (versão curta).
2. Substituir o botão **"Mensagens rápidas"** por um botão com ícone **`+`** que abre um dialog de **Nova conversa** listando apenas os **templates de categoria UTILITY**.

---

## 1) Nome curto do atendente no prefixo

**Arquivo:** `src/pages/InboxMeta.tsx`

Hoje o `atendenteNome` recebe o valor bruto de `profiles.nome` (ex.: "Anna Flavia Leite de Morais"). Vamos criar um mapa fixo de apelidos por prefixo do nome, aplicado no `useEffect` que carrega o perfil:

```ts
const APELIDOS_ATENDENTES: { match: RegExp; nome: string }[] = [
  { match: /^anna\s*fl[aá]via/i, nome: 'Anna Flavia' },
  { match: /^fernanda/i,          nome: 'Fernanda'   },
  { match: /^wallace/i,           nome: 'Wallace'    },
  { match: /^yasmi?n/i,           nome: 'Yasmim'     },
];
```

No `useEffect` (linhas 124-131), após obter `nome`:

- Percorrer `APELIDOS_ATENDENTES` e usar o primeiro `match` que casar como `atendenteNome`.
- Se nenhum casar, fallback para o primeiro nome (`nome.split(' ')[0]`).

`formatarMensagemAtendente` continua igual — o prefixo `*Atendente ${atendenteNome}:*` passa a exibir automaticamente o apelido curto.

Nenhuma alteração no webhook, no banco ou na etiqueta de atendente (o rodízio continua usando o nome completo salvo em `meta_whatsapp_etiquetas`, que é independente do texto enviado).

---

## 2) Botão "+" para Nova conversa (só templates UTILITY)

**Arquivos:** `src/pages/InboxMeta.tsx` e `src/components/inbox/meta/MetaNovaConversaDialog.tsx`

### 2a) Substituição do botão

Em `InboxMeta.tsx` (linhas 619-621), trocar o botão "Mensagens rápidas" (`Zap` + texto) por um botão ícone `+`:

```tsx
<Button
  size="icon"
  variant="outline"
  className="h-8 w-8"
  onClick={() => setNovaConversaOpen(true)}
  title="Nova conversa"
>
  <Plus className="h-4 w-4" />
</Button>
```

- Adicionar estado `const [novaConversaOpen, setNovaConversaOpen] = useState(false)`.
- Remover o botão antigo e a importação/uso do `Zap` se não for mais usada em nenhum outro lugar do arquivo.
- **Manter** o `MetaMensagensRapidasDialog` no arquivo (ainda é aberto pelo composer via atalho `/` — vamos manter o dialog importado, só o botão do topo é removido).
  - Se o dialog não for aberto de nenhum outro lugar, também removemos a montagem dele (linha 985). Vou verificar antes de remover para não quebrar outra entrada.

### 2b) Reuso do `MetaNovaConversaDialog` filtrando UTILITY

O componente `src/components/inbox/meta/MetaNovaConversaDialog.tsx` já implementa exatamente esse fluxo: escolhe instância Meta, digita telefone, seleciona template HSM aprovado e envia via edge function `send-whatsapp-meta`.

Ajustes:

- **Filtro por categoria**: no `useEffect` que carrega templates, adicionar `.eq('categoria', 'UTILITY')` (além do `status = APPROVED` que já existe) para que o funcionário veja apenas templates de **utilidade**.
- Ajustar o placeholder do `Select` de template para "Template de utilidade" e o `DialogDescription` para explicar que só templates UTILITY podem iniciar uma nova conversa.
- Nenhuma outra mudança de lógica — o dialog já cuida do envio, aguarda 24h para janela livre etc.

### 2c) Fio no `InboxMeta`

Renderizar o dialog:

```tsx
<MetaNovaConversaDialog
  open={novaConversaOpen}
  onOpenChange={setNovaConversaOpen}
  instancias={instancias}
  defaultInstancia={filtroInstancia !== 'todas' ? filtroInstancia : undefined}
  onSent={(instancia_id, telefone) => {
    // opcional: recarregar contatos/selecionar a nova conversa
    fetchContatos?.();
  }}
/>
```

Usar a mesma função que já recarrega contatos após envio (verifico o nome real ao implementar; provavelmente `carregarContatos` ou similar).

---

## Detalhes técnicos

- Nenhuma mudança de schema, RLS ou edge function.
- O rodízio automático de etiquetas `Atendente: ...` continua igual — só o texto do prefixo muda.
- O botão "+" abre o mesmo dialog Meta oficial já usado em outras telas (`MetaNovaConversaDialog`), garantindo consistência.
- Filtragem `categoria = 'UTILITY'` é feita no SELECT do Supabase, evitando trazer marketing/authentication.

## Arquivos alterados

- `src/pages/InboxMeta.tsx` — mapa de apelidos, botão `+`, estado `novaConversaOpen`, montagem do `MetaNovaConversaDialog`, remoção do botão "Mensagens rápidas".
- `src/components/inbox/meta/MetaNovaConversaDialog.tsx` — filtro `categoria = 'UTILITY'`, textos ajustados.
