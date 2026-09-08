# Escolher o tipo de variável ao criar template Meta

## O problema

Hoje o formulário de "Criar Template" aceita qualquer coisa que você digitar no corpo: se escrever `{{name}}`, o sistema trata como variável nomeada; se escrever `{{1}}`, como numerada. Não existe escolha explícita, então templates com `{{name}}` sobem para a Meta e voltam rejeitados com o aviso "os parâmetros de variável devem ser números inteiros com dois conjuntos de chaves" — foi o que aconteceu com `seguranca_do_processo`, `dados_cadastrais` e `abertura_para_reagendamento`.

## O que muda na tela

1. **Novo campo "Tipo de variável"** no topo do bloco do corpo, com duas opções:
   - **Número — `{{1}}`, `{{2}}`** (padrão, é o formato que a Meta aprova em todas as contas)
   - **Nome — `{{nome}}`, `{{valor}}`** (só funciona em contas habilitadas para variáveis nomeadas)
2. **Botões "Inserir variável"** que colocam a variável no texto já no formato escolhido, na posição do cursor.
3. **Aviso e correção automática**: se o texto tiver variáveis no formato diferente do escolhido, aparece um alerta em vermelho com um botão **"Converter para o formato selecionado"** — ele troca `{{name}}` por `{{1}}` (na ordem em que aparecem) ou o contrário, mantendo os exemplos já preenchidos.
4. **Bloqueio ao salvar**: não é possível salvar com os dois formatos misturados nem com o formato diferente do escolhido; a mensagem explica exatamente o que corrigir.
5. **Exemplos obrigatórios** continuam iguais, mas só aparece o bloco do formato selecionado (numeradas ou nomeadas), sem os dois ao mesmo tempo.
6. **Aviso de risco** ao escolher "Nome": texto curto explicando que muitas contas rejeitam esse formato e que o recomendado é Número.

## Detalhes técnicos

- Arquivo único: `src/pages/MetaTemplates.tsx`.
  - Novo estado `formatoVar: "NUMERADA" | "NOMEADA"` (padrão `NUMERADA`).
  - `extrairVars` já separa numeradas de nomeadas — usar isso para detectar divergência e alimentar o alerta/conversor.
  - Função de conversão local sobre a string `corpo`, remapeando também `exemploBody` ↔ `exemploNomeado`.
  - `salvarMestre` passa a validar formato antes de montar `exemplo`, mantendo `body_text` para numeradas e `body_text_named_params` para nomeadas (contrato atual do backend preservado).
- Sem mudanças em banco de dados, Edge Functions, cron ou envio em lote. Templates já salvos continuam funcionando.

## Fora do escopo

Reenviar/recriar os templates já rejeitados na Meta (pode ser feito depois pelo fluxo normal, com o formato correto).
