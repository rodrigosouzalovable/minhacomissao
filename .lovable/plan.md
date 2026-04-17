
User wants: when listing acordos in "Meus Acordos" and "Acordos da Equipe", flag any acordo whose CPF appears in another acordo (duplicate CPF). Show a visual indicator/badge on the client card.

Looking at Comissoes.tsx, there's already similar logic (cpfDuplicados Set + Badge "CPF duplicado"). I'll replicate that pattern.

Need to check Acordos.tsx and EquipeAcordos.tsx structure briefly to know where to inject the badge — but I have enough context. Plan is straightforward.

Scope:
- Detect duplicate CPFs across the loaded list (client-side, no extra cost).
- Show an orange badge "CPF já lançado em outro acordo" on each affected card.
- Tooltip on hover showing how many other acordos exist with that CPF (and optionally the names if different).

No DB changes. No edge function. Zero Cloud cost.
