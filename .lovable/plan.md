# IAGO: parar de confundir "não é o quinto dia útil" com número errado

## O que aconteceu (confirmado no código)

O cliente respondeu: *"Hoje não porque não é o quinto dia útil. Consegue por para terça feira dia 08?"*

O detector de "número errado / não sou essa pessoa" (`ehNumeroErrado`) tem a regra `não + é/sou + o/a/ele/ela/…`. A frase contém "não **é o** quinto dia útil", então a regra disparou. Esse detector roda **antes** de qualquer consulta ou chamada de IA: o IAGO enviou o encerramento padrão ("Entendi, obrigado pela atenção e desculpe o incômodo!"), marcou a etapa `numero_errado` e parou de falar. Testei a expressão com a frase real: dá match.

Ou seja, não foi falha de interpretação da IA — foi um atalho de palavra-chave engolindo uma resposta de negociação.

## Correções

1. **"Número errado" fica mais rigoroso**
   - A regra `não é o/a/ele/ela…` só vale quando o que vem depois é gente (nome próprio, "ele", "ela", "essa pessoa", "o titular", "eu") — nunca quando vem seguida de algo do contexto de pagamento/data ("dia", "dia útil", "quinto dia", "meu vencimento", "o valor", "a data", "o momento", "possível", "hoje", "agora").
   - Se a mesma mensagem contiver sinal claro de negociação (escolha de parcelamento, "consegue por para", data, dia da semana, "pagamento", "parcela", "valor"), o atalho de número errado é ignorado e a mensagem segue o fluxo normal.
   - As detecções realmente inequívocas continuam iguais ("número errado", "é engano", "não conheço essa pessoa", "não sou o Sebastião", "pessoa errada").

2. **Cliente que propõe data nunca é encerrado — vai para o humano**
   - Na etapa "consegue pagar hoje?", resposta com "hoje não" + uma data proposta passa a ser tratada como data informada: o IAGO confirma e **escala para o atendente humano** com a opção escolhida e a data.
   - Data dentro do mês atual → confirma e chama o humano. Fora do mês → chama o humano com o motivo "data fora do mês atual". Resposta vaga → uma repergunta e depois escala.
   - Nenhum caminho da etapa de data/escolha pode terminar em encerramento definitivo: se o IAGO não souber conduzir, ele escala (etiqueta "Aguardando Humano" + aviso), em vez de agradecer e sair.

3. **Entender melhor a resposta do cliente**
   - "Hoje não porque…" deixa de ser lido como "sim" por causa da palavra "hoje": a negação passa a ter prioridade sobre a detecção de "hoje".
   - Quando a mensagem trouxer dia da semana **e** número do dia ("terça feira dia 08"), o número do dia manda; se os dois divergirem, o IAGO pergunta qual é o correto uma única vez.
   - Reconhecimento adicional de propostas comuns: "consegue por para…", "dá pra deixar para…", "quinto dia útil", "dia do pagamento", "quando cai meu salário" (essas duas últimas sem data concreta = repergunta).
   - O prompt da IA passa a dizer explicitamente: justificativa do cliente sobre a data (dia útil, salário, benefício) **não** é negação de identidade; nunca encerrar a conversa quando o cliente propõe data ou condição — escalar.

4. **Recuperar a conversa da Elaine Ferreira**
   - Limpar a etapa `numero_errado` desse contato, remover a supressão criada por engano e aplicar a etiqueta "Aguardando Humano" com aviso, para o atendente retomar a proposta de terça 08/09.

## Detalhes técnicos

- `supabase/functions/_shared/iago.ts`
  - `ehNumeroErrado`: lista de palavras seguintes proibidas para a regra de pronome/artigo + guarda de contexto de negociação/data (reaproveitando `classificarDataPagamento` e `detectarEscolha` como sinal).
  - `respostaPagamentoHoje`: avaliar negação antes de afirmação e reconhecer "hoje não", "não hoje", "hoje não dá/consigo/posso".
  - `classificarDataPagamento`: prioridade do "dia N" explícito sobre o dia da semana; nova classe de conflito quando os dois divergem; frases "consegue por para", "deixar para", "quinto dia util".
- `supabase/functions/iago-atendimento/index.ts`
  - Extrair data da mesma mensagem quando `pagamentoHoje === 'nao'` (hoje isso só ocorre em parte dos caminhos) e garantir escalada em todos os desfechos das etapas `escolha_feita` / `aguardando_data`.
  - Bloquear `encerrarNumeroErrado` quando a conversa já está em etapa de negociação (`escolha_feita`, `aguardando_data`, proposta enviada) — nesse estado, identidade negada passa por escalada ao humano em vez de encerramento automático.
  - Ajustes no prompt (`gerarResposta`) conforme item 3.
- Uma correção de dados pontual no contato afetado (estado + supressão + etiqueta). Sem novas tabelas, sem cron novo, sem custo adicional.
