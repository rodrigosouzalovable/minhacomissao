Diagnóstico: a página `Envio Meta (massa)` (`src/pages/EnvioMeta.tsx`) renderiza seu conteúdo direto em uma `<div>` sem o wrapper `<AppLayout>`, por isso a aba lateral desaparece.

Plano de correção:

1. Importar `AppLayout` no `src/pages/EnvioMeta.tsx`.
2. Adicionar estado de carregamento envolto em `<AppLayout>` (padrão das outras páginas).
3. Envolver o conteúdo principal em `<AppLayout>`.
4. Ajustar o wrapper externo para remover o `p-6` redundante, já que `AppLayout` já aplica padding no conteúdo (`p-6` no `main`). Manter `max-w-6xl mx-auto space-y-6` para manter a centralização e o espaçamento.

Arquivos alterados:
- `src/pages/EnvioMeta.tsx`

Nenhuma mudança de backend, rota ou banco de dados é necessária.