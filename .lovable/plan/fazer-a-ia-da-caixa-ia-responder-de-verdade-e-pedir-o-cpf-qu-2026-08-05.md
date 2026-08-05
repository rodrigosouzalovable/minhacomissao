# Fazer a IA da caixa "IA" responder de verdade (e pedir o CPF quando não achar o cliente)

## O que eu verifiquei

- A mensagem do botão **"VERIFICAR PROPOSTA"** chegou e foi gravada como mensagem de entrada às 17:40 (contato Rodrigo, +55 62 98181-0202), e essa conversa está corretamente na caixa **IA**.
- A configuração da IA está **ativa** (desconto 50% à vista, 30% parcelado, 24x, mínimo R$100, 08h–20h) e existem **7 modelos** de mensagem e **1 contato de emergência** cadastrados.
- A tabela de estado das conversas da IA está **vazia** e a função de atendimento **não tem nenhum registro de execução**: ou seja, a IA nunca foi chamada de fato.
- Motivo: no webhook, a chamada para a IA é disparada "solta" (sem aguardar). O webhook responde à Meta e o processo é encerrado imediatamente — a chamada é abortada antes de chegar na IA. Nos logs aparece o "shutdown" logo após cada requisição.

## O que vou corrigir

1. **Garantir a execução da IA**
   - Passar a chamada da IA para uma execução garantida em segundo plano (`EdgeRuntime.waitUntil`) com fallback aguardando a chamada, para que ela nunca seja abortada quando o webhook encerra.
   - Registrar log claro do resultado (`etapa` retornada / motivo de pulo) para auditoria.

2. **Fluxo completo da negociação, começando pelo CPF**
   - Se o telefone do cliente **não** casar com nenhum débito (busca por sufixo de 8 dígitos em `devedores` e `devedor_telefones`), a IA envia o modelo **"Pedir CPF"** e passa a aguardar o documento.
   - O cliente responde com CPF/CNPJ (aceitando pontos, traços e texto ao redor):
     - **Documento inválido / não numérico** → envia "CPF inválido" e pede de novo (com limite de tentativas para não virar loop).
     - **Sem débitos ativos** → envia "Sem débitos".
     - **Já possui acordo lançado** → envia a mensagem ao cliente, marca a conversa como "aguardando humano" e avisa os contatos de emergência (nome, telefone, CPF, atendente que lançou).
     - **Com débitos** → calcula total, valor à vista e o parcelamento (respeitando parcela mínima e máximo de parcelas) e envia o modelo **"Proposta de negociação"** com as variáveis preenchidas.
   - Cliente responde escolhendo **à vista** ou **parcelado** → envia "Confirmação da escolha", marca "aguardando humano" e avisa emergência para um humano fechar o acordo.
   - Qualquer outra resposta após a proposta (dúvida) → aciona o humano via emergência.
   - Respostas de **botão** (como "VERIFICAR PROPOSTA") continuam entrando como texto e disparam o início do fluxo (saudação/pedido de CPF).

3. **Não atropelar o humano**
   - Mensagem enviada por atendente na conversa continua desligando a IA ali. Vou reforçar para que os envios da própria IA nunca sejam confundidos com envio humano.

4. **Proteções de custo**
   - Sem cron novo, sem polling. A IA só roda em mensagem recebida na caixa IA, respeitando horário e o limite de mensagens por conversa/dia já configurado.

## Detalhes técnicos

- `supabase/functions/meta-whatsapp-webhook/index.ts`: trocar o `functions.invoke` solto por execução garantida (`EdgeRuntime.waitUntil`) e checar a caixa antes de chamar, evitando invocações desnecessárias.
- `supabase/functions/meta-ia-atendimento/index.ts`:
  - extração de CPF/CNPJ mais tolerante (remove máscara, ignora texto ao redor, valida 11/14 dígitos);
  - contador de tentativas de CPF no `contexto` do estado, com fallback para humano após N tentativas;
  - marcar os envios da IA com flag própria no estado para não serem lidos como "humano assumiu";
  - logs por etapa (`pedir_cpf`, `proposta`, `ja_tem_acordo`, `sem_debitos`, `confirmacao_escolha`).
- Reaproveita as RPCs existentes: `consultar_debitos_por_cpf`, `cpf_has_acordo`, `cpf_acordo_funcionario_nome`.

## Como validar

Depois de aplicar, responder qualquer coisa do 62 98181-0202 na caixa IA: a IA deve pedir o CPF; enviando um CPF com débitos, ela deve mandar a proposta calculada; enviando um CPF com acordo já lançado, ela deve chamar o humano e avisar o 62 99167-2674.
