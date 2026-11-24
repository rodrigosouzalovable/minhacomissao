# Respeitar "Enviar para todos" em contatos repetidos

## O que acontece hoje
Quando o Tiago escolhe "Enviar para todos" na janela de contatos repetidos, a campanha é criada com eles — mas, no momento do envio, uma segunda proteção (a "trava diária": 1 mensagem de campanha por telefone por dia) recusa esses números. Por isso aparecem as falhas "Telefone já recebeu mensagem hoje (trava diária)" na tela.

## Correção
- Gravar na campanha que o usuário autorizou reenviar para repetidos.
- No envio (normal e rajada), quando a campanha tiver essa autorização, pular a trava diária para os contatos dela.
- Campanhas automáticas (carteira SFTP, recuperação, lembretes, USA/B2B) continuam com a trava, pois não passam por essa escolha.
- Blacklist, supressão "sem WhatsApp", bloqueio de domingo e limites de instância continuam valendo.
- Depois da correção, o botão "Tentar novamente (39)" da campanha atual passa a enviar esses contatos.

## Detalhes técnicos
- Migration: coluna `permitir_reenvio_recente boolean default false` em `envio_meta_job`.
- `envio-meta-massa-iniciar`: salvar `permitirReenvioRecente` na coluna ao criar o job.
- `envio-meta-massa-tick` e `envio-meta-massa-burst`: repassar `ignorar_trava_diaria: job.permitir_reenvio_recente` ao handler.
- `_shared/send-whatsapp-meta-handler.ts`: `aplicaTrava` passa a ser falso quando `ignorar_trava_diaria === true`.
- Para a campanha do print (já criada), marcar a coluna como true para o retry funcionar.
- Atualizar a regra em `supabase/functions/AGENTS.md` sobre a trava diária; reimplantar as 3 funções.
