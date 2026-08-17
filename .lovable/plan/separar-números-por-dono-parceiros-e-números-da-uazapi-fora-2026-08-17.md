# Separar números por dono: parceiros e números da UAZAPI fora da sua visão Meta

Hoje o seu login (admin) vê **todos** os números na aba **API oficial Meta**: os 26 números oficiais (incluindo os 4 de parceiros — 3 AMARAL do Thiago Nogueira e 1 "agropet" do Guilherme) e também os 12 espelhos dos números conectados na UAZAPI pela aba Acionamento. Isso acontece porque a regra atual libera tudo para admin.

## O que muda

1. **Aba API oficial Meta (sua)**
   - Deixa de listar os 12 espelhos dos números da UAZAPI (Acionamento). Eles continuam funcionando normalmente na caixa AQUECIMENTO do Inbox.
   - Deixa de listar números vinculados a parceiros (Thiago Nogueira, Guilherme e futuros com a tag "Parceiro Meta").
   - Resultado: só aparecem os números oficiais que **você** cadastrou.

2. **Inbox Meta Oficial (você e seus funcionários)**
   - Na caixa **Padrão** e no botão **Nova Conversa**, os números de parceiros deixam de aparecer na lista de instâncias.
   - Os números da UAZAPI continuam aparecendo apenas dentro da caixa AQUECIMENTO (é onde o IAGO atende), e ficam fora do **Nova Conversa** (que exige template HSM oficial).

3. **Parceiros continuam como estão**: cada parceiro só vê os números dele. Nada de novo é liberado para eles.

4. **Envio Meta**: os números de parceiros e os espelhos UAZAPI ficam fora da sua seleção de disparo oficial, evitando erro de template/qualidade.

## Detalhes técnicos

- Nova função `is_instancia_parceiro(uuid)` (security definer) = existe linha em `meta_instance_parceiros` para a instância.
- `pode_ver_instancia_meta(_uid, _instancia)`: no ramo admin e no ramo "demais usuários", passa a exigir `NOT is_instancia_parceiro(_instancia)`. O ramo parceiro continua igual.
- `get_meta_whatsapp_active_instances_for_sending()`: sem mudança de assinatura — passa a herdar o filtro acima (usado pelo Inbox).
- Políticas de SELECT/UPDATE de `meta_whatsapp_instances` para admin/tenant: acrescentar `NOT is_instancia_parceiro(id)` para que a listagem direta na aba API oficial Meta também respeite a regra (parceiro mantém suas políticas próprias).
- `ConfigurarMeta.tsx`: a consulta de instâncias filtra `provider = 'meta'` (exclui espelhos UAZAPI) — a exclusão de parceiros vem do banco.
- `EnvioMeta.tsx`: carregamento de instâncias filtra `provider = 'meta'`.
- `MetaNovaConversaDialog` (via `InboxMeta.tsx`): a lista passada ao diálogo exclui instâncias `provider = 'uazapi'`; para isso a RPC do Inbox passa a retornar também a coluna `provider`.
- Nada de novo cron, polling ou canal Realtime — sem impacto de custo no Lovable Cloud.
