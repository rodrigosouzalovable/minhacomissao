# Exclusão de instância pelo Thiago (sem travar e sem perder conversas)

## O que foi encontrado
- A exclusão agora é autorizada, mas apagar o número leva junto **todo o histórico dele**: no AMRAL 62 8277-6427 são 8.135 mensagens, 3.413 conversas, 3.669 envios e 2.428 custos. Essa limpeza em cascata passa do tempo limite do banco, por isso o erro "statement timeout".
- Mesmo se passasse, apagaria conversas em que o cliente respondeu, o que as regras do Inbox proíbem.

## O que será feito
1. **Excluir = retirar o número do sistema, preservando o histórico.** Ao confirmar, o número:
   - some da lista da aba API Oficial Meta;
   - fica desativado e sai de campanhas, lembretes, rodízio, aquecimento e recuperação;
   - mantém as conversas, mensagens, custos e acordos já registrados.
2. **Quem pode excluir:** o próprio Thiago (ou qualquer usuário) apenas os números que ele mesmo cadastrou; o admin global pode excluir qualquer um. Número de outra pessoa mostra "Você só pode excluir instâncias que cadastrou".
3. **Recadastrar depois:** se o mesmo número for conectado de novo, o cadastro antigo é reaproveitado e volta a aparecer, sem erro de duplicidade.
4. A exclusão passa a responder na hora, sem tempo limite.

## Detalhes técnicos
- Migração: colunas `excluida_em timestamptz`, `excluida_por uuid` em `meta_whatsapp_instances`; RPC `excluir_meta_instancia(_id)` SECURITY DEFINER verificando `user_id = auth.uid()` ou `has_role(admin)`, que define `ativo=false`, `status` desconectado, `recuperacao_ativa=false`, `aquecimento_meta_ativo=false`, `excluida_em=now()`, e marca `meta_instance_parceiros`/vínculos de campanha ativos como encerrados.
- `ConfigurarMeta.tsx`: `excluir` chama a RPC; listagens filtram `excluida_em IS NULL`. Cadastro de número existente (mesmo `phone_number_id`) limpa `excluida_em`.
- Envios/rotinas já exigem `ativo=true`; conferir os seletores de instância do Envio Meta e do Inbox que não usam `ativo` e adicionar o filtro `excluida_em IS NULL`.
- Revogar DELETE direto de `authenticated` em `meta_whatsapp_instances` (concedido no ajuste anterior), para que nenhum caminho apague histórico em cascata.
- Sem custo novo.
