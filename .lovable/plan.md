

# Aba "IA" no Acionamento — Configurar respostas do chatbot

## Objetivo
Criar uma aba "IA" na página de Acionamento onde o admin pode configurar os templates de resposta que o chatbot WhatsApp usa em cada etapa da conversa. O chatbot deixará de usar textos fixos no código e passará a ler os templates do banco de dados.

## Nova tabela: `chatbot_templates`

```sql
CREATE TABLE public.chatbot_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  template TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chatbot_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar templates"
ON public.chatbot_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

Templates pré-cadastrados por etapa:
- **`confirmacao_cpf`** — "Só pra confirmar, seu CPF é {cpf_formatado}?"
- **`proposta`** — "Perfeito, {primeiro_nome}! A proposta disponível para *pagamento à vista é {valor_avista}*, pagando esse valor, você quita todas as parcelas em aberto com {credor}. Ou podemos parcelar para você da seguinte forma: *{max_parcelas}x de {valor_parcela}*. Como fica melhor para você?"
- **`saudacao`** — "Olá! 👋 Sou a Ana, da Souza e Ribeiro Negociações. Para consultar sua situação, me informe seu CPF."
- **`sem_debitos`** — "Ótima notícia, {primeiro_nome}! Não encontramos pendências no seu CPF."
- **`negacao_identidade`** — "Desculpe pelo engano! Me informe seu CPF para que eu possa consultar."

## Aba "IA" no Acionamento (`src/pages/Acionamento.tsx`)

- Adicionar terceiro botão de tab: **A ENVIAR | ENVIADOS | IA**
- Conteúdo da aba IA:
  - Lista de cards, um por template/etapa
  - Cada card mostra: nome da etapa, descrição, campo de texto editável com o template
  - Legenda de variáveis disponíveis: `{primeiro_nome}`, `{cpf_formatado}`, `{valor_avista}`, `{valor_parcela}`, `{max_parcelas}`, `{credor}`
  - Botão "Salvar" por template
  - Visível apenas para admins

## Edge Function `whatsapp-chatbot/index.ts`

- Ao iniciar o processamento, buscar todos os templates ativos de `chatbot_templates`
- Usar o template da etapa correspondente em vez do texto fixo no código
- Substituir as variáveis `{primeiro_nome}`, `{cpf_formatado}`, `{valor_avista}`, etc. com os valores reais
- Fallback: se não existir template no banco, usar o texto fixo atual

## Variáveis suportadas nos templates

| Variável | Descrição |
|---|---|
| `{primeiro_nome}` | Primeiro nome capitalizado |
| `{nome_completo}` | Nome completo |
| `{cpf_formatado}` | CPF com máscara |
| `{valor_avista}` | 50% do saldo |
| `{valor_parcela}` | Valor de cada parcela |
| `{max_parcelas}` | Qtd máxima de parcelas |
| `{credor}` | Nome do credor |
| `{telefone_contato}` | (62) 98218-3144 |

