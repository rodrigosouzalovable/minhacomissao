

# Chatbot WhatsApp humanizado com IA

## Problema

Atualmente o chatbot usa mensagens **fixas e robotizadas** (switch/case com textos hardcoded). O cliente percebe que está falando com um robô.

## Solução

Integrar a Lovable AI (Gemini) para gerar respostas humanizadas, mantendo toda a lógica de negócio (consulta CPF, propostas, geração de boleto). A IA recebe o contexto da conversa e os dados do devedor, e formula respostas naturais.

### Arquitetura

O fluxo de negócio (etapas, cálculos, trigger do robô CobMais) permanece intacto. A mudança é que, em vez de retornar strings fixas, cada etapa passa um **contexto estruturado** para a IA que gera a resposta final.

### Mudanças no arquivo `supabase/functions/whatsapp-chatbot/index.ts`

1. **Adicionar função `gerarRespostaHumana()`** que chama `ai.gateway.lovable.dev` com:
   - System prompt definindo o tom (amigável, empático, profissional, como um negociador humano)
   - Histórico recente da conversa (últimas 5-10 mensagens do `chatbot_conversas.dados`)
   - Contexto da situação atual (dados do devedor, valores, etapa)
   - Instruções para NÃO inventar dados — usar apenas os valores fornecidos

2. **Salvar histórico de mensagens** no campo `dados` da conversa (`chatbot_conversas`), adicionando array `mensagens_historico` com as últimas trocas

3. **Substituir strings fixas** por chamadas à IA em cada case do switch:
   - `novo` → IA gera saudação natural baseada no horário
   - `aguardando_cpf` (CPF inválido) → IA pede o CPF de forma gentil
   - `proposta_enviada` → IA apresenta os valores com empatia, reconhecendo a situação do cliente
   - `aguardando_parcelas` → IA confirma e orienta de forma conversacional
   - `acordo_finalizado` → IA parabeniza de forma genuína
   - Respostas fora do esperado → IA interpreta a intenção e redireciona naturalmente

4. **System prompt** com regras:
   - Representar a "Souza e Ribeiro Negociações"
   - Tom empático e humano, sem emojis excessivos
   - Nunca inventar valores — usar apenas os dados fornecidos
   - Manter respostas curtas (WhatsApp)
   - Sempre oferecer o telefone (62) 98218-3144 quando relevante
   - Entender variações de linguagem ("quero pagar", "aceito", "pode ser" = aceitação)

5. **Fallback**: Se a IA falhar (timeout/erro), usar as mensagens fixas atuais como backup

### Benefício adicional

A IA consegue interpretar mensagens ambíguas. Hoje se o cliente escreve "quero pagar à vista" em vez de "1", o bot não entende. Com a IA, isso será interpretado corretamente.

