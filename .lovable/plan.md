# Ajuste do Dialog "Configurações WhatsApp" no Acionamento

## Objetivo

Eliminar a barra de scroll horizontal e melhorar a disposição do header (badge de conectados + botões "Conectar via QR Code" / "Conectar via Código" / "Manual") para que o conteúdo respire melhor.

## Mudanças (arquivo: `src/pages/Acionamento.tsx`)

### 1. Aumentar largura do dialog (linha 2354)

Trocar:
```
<DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
```
Por:
```
<DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto overflow-x-hidden">
```

- `max-w-5xl` (1024px) + `w-[95vw]`: usa quase toda a largura da tela em desktop, eliminando aperto que força scroll horizontal nos cards de instância (badges Ativo / Conectado / Só Lembretes / Robô / IA Responde + URL longa).
- `overflow-x-hidden`: garante que nenhum elemento interno force barra horizontal.

### 2. Reorganizar header das instâncias (linhas 2360–2404)

Atualmente título + descrição ficam à esquerda e os 3 botões à direita na mesma linha (`flex items-center justify-between`), o que espreme tudo e empurra o badge "85/107 conectados" para baixo do título quebrando o layout.

Reestruturar para empilhar verticalmente em telas estreitas e alinhar de forma limpa em telas largas:

```
<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
  <div className="min-w-0">
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="text-base font-semibold">Instâncias UAZAPI</h3>
      {badge "X/Y conectados"}
    </div>
    <p className="text-sm text-muted-foreground">
      Cadastre múltiplos WhatsApps para rotação automática dos envios.
    </p>
  </div>
  <div className="flex flex-wrap gap-2 lg:shrink-0">
    {Botão Conectar via QR Code}
    {Botão Conectar via Código}
    {Botão Manual}
  </div>
</div>
```

Resultado:
- Badge "85/107 conectados" passa a ficar **na mesma linha** do título "Instâncias UAZAPI" (em vez de quebrar abaixo como na screenshot).
- Os 3 botões alinham-se à direita em desktop e quebram lado a lado em telas menores, sem comprimir o título.

## Não muda

- Lógica dos botões, fluxo de QR/Pairing, lista de instâncias, badges internas — apenas layout do container e do header.
- Dialog continua com scroll vertical normal.
