# Validação de WhatsApp durante o envio, usando todos os números da UAZAPI

## Por que a validação de 3 mil números falha hoje

A validação usa **um único** número UAZAPI escolhido na tela. Ele checa a lista em lotes de 15, um pouco por vez; com quase 3 mil números o processo estoura o tempo limite da checagem e volta com erro, sem terminar.

## O que muda

### 1. Validação durante o envio (novo padrão)
- Ao importar a planilha, escolher a campanha e a caixa e clicar em **Disparar**, o envio começa na hora, sem validar antes.
- Enquanto a campanha roda, o sistema vai validando os próximos contatos da fila em blocos, um pouco à frente do envio.
- Quem não tem WhatsApp é marcado como **sem WhatsApp** e nunca recebe mensagem (não conta como erro nem consome cota da Meta).
- Se a validação falhar por instabilidade, o contato segue para envio normal (nunca trava a campanha).
- Interruptor **"Validar WhatsApp durante o envio"**, ligado por padrão, com opção de desligar.

### 2. Validação usa todos os números conectados da UAZAPI
- Sai a escolha de um número validador; entra o uso automático de **todas as instâncias UAZAPI conectadas**, dividindo a lista entre elas em paralelo.
- Isso deixa a checagem várias vezes mais rápida e evita o estouro de tempo com listas grandes.
- Se nenhuma UAZAPI estiver conectada, o envio continua sem validação e aparece um aviso.

### 3. Botão "Validar agora" continua existindo
- Mantido para quem quer checar antes e **baixar a planilha só com quem tem WhatsApp**.
- Passa a rodar sobre todas as UAZAPI conectadas, em blocos, com barra de progresso (X de Y checados), suportando listas de milhares.
- Continua com "Remover sem WhatsApp" e "Baixar Excel (com WhatsApp)".

### 4. Remoção do campo "Credor desta campanha"
- O seletor sai da tela de Envio Meta.
- O credor vindo da coluna da planilha continua funcionando igual (cabeçalho da conversa no Inbox e roteamento de template por credor).

## Detalhes técnicos

- Nova Edge Function `uazapi-validar-numeros`: recebe apenas a lista de números; carrega as instâncias UAZAPI ativas, filtra as conectadas (`/instance/status`), distribui os lotes de 15 entre elas em paralelo (limite de concorrência por instância) e devolve `valid`/`invalid`/`errors`. Reaproveita a lógica de retry de `check-whatsapp-numbers`, que passa a ser wrapper legado.
- Frontend `src/pages/EnvioMeta.tsx`: `validarAgora` chama a nova função em blocos de ~500 números com progresso; remove `validadorId`/seletor e o bloco de validação bloqueante dentro de `enviar`; remove o campo Credor (mantém `credorByTel`).
- Migração: `envio_meta_job.validar_no_envio boolean default true`; `envio_meta_job_item.wa_validado text` (`null`/`sim`/`nao`/`erro`) + índice parcial por `job_id, status`. GRANTs iguais aos das tabelas atuais.
- `envio-meta-massa-iniciar`: grava `validar_no_envio`; mantém o restante.
- `envio-meta-massa-tick`: antes de reservar o item, se `validar_no_envio` e o item ainda não tem `wa_validado`, valida um lote dos próximos ~30 pendentes via `uazapi-validar-numeros` e grava o resultado; itens `nao` viram status `sem_whatsapp` (contabilizados à parte, sem chamar a Meta). Sem UAZAPI conectada, marca `erro` e segue o envio.
- `CampanhaDetalheDialog.tsx`: contador "sem WhatsApp" na campanha, com lista/exportação junto dos demais grupos.
- Custo: a validação passa a acontecer no mesmo tick já existente (sem novo cron nem polling extra); o volume de chamadas à UAZAPI é o mesmo, apenas distribuído.
