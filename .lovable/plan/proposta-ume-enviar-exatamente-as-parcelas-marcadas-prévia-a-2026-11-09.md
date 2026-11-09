# Proposta UME: enviar exatamente as parcelas marcadas + prévia antes de enviar

## O que encontrei
- O texto salvo do Wesley usa o campo **{maior_parcelamento}**, que mostra só **uma** opção (a maior). Por isso, mesmo marcando 12x e 15x, saiu uma linha só.
- As parcelas marcadas ficam guardadas só no navegador. Se ele marcou em um computador ou janela e enviou de outro, a escolha voltou para "todas ligadas" e a maior saiu (17x).

## O que vai mudar
1. **Parcelas marcadas sempre respeitadas**
   - Se o texto usa {maior_parcelamento} e o atendente marcou mais de uma parcela, o campo passa a listar **todas as marcadas**, uma por linha (ex.: "12x de R$ ...", "15x de R$ ..."). Com uma só marcada, continua igual.
   - {parcelas_lista} continua listando apenas as marcadas.
   - À vista desligado continua removendo a linha do à vista.
2. **Escolha salva na conta do atendente** (não mais só no navegador), junto com o texto da proposta. Vale em qualquer computador.
3. **Prévia antes de enviar**
   - Na Calculadora UME, acima dos botões, aparece um campo "Prévia da mensagem" com o texto exato que vai sair.
   - O atendente pode ajustar o texto ali mesmo; "Enviar na conversa" e "Copiar proposta" usam o texto da prévia.
   - A prévia se atualiza ao trocar a tabela ou as parcelas marcadas.
4. Aviso na tela de configuração quando o texto usa {maior_parcelamento}, explicando que ele lista as parcelas marcadas.

Regras mantidas: parcela mínima R$ 100, limite 18x, valores calculados iguais.

## Detalhes técnicos
- `ume_proposta_modelos`: nova coluna `opcoes jsonb` (null = todas). Leitura/gravação no mesmo upsert do texto; localStorage vira só fallback de migração.
- `umePropostaModelo.ts`: `maior_parcelamento` = lista das oferecidas quando `o.parcelas.length < TODAS_PARCELAS.length` e houver >1; testes novos (12x+15x → as duas linhas; à vista desligado).
- `ConsultaUmeDialog.tsx`: estado `previa` (Textarea) inicializado por `textoFinal(consulta)`, recalculado ao mudar tabela/opções; envio/cópia usam `previa`.
- Sem custo extra de Cloud (uma coluna, nenhuma consulta nova).
