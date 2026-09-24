# Aquecimento com leads do Certificado Digital e atendimento da CLARA

## Resultado esperado

Substituir temporariamente a entrada de novos leads do Google Maps por leads da Casa dos Dados, mantendo os dados antigos intactos. O teste usará exclusivamente números que tenham o template aprovado e a marca **“Número de nova BM — entrar no aquecimento de tier”**, com 50 contatos por dia útil, a sequência **D+5, D+10, D+15, D+20, D+25 e D+30**, a caixa **CERTIFICADO** e atendimento da **CLARA**.

## 1. Pausar a captação do Google Maps

- Criar um controle reversível para desligar toda nova captação automática do Google Maps sem apagar leads, históricos ou resultados existentes.
- Respeitar a pausa também nas ações manuais de busca, mostrando que a captação está temporariamente suspensa.
- Manter os demais recursos da aba Google Maps disponíveis para consulta dos dados já coletados.
- Não desligar o motor geral de envios: apenas retirar o Google Maps como fonte de novos contatos.

## 2. Usar a Casa dos Dados como fonte do teste

- Priorizar os contatos já armazenados e confirmados com WhatsApp; hoje há **904 contatos disponíveis** no estoque do Certificado Digital.
- Consultar a Casa dos Dados somente quando faltar estoque elegível para completar os 50 contatos da faixa do dia.
- Manter deduplicação por CNPJ e pelos últimos 8 dígitos do telefone, blacklist, opt-out e bloqueio de contatos já utilizados.
- Continuar a sequência por idade do CNPJ sem misturar faixas: D+5 → D+10 → D+15 → D+20 → D+25 → D+30.
- Não completar uma faixa com empresas de outra idade; se houver menos de 50 válidas, enviar somente as disponíveis e registrar o motivo.

## 3. Campanha e template

- Fixar este teste no template aprovado **`cnpj_atualizado_2`**, em português do Brasil.
- Usar apenas a variável `{{1}}`, preenchida com:
  - `falo com o(a) responsável por NOME DA EMPRESA?`
- Como o texto aprovado é `Olá {{1}} informamos que o processo de emissão do seu CNPJ foi atualizado.`, a mensagem enviada ficará:
  - **“Olá falo com o(a) responsável por NOME DA EMPRESA? informamos que o processo de emissão do seu CNPJ foi atualizado.”**
- Usar primeiro o nome fantasia; quando não existir, usar a razão social. Não enviar CNPJ, data de abertura ou valor neste template.
- Selecionar automaticamente somente números que tenham simultaneamente o template `cnpj_atualizado_2` aprovado e a marca **“Número de nova BM — entrar no aquecimento de tier”**, sem depender de uma BM fixa.
- Confirmar saúde, conexão, disponibilidade e aprovação do template em cada número imediatamente antes do disparo.
- Distribuir os 50 contatos em rodízio entre esses números aptos, com intervalo aleatório de 30 a 90 segundos, sem domingos e sem ultrapassar o limite diário agregado.
- Criar a campanha na caixa **CERTIFICADO**, com os controles normais de pausar, retomar, cancelar e acompanhar detalhes.

## 4. CLARA como vendedora de certificados digitais

- Fazer a CLARA analisar cada mensagem recebida e o histórico completo da conversa com IA antes de responder; esta chamada por resposta foi autorizada para o piloto.
- Dar a ela um roteiro comercial profissional focado em certificado digital, sem inventar preços, prazos, descontos ou condições não cadastradas.
- Diferenciar interesse, dúvida, objeção, recusa, número errado, pedido para não receber mensagens, intenção de agendar e envio de documentos.
- Corrigir respostas negativas como “não quero” para que nunca sejam interpretadas como aceite.
- Responder dúvidas dentro do conhecimento cadastrado, conduzir o cliente ao agendamento e solicitar CNPJ, e-mail e CNH apenas no momento adequado.
- Confirmar separadamente os documentos recebidos e informar somente o que ainda falta.
- Em dúvida sem resposta segura, avisar o cliente de forma educada e transferir para atendimento humano, em vez de ficar em silêncio.
- Preservar opt-out imediato, blacklist e interrupção automática quando um atendente humano assumir.

## 5. Medição da taxa de retorno

- Exibir o resultado por faixa D+N e no total: selecionados, enviados, entregues, lidos, respondidos, interessados, recusas, números errados, opt-outs e transferências para humano.
- Calcular taxa de resposta e taxa de interesse sobre mensagens entregues.
- Manter as métricas deste teste separadas do histórico do Google Maps e das campanhas anteriores do Certificado Digital.
- Identificar cada campanha por faixa e data para comparação objetiva.

## 6. Controles e segurança

- Adicionar na área do Certificado Digital um estado claro do teste: ativo/pausado, faixa atual, meta diária, estoque elegível, template e números marcados utilizados.
- Impedir campanhas duplicadas por cliques repetidos ou execuções simultâneas.
- Somente administradores poderão alterar a fonte, ativar/pausar o teste ou trocar sua configuração.
- Manter todas as conversas e respostas na caixa CERTIFICADO, atribuídas à CLARA.

## Detalhes técnicos

- Reaproveitar o agendamento e a fila existentes; **não criar novo cron, polling ou canal em tempo real**.
- Aplicar a seleção por marca e aprovação do template no servidor, impedindo que números fora do grupo entrem no rodízio.
- Acrescentar configurações reversíveis para a pausa do Google Maps e o modo de teste Casa dos Dados.
- Adaptar a criação dos itens da campanha ao número real de variáveis do template, removendo o preenchimento fixo atual de CNPJ, data e valor.
- Fortalecer o vínculo entre envio, lead do Certificado e conversa para classificar respostas e gerar métricas por faixa.
- Atualizar o processamento da CLARA para usar o histórico completo da conversa e manter uma alternativa segura de transferência humana caso a interpretação falhe.
- Validar no navegador e nos registros: pausa do Google Maps, seleção exclusiva da faixa, prévia exata do template, rodízio, entrada na caixa CERTIFICADO, resposta da CLARA, opt-out e painel de métricas.

## Custo e ativação

**Alerta de custo Lovable Cloud:** não será criado novo agendamento nem consulta periódica. A captação do Google Maps ficará pausada, reduzindo esse consumo. A Casa dos Dados só será consultada quando o estoque elegível não completar os 50 contatos; o atendimento interpretativo da CLARA consumirá IA apenas quando um cliente responder. O impacto recorrente esperado é baixo e controlado pelo limite de 50 contatos por dia.

A implantação deixará o novo modo preparado e pausado para conferência. A ativação dos envios ocorrerá somente após validar uma prévia com o texto e o nome da empresa corretos.
