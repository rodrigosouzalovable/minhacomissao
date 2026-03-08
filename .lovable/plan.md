

# Corrigir auto-identificação do chatbot por telefone

## Problemas identificados

1. **Busca de telefone incompleta**: O chatbot busca apenas na coluna `devedores.telefone`, mas os telefones também podem estar na tabela `devedor_telefones` (telefones adicionais cadastrados). Se o telefone importado foi convertido para `devedor_telefones`, o campo original fica vazio.

2. **Confirmação desnecessária**: Quando o cliente responde "Sim" a uma mensagem do Acionamento que já mencionou o nome dele (ex: "Olá JOSE CARLOS... com 50% de desconto?"), o chatbot não precisa perguntar "Estou falando com Jose Carlos?". Deve ir **direto para a proposta**.

3. **Estado antigo da conversa**: Se já existia um registro em `chatbot_conversas` para aquele telefone (de uma interação anterior), o "Sim" pode cair em um estado antigo em vez de `novo`. O texto "sim" não está na lista de resets (greetings/menu).

## Mudanças em `supabase/functions/whatsapp-chatbot/index.ts`

### 1. Adicionar "sim" como trigger de reset para estado `novo`
Na linha 331, incluir "sim" na lista de palavras que resetam a conversa se ela não estiver em negociação ativa, para que clientes que respondem "Sim" ao Acionamento iniciem um fluxo novo.

### 2. Expandir busca de telefone para incluir `devedor_telefones`
No case `novo`, após buscar em `devedores.telefone`, buscar também em `devedor_telefones.numero` (filtrando `ativo = true`) e usar o `devedor_cpf` para cruzar com `devedores`.

### 3. Ir direto para a proposta (sem confirmar identidade)
Quando o cliente é encontrado pelo telefone no fluxo `novo`, em vez de perguntar "É você?", o chatbot:
- Consulta os débitos via `consultar_debitos_por_cpf`
- Apresenta a proposta diretamente com os valores reais (50% à vista, 30% parcelado)
- Pula a etapa `aguardando_confirmacao_identidade`
- Vai direto para `proposta_enviada`

A etapa `aguardando_confirmacao_identidade` permanece no código como fallback para casos manuais, mas não será mais usada no fluxo automático do Acionamento.

### 4. Manter etapa de confirmação como fallback
Se houver múltiplos devedores com o mesmo telefone, o chatbot ainda perguntará qual é, garantindo segurança.

## Resultado esperado
Cliente recebe "Olá JOSE CARLOS... 50% de desconto?" → responde "Sim" → chatbot responde direto: "Consigo liberar à vista por R$ 714,79 ou parcelar em 5x de R$ 200,14. Como fica melhor?"

