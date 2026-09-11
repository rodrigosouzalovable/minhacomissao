# Liberar números GREEN sem bloquear toda a BM Avatus

## Diagnóstico confirmado

- A campanha **QUEBRADOS** possui 13 números selecionados: **12 GREEN da BM Rodrigo Ribeiro (Facebook Avatus)** e 1 YELLOW de outra BM.
- Os 12 GREEN aparecem conectados e com a leitura de saúde `can_send_message = AVAILABLE`, mas tentativas reais feitas por vários deles receberam da Meta o erro **Business Account locked (#131031)**.
- A campanha enviou 351 contatos, deixou 984 pendentes e encerrou porque os 12 números da Avatus foram marcados como `restrita` em conjunto.
- A qualidade GREEN mede a reputação do número; ela não garante, sozinha, que a Meta aceitará o envio da BM.
- O bloqueio coletivo ocorre porque, após um único `#131031`, o sistema restringe todos os números ligados ao mesmo cadastro de BM. Isso impede que números GREEN da Avatus sejam testados individualmente mesmo quando a consulta de saúde os mostra disponíveis.

## Correção

1. **Remover o bloqueio coletivo por BM**
   - Um erro `#131031` deixará de retirar automaticamente todos os números da Avatus.
   - Somente o número que efetivamente recebeu a recusa será retirado naquele momento.

2. **Validar e liberar cada número separadamente**
   - Ao iniciar ou atualizar uma campanha, revalidar os números selecionados na Meta.
   - Número GREEN, conectado, sem restrição de envio e sem banimento volta ao pool mesmo que outro número da mesma BM tenha falhado.
   - YELLOW/RED e números com bloqueio confirmado continuam fora conforme as regras atuais.

3. **Usar a resposta do envio como confirmação final**
   - Cada número GREEN liberado poderá fazer sua própria tentativa.
   - Se a Meta aceitar, ele permanece no rodízio.
   - Se aquele número retornar `#131031`, somente ele será removido; o contato volta à fila para tentar outro número GREEN, sem duplicar mensagens já aceitas.

4. **Retomar a campanha QUEBRADOS com segurança**
   - Revalidar os 12 números da Avatus e retirar a marca coletiva antiga.
   - Recolocar os 984 contatos pendentes na continuação da campanha.
   - Não reenviar os 351 já aceitos nem os contatos sem WhatsApp.
   - Manter intervalo, template e rodízio já configurados.

5. **Deixar a explicação clara no acompanhamento**
   - Mostrar separadamente “qualidade GREEN” e “envio recusado pela Meta”.
   - Informar exatamente quais números passaram no envio real e quais foram recusados individualmente.

## Limite de segurança

A alteração remove o bloqueio preventivo da **BM inteira**, mas não ignora uma recusa real da Meta. Se todos os números Avatus continuarem retornando `#131031`, eles serão retirados individualmente e a campanha ficará aguardando números de outra BM apta; o sistema não pode forçar a Meta a aceitar mensagens.

## Custo

Sem cron, polling ou consulta periódica nova. A validação acontece somente ao iniciar/atualizar a campanha e nas tentativas normais de envio, reduzindo bloqueios falsos sem elevar o consumo recorrente da Lovable Cloud.
