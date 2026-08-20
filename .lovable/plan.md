# IAGO: quando não é a pessoa procurada, nunca voltar a falar

## O que aconteceu nesta conversa (verificado no banco)

Mensagens do número +55 (77) 99994-1386 hoje:

1. 11:38 (saída) template de confirmação de titularidade
2. 11:39 (entrada) **"Pessoo errada"**
3. 11:40 (saída) "Entendi, obrigado pela atenção e desculpe o incômodo!"
4. 13:45 (saída) "Olá! Estou passando para retomar nosso contato sobre uma pendência financeira..."

A regra de "número/pessoa errada" já existe, mas o texto do cliente veio com erro de digitação (**"Pessoo"** em vez de "Pessoa"), então o detector não reconheceu. Resultado: a resposta das 11:40 foi gerada livremente pela IA (não foi o encerramento oficial), a conversa não foi marcada como encerrada e, duas horas depois, a retomada automática de follow-up disparou a mensagem das 13:45.

## Correções

1. **Detecção tolerante a erro de digitação**: reconhecer variações como "pessoo errada", "pesoa errada", "pessoa erada", "num errado", "nao é essa pessoa", "não é ela/ele", "não conheço essa pessoa", além do que já é reconhecido hoje.
2. **Trava por intenção (não só por texto)**: na resposta do IAGO passa a existir um sinalizador de "não é o titular". Se a IA entender que a pessoa negou ser o titular — mesmo com erro de escrita ou frase incomum — o IAGO envia apenas o encerramento padrão e marca a conversa como `numero_errado`.
3. **Follow-up bloqueado de forma definitiva**: a retomada automática passa a pular qualquer conversa cuja etapa já seja `numero_errado`, `falecido` ou `optout`, sem depender de reler o texto do histórico. Também passa a reconhecer o próprio encerramento já enviado ("desculpe o incômodo") como sinal de conversa fechada.
4. **Não voltar a falar nunca mais**: além de encerrar o follow-up, o telefone entra na lista de supressão de disparos, com a etiqueta "Aguardando Humano" e a qualificação "Não é o Cliente" como já ocorre hoje. Assim campanhas e lembretes futuros também não o incluem.
5. **Correção do caso atual**: marcar esta conversa (77 99994-1386) como encerrada por pessoa errada e suprimi-la, para não receber mais nenhuma retomada.

## Detalhes técnicos

- `supabase/functions/_shared/iago.ts`: ampliar `ehNumeroErrado` (variantes com typo via padrão tolerante `pess?o+a?\s*erra?d[ao]`, `n[ãa]o\s*(e|é)\s*(essa|esta)\s*pessoa`, `nao conheco essa pessoa`, `num(ero)?\s*erra?d`), mantendo a lista de palavras proibidas para evitar falso positivo.
- `supabase/functions/iago-atendimento/index.ts`: incluir no schema JSON da IA o campo `nao_e_titular: boolean`; ao vir `true`, executar o mesmo bloco já existente de `numero_errado` (encerramento padrão + `etapa: 'numero_errado'` + `followup_feito` + etiqueta + qualificação) em vez de enviar o texto livre gerado.
- `supabase/functions/iago-followup-tick/index.ts`: antes de qualquer geração de texto, pular quando `est.etapa in ('numero_errado','falecido','optout')` ou quando alguma saída recente contiver o encerramento padrão; manter a verificação por histórico como reforço.
- Supressão: inserir o telefone em `meta_destinatario_supressao` (motivo `pessoa_errada`) no momento do encerramento.
- Ajuste de dados pontual: atualizar `iago_conversa_estado` do contato e inserir a supressão do número citado.
- Sem novos crons, polling ou Realtime — nenhum impacto de custo.
