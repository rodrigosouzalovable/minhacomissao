# Cancelar acordo quebrado na UME (Adalberto) e evitar repetição

## O que encontrei
- Cliente **Adalberto Moreira dos Santos Junior** (CPF 118.728.186-76), acordo de teste feito hoje às 13:14 pelo portal: Odres Cred, 12x, total R$ 1.210,00, acordo UME nº 326174.
- No nosso sistema ele continua **ativo**. Hoje o sistema só fica sabendo de quebra na UME quando alguém marca manualmente — não existe aviso automático da UME.

## 1. Correção imediata
- Marcar esse acordo como **quebrado** no sistema (sem apagar nada, histórico preservado).
- Com isso, a consulta no portal volta a mostrar a dívida em aberto e não as parcelas do acordo.
- Conferir depois a consulta do CPF no portal.

## 2. Evitar que aconteça de novo
- Verificar se a UME permite consultar a situação de um acordo pelo número (ex.: 326174).
- Se permitir: quando o cliente consultar o CPF no portal, ou alguém abrir o acordo, o sistema confere na UME e, se estiver **Quebrado/Cancelado** lá, marca como quebrado aqui automaticamente. Só por ação do usuário, sem rotina periódica (sem custo extra contínuo).
- Se não permitir: adicionar no acordo um botão para admin **"Quebrado na UME"**, que marca como quebrado com registro de quem fez.

## Detalhes técnicos
- Passo 1: `UPDATE acordos SET status='quebrado'` em `94c3c199-f9a3-4061-95e8-20f51c26bdb8`, via run_sql.
- Passo 2: testar `GET /renegotiations/326174` (só leitura) com `_shared/ume-api.ts`; o id UME já fica em `ume_acordo_api_log.resposta.id`. Status diferente de DUE/PAID e vindo como quebrado/cancelado → status `quebrado`; resposta inconclusiva nunca altera nada.
