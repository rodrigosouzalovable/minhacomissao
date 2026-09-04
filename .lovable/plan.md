# Erro "conta bloqueada / pendência de pagamento" nas suas instâncias

## O que eu verifiquei (não é invenção do sistema)

O erro existiu de verdade e veio da própria Meta, não de um cache nosso. Nos avisos de entrega
recebidos hoje entre 12:02 e 12:04 (horário de Brasília) a Meta rejeitou as mensagens destes
números com dois motivos:

- "Business Account locked (#131031)" — 6299-3397, -3405, -3446, -3452, -3481 e 6298-2311
- "Business eligibility payment issue (#131042)" — 6298-4808, 6299-0775, -3506 e 6298-2293

Nesses números não houve nenhuma entrega bem-sucedida hoje, só falhas. No mesmo período outros
números (6299-9531, 6298-8416) entregaram, leram e receberam respostas normalmente — ou seja, o
problema era da conta de negócios daqueles números, não do sistema.

Consultei agora a Meta número por número: todos os 10 voltaram como
"pode enviar: disponível", conta ativa, verificação de negócio concluída, qualidade GREEN
(exceto 6299-3467, que está em RED por qualidade, motivo diferente). Isto é: a pendência que você
resolveu do lado da Meta já foi reconhecida.

O sistema já devolveu sozinho a maior parte dos números para as campanhas. Faltam três ainda
parados esperando a próxima verificação automática: 6299-3481, 6298-2311 e 6299-3467.

## O que vou fazer

1. Rodar agora a revalidação desses três números e devolver ao pool os que a Meta confirmar
   saudáveis (6299-3481 e 6298-2311). O 6299-3467 continua fora das campanhas por qualidade RED —
   ele segue no aquecimento automático até voltar ao verde.
2. Encurtar a espera: hoje, quando a Meta rejeita por bloqueio, o número fica 24h parado esperando
   a verificação. Vou passar a revalidar o número na Meta poucos minutos depois do bloqueio; se a
   Meta responder "disponível", ele volta na hora, sem esperar o dia seguinte.
3. Evitar bloqueio desnecessário: antes de tirar o número do pool por bloqueio de conta, o sistema
   vai conferir na hora com a Meta se a conta realmente está travada. Se a Meta disser que está
   liberada, apenas aquele contato é devolvido para a fila e o número continua enviando.
4. Deixar o motivo mais claro no card do número: em vez de só "Business Account locked", mostrar o
   texto em português com o que resolver (cartão/fatura da Business Manager ou revisão da conta) e
   a hora da última confirmação com a Meta.

## Detalhes técnicos

- `check-meta-instance-health`: a auto-liberação já existe e funcionou; vou permitir chamada
  direcionada aos números pausados e agendar uma revalidação curta (10 min) só para instâncias com
  `estado_pool='restrita'` e motivo de bloqueio real, em vez de esperar o ciclo padrão.
- `meta-whatsapp-webhook` (`isMetaInstanceRestrictedError`, tratamento de status `failed`) e
  `_shared/meta-conta-bloqueada.ts` (`tratarContaBloqueada`): antes de gravar
  `estado_pool='restrita'`, consultar `GET /{phone_number_id}?fields=health_status` e só restringir
  quando `can_send_message` for BLOCKED/LIMITED/RESTRICTED em qualquer entidade
  (PHONE_NUMBER/WABA/BUSINESS/APP). Caso contrário, registrar a falha do item e reenfileirar o
  contato sem tirar a instância do rodízio.
- `src/lib/humanizarErroEnvio.ts` e o badge "fora do pool" do card da instância: texto em português
  para #131031 e #131042 com a ação recomendada e `saude_checked_at`.
- Sem mudanças de banco de dados.
