

# Auto-identificação do cliente por telefone no chatbot

## Objetivo
Quando o cliente responder a uma mensagem do Acionamento, o chatbot identifica automaticamente quem é pelo número de telefone (cruzando com a tabela `devedores`), confirma a identidade e já apresenta a proposta -- sem pedir CPF.

## Fluxo proposto

```text
Cliente responde "Sim" →
  Chatbot detecta conversa nova →
    Busca telefone na tabela devedores →
      ENCONTROU: "Estou falando com {nome}, CPF {cpf}?" →
        Cliente confirma → Apresenta proposta (50% à vista / 30% parcelado)
        Cliente nega → Pede CPF normalmente
      NÃO ENCONTROU: Fluxo atual (pede CPF)
```

## Mudanças em `supabase/functions/whatsapp-chatbot/index.ts`

1. **Nova etapa `aguardando_confirmacao_identidade`**: Após encontrar o devedor pelo telefone, o chatbot pergunta "Estou falando com {nome}?" e aguarda confirmação.

2. **Lookup por telefone no case `novo`**: Antes de pedir CPF, consultar `devedores` onde `telefone` contém os últimos 10-11 dígitos do número. Se encontrar resultado(s):
   - Salvar CPF e nome nos `dados` da conversa
   - IA gera mensagem confirmando identidade: "Olá! Estou falando com *{nome}*, CPF final *{últimos 3 dígitos}*?"
   - Mudar etapa para `aguardando_confirmacao_identidade`

3. **Novo case `aguardando_confirmacao_identidade`**: 
   - Se cliente confirma (sim/isso/correto) → pula direto para consulta de débitos e proposta (reutiliza lógica existente)
   - Se cliente nega → reseta para `aguardando_cpf` e pede CPF normalmente

4. **Busca flexível de telefone**: O número no WhatsApp vem como `5562XXXXXXXX`. Na planilha pode estar como `62XXXXXXXX` ou `(62) XXXXX-XXXX`. A busca usará os últimos 10-11 dígitos limpos para matching.

## Sem mudanças no banco de dados
A tabela `devedores` já tem a coluna `telefone`. A busca será feita via query simples com `ilike` nos últimos dígitos.

