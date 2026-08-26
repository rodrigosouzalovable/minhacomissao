# Notificação de ponto + lembretes flutuantes + revisão do aviso de inatividade

## 1. Notificação no seu WhatsApp a cada batida

Toda vez que um funcionário registrar qualquer uma das 4 marcações (entrada, saída para almoço, volta do almoço, saída), você recebe na hora uma mensagem no WhatsApp:

```text
PONTO REGISTRADO
Gabriela Borges
Saída para almoço
26/08/2026 às 12:03 (BRT)
Rede: 189.x.x.x
```

- Enviada para 62991672674 (mesmo número já usado nos alertas de ponto).
- Não bloqueia a batida: se o WhatsApp falhar, o ponto continua registrado normalmente.
- Sem custo novo de cron: o envio acontece dentro do próprio registro do ponto.

## 2. Botão flutuante de lembrete

Aparece flutuando no canto da tela (para quem tem "Precisa bater ponto" ligado), com o nome da marcação pendente e ação direta de bater o ponto:

- A partir das 11:00 BRT: lembra de bater a **Saída para almoço** (só se ainda não foi batida).
- A partir das 16:30 BRT: lembra de bater a **Saída** (só se ainda não foi batida).
- Some assim que a marcação é registrada; pode ser dispensado por 30 minutos ("Depois") e volta a aparecer.
- Não aparece para admin/gestor, nem em domingo, nem depois do dia encerrado.
- Se a entrada ainda não foi batida, o bloqueio atual do sistema continua valendo (não muda nada ali).

## 3. Aviso flutuante de inatividade (10 min) — revisão

O recurso existe e está ligado no layout global, mas há pontos que o deixam impreciso e serão corrigidos:

- Ele aparece hoje para **qualquer** usuário não-admin, inclusive gestores e quem não é obrigado a bater ponto. Passa a aparecer só para quem tem "Precisa bater ponto" ligado.
- Com a aba em segundo plano, o sistema conta inatividade e grava no banco mesmo sem o usuário estar olhando. Passa a pausar a contagem com a aba oculta (e retomar ao voltar), evitando janelas falsas de inatividade e escrita desnecessária.
- O cronômetro será validado na prática (navegador automatizado) para confirmar que o card aparece após o limite e desaparece ao primeiro movimento.

Enquanto valido, se quiser eu reduzo temporariamente o limite para testar mais rápido e devolvo para 10 minutos.

## Detalhes técnicos

- `supabase/functions/ponto-registrar/index.ts`: após o insert, buscar `profiles.nome` e chamar `notificarNumeros` (tipo `ponto_batida`, chave de idempotência `ponto:{user_id}:{data}:{tipo}`) dentro de try/catch.
- Novo `src/components/ponto/PontoLembreteFlutuante.tsx`: usa `usePonto` + `useUserPermissions` + `useUserRole`; calcula hora BRT com `Intl`; regras 11:00 → `saida_almoco`, 16:30 → `saida`; snooze em `sessionStorage`; reaproveita `bater.mutate` e os textos de erro do `PontoCard`.
- `src/components/layout/AppLayout.tsx`: renderizar o novo componente ao lado de `InatividadeFlutuante` (posicionar acima para não sobrepor).
- `src/components/ponto/InatividadeFlutuante.tsx`: condicionar a `batePonto` e a `!isAdmin && !isGestor`.
- `src/hooks/useAtividadeMonitor.tsx`: congelar a contagem quando `document.visibilityState !== 'visible'` (não acumular tempo oculto, não enviar heartbeat `inativo`).
- Sem migração de banco.
