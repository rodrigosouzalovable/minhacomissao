

# Fix: Telefone da planilha vs telefone do WhatsApp — formato diferente

## Diagnóstico confirmado

O problema é um **descompasso de formato de telefone**:

- **Planilha**: `62982183144` → pre-hydration salva como `5562982183144` (com o 9° dígito)
- **WhatsApp ID**: `556282183144` (sem o 9° dígito)

Isso resulta em **dois registros diferentes** na tabela `chatbot_conversas`:

```text
Telefone          | Nome                         | Valor Total | À Vista
5562982183144     | Rodrigo (planilha)           | 2.500       | 1.250    ← correto, mas nunca usado
556282183144      | JOSE CARLOS (banco devedores)| 1.429,59    | 714,79   ← usado pelo chatbot
```

Quando o cliente responde "Sim", o WhatsApp envia com telefone `556282183144`. O chatbot encontra esse registro (JOSE CARLOS, R$ 1.429) em vez do registro correto (Rodrigo, R$ 2.500).

Além disso, o handler `fromMe` detectou a proposta, buscou pelo telefone na tabela `devedores`, encontrou JOSE CARLOS (que tem o mesmo CPF 01867864339) e **sobrescreveu** os dados com os valores errados do banco.

## Solução

### 1. `src/hooks/useAutoSend.tsx` — Normalizar telefone para formato WhatsApp

Na pre-hydration, gerar **ambas as variantes** do telefone (com e sem o 9° dígito) e salvar no formato correto do WhatsApp:

```typescript
// Telefone BR: +55 + DDD(2) + 9(opcional) + número(8)
// WhatsApp usa formato sem o 9° dígito para celulares
const cleanPhone = cliente.telefone.replace(/\D/g, '');
const phoneFull = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

// Gerar variante sem o 9° dígito (formato WhatsApp)
// Se tem 13 dígitos (55 + DDD + 9 + 8 dígitos), remover o 9
let phoneWhatsApp = phoneFull;
if (phoneFull.length === 13 && phoneFull[4] === '9') {
  phoneWhatsApp = phoneFull.slice(0, 4) + phoneFull.slice(5); // remove o 9
}

// Salvar no formato WhatsApp (sem o 9° dígito)
await supabase.from('chatbot_conversas').upsert({
  telefone: phoneWhatsApp, // ← usar formato WhatsApp
  etapa: 'proposta_enviada',
  dados: { ... }
});
```

### 2. `supabase/functions/whatsapp-chatbot/index.ts` — fromMe handler priorizar dados pre-hydratados

No handler `fromMe` (linha ~282), quando o devedor **não é encontrado** no banco de dados, o código atual já preserva os dados existentes. Mas quando o devedor **É encontrado** (linha ~255), ele sobrescreve tudo com dados do banco.

**Mudança**: Se já existe uma conversa pre-hydratada com `valor_total` e `nome` (vinda da planilha), **priorizar esses dados** sobre os do banco `devedores`. Isso garante que os valores da planilha (R$ 2.500) prevaleçam sobre os do banco (R$ 1.429).

```typescript
// Antes de sobrescrever com dados do banco, verificar se já existe pre-hydration
const { data: existingConv } = await supabaseFm
  .from('chatbot_conversas')
  .select('dados')
  .eq('telefone', destinoTelefone)
  .maybeSingle();

// Se pre-hydration já tem valores válidos, preservar
if (existingConv?.dados?.valor_total && existingConv?.dados?.valor_avista) {
  // Preservar dados pre-hydratados, apenas atualizar etapa e histórico
  await supabaseFm.from('chatbot_conversas').upsert({
    telefone: destinoTelefone,
    etapa: 'proposta_enviada',
    dados: { ...existingConv.dados, mensagens_historico: [...] },
    ...
  });
} else {
  // Sem pre-hydration, usar dados do banco normalmente
  // (código atual)
}
```

### Arquivos alterados
- `src/hooks/useAutoSend.tsx` — normalizar telefone removendo 9° dígito antes de salvar
- `supabase/functions/whatsapp-chatbot/index.ts` — priorizar dados pre-hydratados no fromMe handler

### Resultado esperado
Quando você enviar a mensagem para 62982183144 e o cliente responder "Sim", o chatbot vai:
1. Encontrar o registro correto em `chatbot_conversas` (telefone `556282183144`)
2. Usar os valores da planilha: saldo R$ 2.500, à vista R$ 1.250, parcelado 17x de R$ 102,94
3. Responder: "Que ótimo! Estamos com uma super oportunidade para você quitar todo débito em aberto pelo valor de R$ 1.250,00. Ou podemos parcelar para você em 17x de R$ 102,94."

