## Objetivo

No WhatsApp Inbox, impedir que o usuário troque para outra conversa enquanto houver mensagens em envio (status "enviando" / relógio) ou enquanto o `ChatInputBar` estiver ocupado (gravando áudio, enviando mídia, transcrevendo, enviando atalho).

Hoje a regra é o oposto: o comentário em `WhatsAppInbox.tsx` (linha 761) diz explicitamente que envio otimista **não** bloqueia troca. Vamos inverter esse comportamento.

## Sinais de "envio em andamento" (já existem)

- `hasPendingMessages` (linha 764): mensagens com `id` começando em `temp-` e `status_envio === 'enviando'` — relógio do otimista, ainda sem confirmação da UAZAPI.
- `inputBusy` (linha 120, alimentado por `onBusyChange` do `ChatInputBar`): cobre upload de mídia, gravação/envio de áudio, transcrição e envio de atalhos.

Definir um único booleano derivado:

```ts
const envioEmAndamento = hasPendingMessages || inputBusy;
```

## Mudanças

### 1. `src/pages/WhatsAppInbox.tsx`

**a) `handleSelectContato`** — bloquear a troca quando houver envio em andamento:

```ts
const handleSelectContato = (contato: Contato) => {
  if (contato.id === contatoAtivo?.id) return;
  if (envioEmAndamento) {
    toast({
      title: 'Aguarde o envio terminar',
      description: 'Termine de enviar a mensagem atual antes de trocar de conversa.',
    });
    return;
  }
  setContatoAtivo(contato);
  setMensagens([]);
  setPaginaAtual(0);
  setTemMaisAnteriores(true);
  setRespondendoMsg(null);
};
```

**b) Bloquear seleção múltipla / limpar conversa ativa** durante envio:
- Botão "voltar" no header mobile (linha 1435 — `setContatoAtivo(null)`): também checar `envioEmAndamento`.
- Botão de filtro de etiqueta que pode esconder a conversa atual: manter livre (não fecha o chat ativo).

**c) Feedback visual na lista de contatos** (linha ~1351): quando `envioEmAndamento` for `true` e o contato do botão **não** for o ativo, aplicar:
- `disabled` no `<button>`,
- classes `opacity-60 cursor-not-allowed`,
- `title="Aguarde o envio terminar"`.

O contato ativo continua clicável (sem efeito).

### 2. Remover comentário antigo enganoso (linhas 761–763)

Trocar por:
```ts
// Bloqueia troca de conversa enquanto há mensagem em envio (relógio) ou
// o input está ocupado (mídia, áudio, transcrição, atalho).
```

## Não muda

- `ChatInputBar.tsx`: já reporta `onBusyChange` corretamente — nada a alterar.
- Atualização de `status_envio` para `enviado`/`erro` continua liberando o `hasPendingMessages` automaticamente, destravando a troca assim que o WhatsApp confirma.
- Mensagens com erro (`status_envio === 'erro'`) **não** bloqueiam — usuário pode trocar de conversa e tentar de novo depois.

## Resultado

- Clicou em enviar → relógio aparece → lista de conversas fica esmaecida → ao confirmar (check), pode trocar.
- Gravando áudio ou subindo PDF → idem, lista travada até finalizar.
- Já enviado (✓) ou erro → troca livre, como hoje.
