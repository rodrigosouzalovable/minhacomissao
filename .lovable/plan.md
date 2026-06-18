# Modelo Mensagem — Plano

Nova página acessível pelo menu lateral onde você cola um print da tela do Cob+, define % de desconto à vista e nº de parcelas, e o sistema gera automaticamente a mensagem de negociação pronta para copiar/colar.

## Fluxo de uso

1. Você abre **Menu → Modelo Mensagem**
2. Cola um print (Ctrl+V) ou arrasta a imagem da tela do Cob+
3. A IA (Gemini Flash) lê a imagem e extrai: nome, CPF, contrato, total em atraso, lista de parcelas (número, vencimento, valor, dias de atraso)
4. Você ajusta dois campos:
   - **% de desconto para quitação à vista** (ex: 50%)
   - **Nº de parcelas** para parcelamento (ex: 12x)
5. A mensagem principal é renderizada automaticamente com os dados preenchidos
6. Botão **Copiar mensagem** copia tudo formatado
7. Botão **Editar modelo** abre dialog para alterar o template fixo

## Componentes a criar

- **`src/pages/ModeloMensagem.tsx`** — página com 3 seções:
  - Esquerda: zona de "cole o print aqui" (drag & drop + paste + upload), preview da imagem, botão "Extrair dados"
  - Centro: card com dados extraídos editáveis (caso a IA erre algum campo) + inputs de % desconto e nº parcelas
  - Direita: pré-visualização da mensagem final em monospace + botão "Copiar"
- **`src/components/EditarTemplateMensagemDialog.tsx`** — editor do template com lista de variáveis suportadas e preview ao lado
- **Item no `AppSidebar`** (ou onde estiver o menu lateral) com ícone `MessageSquareText` e rota `/modelo-mensagem`
- **Rota** registrada em `src/App.tsx`

## Backend

- **Edge function `extract-cobmais-print`** — recebe imagem base64, chama `google/gemini-2.5-flash` via Lovable AI Gateway com prompt estruturado pedindo JSON com `{nome, cpf, contrato, total_atraso, neg_data, parcelas:[{numero, vencimento, valor, atraso}]}`. Trata 429/402 retornando erro claro. Reaproveita o padrão de `extract-acordo-data`.
- **Tabela `modelo_mensagem_template`** (singleton por usuário) com campos: `user_id`, `template` (text), `desconto_padrao` (numeric), `parcelas_padrao` (int). RLS por `auth.uid()`, GRANTs para `authenticated` e `service_role`.

## Template padrão (você pode editar)

Você define livremente. Variáveis disponíveis:
`{nome}` `{cpf}` `{contrato}` `{total_atraso}` `{qtd_parcelas_atraso}` `{desconto_pct}` `{valor_quitacao}` `{parcelas_qtd}` `{valor_parcela}` `{lista_parcelas}` `{data_hoje}`

Sugestão inicial que vamos deixar pré-carregada:

```
Olá, {nome}! Tudo bem?

Identificamos {qtd_parcelas_atraso} parcelas em aberto no contrato {contrato}, totalizando *R$ {total_atraso}*.

📋 *Parcelas em aberto:*
{lista_parcelas}

💰 *Condições especiais para hoje:*

✅ *À VISTA* com {desconto_pct}% de desconto:
   *R$ {valor_quitacao}*

✅ *PARCELADO* em {parcelas_qtd}x de:
   *R$ {valor_parcela}*

Posso confirmar qual opção é melhor para você?
```

## Cálculos

- `valor_quitacao` = `total_atraso × (1 - desconto_pct/100)`
- `valor_parcela` = `total_atraso / parcelas_qtd`
- `lista_parcelas` = formata cada parcela como `• Parcela 01 — venc. 15/11/2023 — R$ 350,00 (946 dias de atraso)`
- Tudo formatado em pt-BR (vírgula decimal, R$ prefixo)

## Custo / aviso

A extração usa Gemini Flash (modelo econômico). Cada print processado consome créditos do Lovable AI Gateway. Vou avisar isso na UI logo abaixo do botão "Extrair dados".

## Fora do escopo desta entrega

- Múltiplos templates salvos (você escolheu 1 modelo fixo)
- Envio automático via WhatsApp a partir desta tela (só copiar/colar por enquanto)
- Histórico de prints processados