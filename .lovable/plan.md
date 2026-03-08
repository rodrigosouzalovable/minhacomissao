

# Chatbot com respostas EXATAS baseadas no saldo do cliente

## Problema atual
O chatbot usa `gerarRespostaHumana()` (IA generativa) para criar respostas livres em quase todas as etapas. Isso faz com que a IA "invente" textos que não seguem exatamente o que você ensinou. Além disso, o fluxo não contempla as etapas de "consegue pagar hoje?" e "que dia pode pagar?" (limite 7 dias).

## O que o saldo já faz
A tabela `devedores` tem a coluna `valor_atualizado` — esse é o saldo importado pela planilha. O chatbot já usa esse valor para calcular 50% (à vista) e 30% de desconto (parcelado). Isso já funciona.

## Mudança principal
Substituir as chamadas de IA generativa por **respostas fixas/template** em cada etapa, seguindo EXATAMENTE o script que você ensinou. A IA só será usada para interpretar intenção (sim/não, à vista/parcelado), nunca para redigir a resposta.

## Novo fluxo de etapas

```text
novo → identifica cliente pelo telefone
  ↓
confirmacao_identidade → "Seu CPF é XXX?"
  ↓ (sim)
proposta_enviada → "Olá {nome}, você consegue voltar a pagar suas 
                    parcelas em aberto com {credor} com 50% de desconto?"
  ↓ (sim)
oferta_valores → "Que ótimo! ...R$ {avista} à vista OU {parcelas}x de 
                  R$ {parcela}. Como fica melhor?"
  ↓ (escolhe forma)
aguardando_data → "Ok! Você consegue fazer o pagamento hoje?"
  ↓ (sim) → "Ok! Iremos te enviar o boleto para pagamento hoje."
  ↓ (não) → "Que dia você pode fazer o pagamento?"
    ↓
validar_data → Se ≤7 dias: "OK, irei te enviar o boleto para essa data!"
             → Se >7 dias: "Infelizmente o prazo máximo é 7 dias..."
```

## Arquivo alterado
**`supabase/functions/whatsapp-chatbot/index.ts`**

1. **Novas etapas** no switch: `oferta_valores`, `aguardando_data`, `validar_data`
2. **Respostas fixas** (sem `gerarRespostaHumana`): cada etapa retorna texto exato com variáveis substituídas ({nome}, {valor_avista}, {parcelas}, {credor})
3. **IA só para intenção**: manter `interpretarIntencao()` apenas para classificar (sim/não, avista/parcelado, hoje/outra data)
4. **Etapa "proposta_enviada"** reformulada: em vez de já mostrar valores, primeiro pergunta se o cliente "consegue voltar a pagar com 50% de desconto"
5. **Validação de data**: quando cliente informa data, verificar se está dentro de 7 dias corridos
6. **Mensagens exatas** conforme suas instruções — sem variação, sem emojis extras, sem reformulação

## Resultado esperado
O chatbot seguirá o script exato que você ensinou, usando o saldo real do cliente (da planilha importada) para calcular os valores, sem inventar nada.

