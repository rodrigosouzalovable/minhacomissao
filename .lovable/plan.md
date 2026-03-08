

# Integrar regras ensinadas (`chatbot_regras`) e templates no chatbot do WhatsApp

## Problema
As regras ensinadas via chat (salvas na tabela `chatbot_regras`) e os templates fixos (`chatbot_templates`) **nunca são carregados** pela edge function `whatsapp-chatbot`. O admin ensina regras, elas são salvas no banco, mas o chatbot as ignora completamente.

## Solução

### 1. Carregar regras e templates no início do processamento
Após verificar que o chatbot está ativo (linha ~536), buscar:
- `chatbot_regras` ativas (`ativo = true`)
- `chatbot_templates` ativos (`ativo = true`)

### 2. Verificar regras customizadas ANTES do switch/case
Antes do fluxo principal (linha ~656), iterar pelas regras e verificar se o texto do cliente contém algum gatilho. Se sim, usar a resposta da regra como resposta e manter a etapa atual.

```typescript
// Carregar regras e templates
const { data: regrasCustomizadas } = await supabase
  .from('chatbot_regras')
  .select('gatilho, resposta')
  .eq('ativo', true);

// Verificar se alguma regra customizada se aplica
if (regrasCustomizadas && regrasCustomizadas.length > 0) {
  for (const regra of regrasCustomizadas) {
    if (textoLower.includes(regra.gatilho.toLowerCase())) {
      resposta = regra.resposta;
      await salvarEResponder(etapaAtual); // mantém etapa atual
      // retornar early
      break;
    }
  }
  if (resposta) break; // sair do processamento
}
```

### 3. Usar templates para mensagens fixas (opcional, segunda prioridade)
Onde o chatbot usa mensagens hardcoded (ex: saudação, proposta), verificar se existe um template para aquela etapa e usá-lo no lugar.

```typescript
const { data: templates } = await supabase
  .from('chatbot_templates')
  .select('etapa, template')
  .eq('ativo', true);

const templateMap = new Map(templates?.map(t => [t.etapa, t.template]) || []);

// Ao gerar resposta, verificar se há template:
// const tmpl = templateMap.get('proposta_enviada');
// if (tmpl) resposta = tmpl.replace('{nome}', primeiroNome)...;
```

### 4. Variáveis dinâmicas nos templates
Suportar placeholders como `{nome}`, `{valor_avista}`, `{valor_parcelado}`, `{max_parcelas}`, `{credor}` nos templates, substituindo pelos dados da conversa.

## Arquivo alterado
- `supabase/functions/whatsapp-chatbot/index.ts`

