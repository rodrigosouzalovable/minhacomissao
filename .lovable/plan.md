

## Plano: Configuração de tempo e tipo de envio no dialog de lembretes

### O que será feito

Adicionar ao dialog de Lembretes (`PaymentReminders.tsx`):
1. Dois campos numéricos para configurar o intervalo de delay randomizado (mínimo e máximo em minutos)
2. Um seletor de tipo de envio: "Mensagem de texto" ou "Áudio"
3. Um botão "Iniciar Envio" que muda para "Cancelar Envio" quando ativo
4. Envio na ordem de cima para baixo, pulando itens já marcados como "Enviado"

### Arquivos afetados

**1. `src/components/PaymentReminders.tsx`**
- Adicionar estados `minDelay` e `maxDelay` (em minutos, padrão 5 e 15) com inputs numéricos
- Adicionar estado `tipoEnvio`: `'texto' | 'audio'`
- Renderizar os campos dentro do bloco `border rounded-lg p-3 bg-muted/30` existente, abaixo do seletor de instâncias
- Substituir o botão "Enviar" atual pelo botão "Iniciar Envio" / "Cancelar Envio"
- Modificar `handleStartEnvios` para passar `minDelay`, `maxDelay` e `tipoEnvio` ao contexto
- Quando `tipoEnvio === 'audio'`, o envio usará a edge function `send-whatsapp-audio` com o `audio_url` do template correspondente ao tipo do lembrete

**2. `src/contexts/WhatsAppSendingContext.tsx`**
- Alterar a assinatura de `startSending` para aceitar `options: { minDelayMin: number, maxDelayMin: number, tipoEnvio: 'texto' | 'audio' }`
- Usar `minDelayMin` e `maxDelayMin` no cálculo do delay entre mensagens (em vez do hardcoded 5-15 min)
- Quando `tipoEnvio === 'audio'`:
  - Buscar o `audio_url` do template correspondente
  - Se tiver áudio, chamar `send-whatsapp-audio`; se não tiver, fazer fallback para texto
- Alterar a interface `LembreteTemplate` para incluir `audio_url?: string | null`

### Detalhes da UI

No bloco WhatsApp do dialog, abaixo dos chips de instância:

```text
┌─────────────────────────────────────────────┐
│ WhatsApp                  [Iniciar Envio]   │
│ [chip inst1] [chip inst2]                   │
│                                             │
│ Tipo de envio:  (●) Texto  ( ) Áudio        │
│ Intervalo:  Min [5] min   Max [15] min      │
└─────────────────────────────────────────────┘
```

- O botão muda para "Cancelar Envio" (vermelho) quando o envio está ativo
- Os campos ficam desabilitados durante o envio
- Os inputs de delay são do tipo number com min=1

### Lógica de envio

- Filtra `allPendingReminders` na ordem existente (hoje > vencidos > 3 dias)
- Pula itens com status `enviado` (verifica via `getWhatsAppStatus`)
- Para cada item pendente, usa round-robin nas instâncias selecionadas
- Se tipo = áudio e não houver áudio configurado para aquele tipo de lembrete, faz fallback para texto e mostra toast informando

