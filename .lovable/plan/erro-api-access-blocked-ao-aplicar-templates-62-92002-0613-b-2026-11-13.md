# Erro "API access blocked" ao aplicar templates (62 92002-0613, BM Shoony)

## O que esse erro significa
"API access blocked" é a Meta recusando o **aplicativo** dono do token, não o número. Acontece quando:
- o app da Meta foi restringido/bloqueado (revisão, violação de política ou app desativado);
- o token foi gerado em um app diferente do que está vinculado à WABA 2579833105760924;
- o usuário de sistema que gerou o token perdeu acesso à WABA ou não tem as permissões `whatsapp_business_management` e `whatsapp_business_messaging`;
- o app está em modo Desenvolvimento.

Trocar só o token não resolve se o problema for o app. Também por isso o card mostra "Webhook com erro".

## Passo 1: diagnosticar este número
- Consultar o histórico de saúde da instância e os registros das funções para ver em qual etapa falhou (verificação de saúde, sincronização ou fila) e o código completo da Meta (código, subcódigo, app).
- Testar o token atual na Meta: a quem ele pertence, qual app, quais permissões e se enxerga a WABA.
- Corrigir o que for do sistema. Se for do lado da Meta, mostrar o passo exato.

## Passo 2: aviso mais específico (canto inferior direito)
O aviso de erro passa a mostrar:
- **Etapa que falhou:** "Verificação da conta", "Sincronização dos templates" ou "Fila de aplicação".
- **Causa em português + o que fazer**, por código da Meta. Exemplos:
  - *API access blocked / código 200 ou 10:* "O app da Meta está bloqueado ou sem permissão. Abra developers.facebook.com → app → Painel e veja se há restrição; confira se o token é do mesmo app e se o usuário de sistema tem as permissões whatsapp_business_management e whatsapp_business_messaging com acesso à WABA."
  - *Código 190 (token expirado/inválido):* "Gere um novo token permanente pelo usuário de sistema."
  - *Código 100 / 33 (WABA ou número não encontrado):* "O ID da WABA ou do número não pertence a esse token."
  - *Código 4 / 80008 (limite):* "Muitas chamadas; aguarde alguns minutos."
  - *Código 368 / 131031 (conta restrita):* "A conta foi restringida pela Meta; veja a Qualidade da conta no WhatsApp Manager."
  - 141006 (pagamento) continua como hoje.
- **Detalhes técnicos copiáveis:** código, subcódigo, ID do app e ID de rastreio da Meta (fbtrace_id), com botão "Copiar".
- O aviso fica até ser fechado, para dar tempo de ler.

## Detalhes técnicos
- As funções de saúde, sincronização e enfileiramento passam a devolver `{ etapa, meta_code, meta_subcode, fbtrace_id, app_id, mensagem }` em vez de só o texto.
- `humanizarErroTemplate` ganha o mapa por código; toast em `ConfigurarMeta.tsx` usa a etapa e um botão de copiar.
- Nenhum novo agendamento ou consulta periódica, sem impacto de custo.
