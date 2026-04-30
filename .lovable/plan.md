## Problema

Ao enviar um boleto (PDF) pelo WhatsApp Inbox, o destinatário recebe o arquivo com um nome genérico (ex: `1730412345.pdf`) em vez do nome original (ex: `Boleto_Joao_Silva.pdf`).

## Causa

Na edge function `send-whatsapp-media`, o campo `file_name` é recebido do frontend mas **nunca é enviado para a UAZAPI**. O body atual contém apenas:

```ts
const body = { number: telefoneCompleto, type, file: media_url };
```

Sem o campo `docName`, a UAZAPI usa o nome derivado da URL pública do Storage — que é o timestamp gerado no upload (`${Date.now()}.${ext}`).

## Solução

### 1. `supabase/functions/send-whatsapp-media/index.ts`
Adicionar `docName` ao body enviado para a UAZAPI quando o tipo for `document`:

```ts
const body: Record<string, unknown> = { number: telefoneCompleto, type, file: media_url };
if (type === 'document' && file_name) {
  body.docName = file_name;
}
```

### 2. `src/components/inbox/ChatInputBar.tsx` (opcional, melhoria)
Manter o nome original também no Storage para que, mesmo sem `docName`, a URL pública preserve o nome. Trocar:

```ts
const fileName = `${instanciaId}/${telefone}/${Date.now()}.${ext}`;
```

Por um path que mantenha o nome original (sanitizado) com timestamp como prefixo de pasta para evitar colisões:

```ts
const safeName = file.name.replace(/[^\w.\-]+/g, '_');
const fileName = `${instanciaId}/${telefone}/${Date.now()}/${safeName}`;
```

Isso é defensivo — o passo 1 sozinho já resolve o problema relatado.

## Resultado esperado

O boleto enviado pelo Inbox chega no WhatsApp do destinatário com o mesmo nome do arquivo original (ex: `Boleto_Joao_Silva.pdf`), igual ao comportamento do WhatsApp normal.
