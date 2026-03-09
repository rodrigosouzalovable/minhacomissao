

# Plano: Sistema de Confirmação e Aprendizado para Chatbot WhatsApp

## Problema Identificado

O fluxo "Human-in-the-Loop" atual tem três falhas críticas:

1. **Identificação do Admin Falhando**: 
   - Código verifica `telefone === ADMIN_NUMERO` onde `ADMIN_NUMERO = '5562991672674'`
   - Mas o `telefone` extraído pode vir como `62991672674` (sem DDI 55)
   - Resultado: mensagens do admin são tratadas como de cliente comum, gerando loop infinito

2. **Sem Etapa de Confirmação**:
   - Admin envia instrução → IA envia direto ao cliente
   - Admin quer revisar a resposta antes do envio

3. **Sem Sistema de Aprendizado**:
   - Cada situação similar requer intervenção manual repetida
   - Não há registro do conhecimento adquirido

## Solução Técnica

### 1. Corrigir Identificação do Admin

**Arquivo**: `supabase/functions/whatsapp-chatbot/index.ts`

**Linha 144**: Substituir verificação simples por normalização flexível
```typescript
// Antes:
if (telefone === ADMIN_NUMERO)

// Depois:
function isAdminNumber(tel: string): boolean {
  const normalized = tel.replace(/\D/g, '');
  return normalized === '5562991672674' || normalized === '62991672674';
}

if (isAdminNumber(telefone))
```

### 2. Implementar Fluxo de Confirmação

**Nova estrutura de dados** no `admin_pending`:
```typescript
{
  cliente_telefone: string,
  instrucao_admin: string,
  resposta_proposta: string,
  contexto: any,
  aguardando_confirmacao: boolean
}
```

**Fluxo modificado** (linhas 561-646):

1. **Admin envia instrução** → IA processa e gera proposta
2. **IA envia ao admin**: "Ok entendido, irei responder o seguinte: '...', você confirma?"
3. **IA salva** em `admin_pending` com flag `aguardando_confirmacao: true`
4. **Admin confirma** (sim/ok/confirmo) → IA envia ao cliente
5. **IA registra aprendizado** → cria nova regra em `chatbot_regras`

### 3. Sistema de Aprendizado Automático

**Após confirmação bem-sucedida**, criar registro em `chatbot_regras`:

```typescript
async function registrarAprendizado(
  mensagemCliente: string,
  respostaConfirmada: string,
  contexto: any
): Promise<void> {
  // Usar IA para extrair gatilho genérico
  const gatilho = await extrairGatilho(mensagemCliente);
  
  // Criar regra com variáveis de template
  const respostaTemplate = respostaConfirmada
    .replace(contexto.nome?.split(' ')[0] || '', '{primeiro_nome}');
  
  await supabase.from('chatbot_regras').insert({
    gatilho: gatilho,
    resposta: respostaTemplate,
    ativo: true
  });
}
```

**Função auxiliar** para extrair gatilho via IA:
```typescript
async function extrairGatilho(mensagem: string): Promise<string> {
  // Usa Gemini Flash Lite para identificar termos-chave
  // Ex: "Vou ver aqui" → "vou ver"
  // Ex: "Não sei se consigo" → "não sei se consigo"
}
```

## Fluxo Completo Exemplo

**Cenário**: Cliente diz "Vou ver aqui"

```
1. Cliente (62994300880): "Vou ver aqui"
2. IA → estado: aguardando_humano
3. IA → Admin (62991672674): "Olá Rodrigo, na mensagem enviada..."
4. Admin: "Pergunte a cliente qual data consegue realizar o pagamento"
5. IA gera: "Olá! Quando você consegue realizar o pagamento?"
6. IA → Admin: "Ok entendido, irei responder o seguinte: 'Olá! Quando você consegue realizar o pagamento?', você confirma?"
7. IA → salva admin_pending com aguardando_confirmacao=true
8. Admin: "Sim"
9. IA → Cliente: "Olá! Quando você consegue realizar o pagamento?"
10. IA → chatbot_regras: gatilho="vou ver" | resposta="Olá {primeiro_nome}! Quando você consegue..."
11. IA → Admin: "✅ Mensagem enviada e ensinamento registrado! Próxima vez que alguém disser 'vou ver', responderei automaticamente."
12. IA → remove admin_pending
```

## Alterações Necessárias

**Arquivo**: `supabase/functions/whatsapp-chatbot/index.ts`

### Seção 1: Nova função de identificação (linha ~144)
```typescript
function isAdminNumber(tel: string): boolean {
  const normalized = tel.replace(/\D/g, '');
  return normalized === '5562991672674' || normalized === '62991672674';
}
```

### Seção 2: Função extrair gatilho (linha ~250)
```typescript
async function extrairGatilho(mensagemCliente: string): Promise<string> {
  // Implementar com Gemini Flash Lite
}
```

### Seção 3: Função registrar aprendizado (linha ~230)
```typescript
async function registrarAprendizado(...) {
  // Criar regra em chatbot_regras
}
```

### Seção 4: Modificar interceptação admin (linhas 561-646)

**Lógica nova**:
```typescript
if (isAdminNumber(telefone)) {
  const pendingKey = `admin_pending_${instanceToken}`;
  const { data: pendingRecord } = await supabase
    .from('chatbot_conversas')
    .select('dados')
    .eq('telefone', pendingKey)
    .maybeSingle();

  if (pendingRecord?.dados) {
    const dados = pendingRecord.dados as any;
    
    // CASO 1: Aguardando confirmação
    if (dados.aguardando_confirmacao) {
      const confirmacoes = ['sim', 'ok', 'confirmo', 'confirmar', 'pode enviar', 'tudo certo'];
      const negacoes = ['não', 'nao', 'cancela', 'cancelar', 'espera'];
      
      if (confirmacoes.some(c => texto.toLowerCase().includes(c))) {
        // Enviar ao cliente
        await sendMessage(..., dados.resposta_proposta);
        
        // Registrar aprendizado
        await registrarAprendizado(dados.mensagem_original_cliente, dados.resposta_proposta, dados.contexto);
        
        // Desbloquear cliente
        await desblo carConversaCliente(...);
        
        // Confirmar ao admin com detalhes do aprendizado
        await sendMessage(..., ADMIN_NUMERO, 
          `✅ Mensagem enviada para ${dados.cliente_telefone}.\n\n` +
          `📚 Ensinamento registrado! Quando alguém disser algo similar a "${dados.mensagem_original_cliente}", responderei automaticamente.`
        );
        
        // Limpar pending
        await supabase.from('chatbot_conversas').delete().eq('telefone', pendingKey);
        
        return Response(...);
      }
      
      if (negacoes.some(n => texto.toLowerCase().includes(n))) {
        await sendMessage(..., ADMIN_NUMERO, '❌ Cancelado. Envie nova instrução quando quiser.');
        await supabase.from('chatbot_conversas').delete().eq('telefone', pendingKey);
        return Response(...);
      }
      
      // Resposta ambígua
      await sendMessage(..., ADMIN_NUMERO, 'Por favor responda "sim" para confirmar ou "não" para cancelar.');
      return Response(...);
    }
    
    // CASO 2: Primeira instrução do admin
    const clienteTelefone = dados.cliente_telefone;
    const contexto = dados.contexto || {};
    
    // Parse instrução
    const instrucao = parseAdminInstruction(texto);
    let respostaProposta: string;
    
    if (instrucao.literal) {
      respostaProposta = instrucao.conteudo;
    } else {
      respostaProposta = await gerarRespostaComInstrucaoAdmin(instrucao.conteudo, contexto);
    }
    
    // Enviar proposta ao admin para confirmação
    await sendMessage(..., ADMIN_NUMERO,
      `Ok entendido, irei responder o seguinte:\n\n` +
      `"${respostaProposta}"\n\n` +
      `Você confirma?`
    );
    
    // Atualizar pending com resposta proposta
    await supabase.from('chatbot_conversas').upsert({
      telefone: pendingKey,
      etapa: 'admin_pending',
      dados: {
        ...dados,
        instrucao_admin: texto,
        resposta_proposta: respostaProposta,
        mensagem_original_cliente: dados.contexto?.mensagens_historico?.slice(-1)[0]?.content || texto,
        aguardando_confirmacao: true
      },
      atualizado_em: new Date().toISOString()
    }, { onConflict: 'telefone' });
    
    return Response(...);
  }
  
  // Sem pending - ignorar
  return Response(...);
}
```

## Detalhes Técnicos

### Normalização de Números
- Admin: `5562991672674` ou `62991672674`
- Sempre remover caracteres não-numéricos antes de comparar
- Aceitar ambas as variações (com/sem DDI 55)

### Estados de Confirmação
- `aguardando_confirmacao: false` → Admin acabou de enviar instrução, IA gera proposta
- `aguardando_confirmacao: true` → IA enviou proposta, aguarda "sim" ou "não"

### Registro de Aprendizado
- Tabela: `chatbot_regras`
- Gatilho: extraído via IA (termos-chave da mensagem do cliente)
- Resposta: template com variáveis `{primeiro_nome}`, `{cpf_formatado}`, etc
- Flag `ativo: true` para ativação imediata

### Confirmações e Negações
- **Confirmar**: sim, ok, confirmo, confirmar, pode, pode enviar, tudo certo, perfeito
- **Negar**: não, nao, cancela, cancelar, espera, aguarda, refaz, muda

## Benefícios

1. **Confiabilidade**: Admin sempre revisa antes do envio
2. **Escalabilidade**: Sistema aprende e resolve situações similares automaticamente
3. **Transparência**: Admin é informado sobre cada aprendizado registrado
4. **Flexibilidade**: Admin pode cancelar e reformular a qualquer momento

