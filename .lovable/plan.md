## Objetivo

Quando estiver enviando mensagens em massa em **Acionamento** e **Campanhas de Voz**, exibir no painel/toggle do canto inferior direito **qual será a próxima instância (número de WhatsApp)** que enviará para o próximo cliente da fila — além do que já é mostrado hoje (último enviado, próximo countdown, etc).

## O que existe hoje

- **Campanhas de Voz**: já tem painel flutuante no canto inferior direito (`fixed bottom-4 right-4`) mostrando: último contato enviado, último número usado e countdown. Falta: próxima instância.
- **Acionamento**: hoje só mostra "Enviando X/Y..." inline no topo da lista, sem painel flutuante e sem informação de instância. Vou criar um painel flutuante igual ao de Campanhas de Voz, e incluir já a próxima instância.

Ambos usam **round-robin** sobre a lista de instâncias ativas (`instances[i % instances.length]`), então a "próxima instância" é determinística e fácil de calcular.

## Mudanças

### 1. Campanhas de Voz — `src/contexts/VoiceCampaignSendingContext.tsx`

- Adicionar campos no `SendingProgress`:
  - `nextInstance: string | null` — nome da próxima instância (ex.: "Robô 02")
  - `nextContact: string | null` — nome/telefone do próximo contato (bônus de contexto)
- Após cada envio, calcular o próximo a partir do índice `i+1`, da lista `instances` e `pendingContacts`, e atualizar o estado.
- Limpar (`null`) quando for o último contato ou ao cancelar.

### 2. Campanhas de Voz — `src/pages/CampanhasVoz.tsx` (painel flutuante já existente)

Adicionar uma linha logo abaixo do bloco "Pelo número …":

```
➡️ Próxima: <nome do próximo contato> pelo número <próxima instância>
```

Exibida só quando `nextInstance` não for nulo (ou seja, ainda há próximo).

### 3. Acionamento — `src/hooks/useAutoSend.tsx`

Hoje o contexto só expõe `{ current, total }`. Vou estender:

- Mudar `AutoSendProgress` para incluir:
  - `currentInstance: string | null`
  - `currentContact: string | null`
  - `lastSentInstance: string | null`
  - `lastSentContact: string | null`
  - `nextInstance: string | null`
  - `nextContact: string | null`
  - `countdownSec: number | null`
- No loop de `startAutoSend`:
  - Antes de enviar, atualizar `currentInstance` / `currentContact`.
  - Após cada envio, atualizar `lastSentInstance` / `lastSentContact`.
  - Calcular `nextInstance` / `nextContact` usando `pendentesSnapshot[i+1]` e o mesmo `roundRobinCounterRef.current` que o próximo iteração usaria (sobre `activeConfigs`).
  - Iniciar countdown em segundos durante o `setTimeout` do delay (igual ao de Campanhas de Voz).

### 4. Acionamento — `src/pages/Acionamento.tsx`

Adicionar um painel flutuante no canto inferior direito (mesmo padrão visual de `CampanhasVoz.tsx`), exibido só quando `autoSending === true`:

```
[spinner] Acionamento em andamento     [X/Y]
✅ Enviado para <nome>  pelo número <instância>
⏳ Próximo envio em Ns
➡️ Próxima: <próximo nome> pelo número <próxima instância>
[Parar]
```

O botão "Parar" duplica a função do botão inline já existente, para conveniência.

## Detalhes técnicos

- **Cálculo da próxima instância (Acionamento)**: `activeConfigs[(roundRobinCounterRef.current) % activeConfigs.length]` — o `roundRobinCounterRef` já é incrementado após o envio atual, então no momento de calcular o "próximo", basta usá-lo direto, sem `+1`. Filtrando antes pelas instâncias ainda ativas (mesma lógica do loop).
- **Cálculo da próxima instância (Voz)**: como o índice `i+1` é determinístico, basta `instances[(i+1) % instances.length].nome`.
- **Label da instância**: usar `instance.nome ?? instance.id.slice(0,8)` (mesmo padrão já usado nos arquivos).
- **Sem custo extra** de Cloud (apenas estado em memória + render).
- Sem mudanças em banco, edge functions, RLS ou triggers.

## Arquivos modificados

1. `src/contexts/VoiceCampaignSendingContext.tsx`
2. `src/pages/CampanhasVoz.tsx` (apenas o painel flutuante linhas ~1086–1122)
3. `src/hooks/useAutoSend.tsx`
4. `src/pages/Acionamento.tsx` (adicionar painel flutuante novo no fim do JSX)

Posso prosseguir com a implementação?