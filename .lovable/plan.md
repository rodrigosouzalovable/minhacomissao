## Parte 1 — Som de notificação por atendente etiquetado (global)

Sempre que chegar uma mensagem recebida no Inbox Meta cujo contato esteja com a etiqueta `Atendente: <nome do usuário logado>`, toca um som suave — **em qualquer tela** do sistema (Dashboard, Acordos, etc.), não só no Inbox Meta.

### Como

- **Novo componente headless:** `src/components/MetaAtendenteNotifier.tsx`
  - Roda para qualquer usuário logado que tenha uma etiqueta `Atendente: <nome>` correspondente.
  - Ao montar:
    1. Lê `profiles.nome` do usuário atual.
    2. Busca em `meta_whatsapp_etiquetas` a etiqueta com `nome ILIKE 'Atendente: <nome>'`. Guarda `etiqueta_id`. Se não achar, sai silencioso.
  - Assina Realtime em `meta_whatsapp_mensagens` (`event: INSERT`, `filter: direcao=eq.recebida`).
  - Para cada nova mensagem:
    - Consulta `meta_whatsapp_contato_etiquetas` pelo `contato_id`; se contém o `etiqueta_id` do atendente, toca `success-sound.mp3` em volume 0.35.
    - Debounce de 2s por `contato_id` para não tocar em rajadas.
  - Cleanup: `supabase.removeChannel` no unmount.

- **Montagem global:** em `src/components/layout/AppLayout.tsx`, adicionar `<MetaAtendenteNotifier />` ao lado de `<RetornoAlertChecker />`. Assim toca em qualquer rota autenticada.

- Sem migração, sem edge function. As policies compartilhadas de leitura já cobrem os 4 atendentes.

## Parte 2 — Modo claro/escuro **apenas** no Inbox Meta Oficial

Um botão na topbar do `InboxMeta.tsx` alterna entre claro e escuro, e a preferência fica salva por usuário.

### Como

- **Escopo local à página:** o toggle aplica/remove a classe `dark` num wrapper `<div>` que envolve todo o conteúdo do `InboxMeta` (não altera o tema global do app). O Tailwind já está configurado com `darkMode: ["class"]`, então todos os tokens `dark:` do design system funcionam dentro desse wrapper.
- **Persistência:** `localStorage['inbox-meta-theme'] = 'light' | 'dark'` (chave por usuário: `inbox-meta-theme:<user.id>`).
- **UI:** um `Button` com ícone `Sun`/`Moon` (lucide-react) no header do Inbox Meta, ao lado do título "Inbox Meta Oficial".
- Verificar rapidamente que os componentes da página (`MetaComposer`, lista de conversas, bolhas de mensagem, dialogs) usam tokens semânticos (`bg-background`, `text-foreground`, `bg-card`, etc.). Onde encontrar cor hardcoded (`bg-white`, `text-black`, etc.), trocar por token — só no Inbox Meta, sem tocar em outras telas.

### Arquivos alterados

- `src/pages/InboxMeta.tsx` — wrapper com classe condicional `dark`, botão de toggle, hook de preferência.
- `src/components/inbox/meta/MetaComposer.tsx` e demais dialogs do Inbox Meta — só se houver classes hardcoded que quebrem no dark.

## Fora de escopo

- Modo escuro global do sistema (só o Inbox Meta muda).
- Notificação desktop / push nativo (só som dentro da aba do navegador aberta).
- Som diferente por atendente ou configuração de volume pelo usuário.