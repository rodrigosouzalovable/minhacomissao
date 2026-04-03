

## Contador de mensagens enviadas nos lembretes

### Resumo
Adicionar um contador de mensagens enviadas (cards com tag "Enviado") ao lado direito do título de cada seção ("Vence hoje", "Parcelas Vencidas", "Vence em 3 dias"), aproveitando o `enviadosCount` já calculado no componente.

### Alterações

**Arquivo: `src/components/PaymentReminders.tsx`**

1. Calcular contadores de enviados por categoria (hoje, vencidos, 3 dias) usando `getWhatsAppStatus`
2. Nos headers de seção (linhas ~445, ~464, ~483), adicionar ao lado direito um badge verde com ícone Send e a contagem de enviados daquela categoria
3. O badge só aparece quando a contagem for > 0

### Detalhes técnicos

- Criar 3 variáveis derivadas:
  - `enviadosHoje` = count de `lembretesHoje` com status `enviado`
  - `enviadosVencidos` = count de `lembretesVencidos` com status `enviado`
  - `enviadosTresDias` = count de `lembretesTresDias` com status `enviado`
- Nos `<h4>` de cada seção, adicionar um `<span>` com `ml-auto` contendo um Badge verde com o total de enviados
- Estilo: Badge com `bg-emerald-600` e ícone `Send`, similar ao badge "Enviado" dos cards

