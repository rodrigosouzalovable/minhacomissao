# Modelo Mensagem: só "Colar imagem", 1 modelo e nova grade de parcelas

## O que muda na aba Modelo Mensagem

1. **Remover a aba "Importar planilha"** por completo (upload .xlsx, verificação de WhatsApp, lista de clientes, contatados, filtros e exportação da lista). A página passa a mostrar direto o fluxo de colar imagem, sem abas.
2. **Um único modelo de mensagem.** O seletor "Modelo 1 (55%/35%) / Modelo 2 (50%/30%)" sai, junto com todos os campos da Mensagem 2 no diálogo "Editar Modelo".
3. **Descontos editáveis dentro da aba de colar imagem**, em um bloco novo logo acima de "Mensagem gerada":
   - `% Desconto à vista`
   - `% Desconto parcelado`
   - Os valores são salvos no perfil do usuário (mesma tabela de modelo que já existe) e recarregam prontos na próxima vez — o funcionário só cola a imagem e copia.
4. **Fluxo final:** colar print → extrair dados por IA → conferir campos → mensagem gerada com os descontos salvos → "Copiar mensagem".

## Nova mensagem padrão

```text
Meu nome é {nome_usuario} falo referente à loja Novo Mundo.

Identificamos algumas parcelas em atraso que totalizam *R$ {total_atraso}*.

💰 E hoje temos uma condições especiais para você:

✅ *À VISTA* com {desconto_vista_pct}% de desconto:

   R$ {valor_quitacao}

{opcoes_parcelado}

*Qual opção é melhor para você? Que dia consegue realizar o pagamento?*
```

- `{nome_usuario}` é uma variável nova: o nome do usuário logado (perfil).
- O texto continua editável em "Editar Modelo"; esse passa a ser o padrão.

## Nova regra de parcelamento

- Grade: **2x, 4x, 8x, 12x, 16x, 20x e 24x**, calculada sobre o total com o desconto parcelado.
- **Parcela nunca abaixo de R$ 100,00**: cada opção só aparece se a parcela resultante for ≥ R$ 100.
- Se nenhuma opção couber (nem 2x), a mensagem sai **somente com o valor à vista** — sem fallback e sem bloco de parcelado.

## IAGO usa o mesmo formato

A proposta enviada pelo IAGO passa a usar a mesma grade (2, 4, 8, 12, 16, 20, 24), o mesmo mínimo de R$ 100 e o mesmo layout de texto (à vista em destaque + lista de parcelas + a pergunta final). Quando nenhuma parcela alcança R$ 100, ele oferece apenas o à vista. O credor citado continua sendo o da caixa de mensagens (ex.: Novo Mundo), não um texto fixo.

## Detalhes técnicos

- `src/pages/ModeloMensagem.tsx`: remover Tabs, estado/lógica da planilha (`clientes`, `contatados`, `whatsappStatus`, validação UAZAPI, persistência em `modelo_mensagem_estado`) e todo o estado da Mensagem 2; manter carregamento/salvamento de `template`, `desconto_padrao`, `desconto_parcelado_padrao`.
- `src/lib/parseCobmaisPlanilha.ts`: `buildOpcoesParcelado` com grade `[2,4,8,12,16,20,24]`, filtro `valorTotal / n >= 100`, retorno vazio quando nenhuma cabe; novo bloco de texto por opção no formato pedido; `renderMensagem` ganha `{nome_usuario}`. Os parsers de planilha ficam no arquivo apenas se ainda usados por outras telas — caso contrário são removidos.
- `src/components/modelo-mensagem/ColarImagemTab.tsx`: remover props/estado do modelo 2, adicionar inputs de desconto com salvamento (debounce) em `modelo_mensagem_template`, e receber o nome do usuário para `{nome_usuario}`.
- `src/components/EditarTemplateMensagemDialog.tsx`: uma única aba/modelo, lista de variáveis atualizada (`{nome_usuario}`, `{opcoes_parcelado}`).
- `supabase/functions/_shared/iago.ts`: `calcularProposta` com grade `[2,4,8,12,16,20,24]`, sem fallback abaixo de R$ 100 (retorna lista de opções vazia).
- `supabase/functions/iago-atendimento/index.ts`: instrução de formatação da proposta idêntica ao modelo acima; quando não houver opções parceladas, ofertar só o à vista. Redeploy da função.
- Sem novo cron, polling ou tabela — nenhum impacto de custo.
