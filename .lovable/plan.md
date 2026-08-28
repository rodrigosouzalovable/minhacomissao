# Blacklist também com "Bloquear número"

Hoje o sistema só reconhece o botão/resposta "Bloquear contato" (mais algumas frases de opt-out) para colocar o número na blacklist. Vou incluir o botão/resposta "Bloquear número" com o mesmo efeito.

## O que muda

- Ao receber "bloquear número" (ou variações), o número entra automaticamente na blacklist, igual ao "bloquear contato":
  - nunca mais recebe campanhas nem lembretes;
  - aparece na aba lateral Blacklist com motivo registrado;
  - conversa recebe a etiqueta "Aguardando Humano" e o IAGO fica em silêncio para esse número.
- A regra continua respeitando a chave "Bloquear Blacklist" (se desativada, nada é gravado).

## Variações reconhecidas

"bloquear número", "bloquear numero", "bloquear meu número", "bloqueie meu número", "bloquear esse/este número", "bloquear nº", com ou sem acento, maiúsculas ou erros comuns de digitação (numer, nmr, num).

## Detalhes técnicos

- `supabase/functions/_shared/iago.ts`: ampliar `ehPedidoBloqueioContato` com padrões de "bloquear (meu/esse/este) numero" e ampliar `ehOptOut` na mesma linha, para garantir o silêncio definitivo do IAGO.
- Nenhuma mudança de banco necessária — `meta_destinatario_supressao` e a página Blacklist já tratam o motivo `blacklist: ...`.
- Redeploy das funções que importam esse módulo (`meta-whatsapp-webhook`, `iago-atendimento`) para as regras entrarem em vigor.
