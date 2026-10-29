# Deixar Inbox, Meta Oficial e Acordos da Equipe mais rápidos

## O que encontrei (medido no banco agora)
- O banco teve alerta de leitura de disco esgotada ontem às 19h (orçamento de leitura em 33%). Isso confirma que ele está sobrecarregado por consultas repetidas, não por falta de espaço.
- **Campeã de lentidão: o contador de "não lidas" do menu lateral (Inbox Meta).** Ele roda em toda página para cada funcionário: 44 mil vezes, média de 0,8 s e picos de 8 s. Ele também roda de novo sempre que qualquer conversa muda, em qualquer aba aberta. Cada contagem passa pelas regras de permissão linha por linha.
- **Lista de instâncias ativas:** 52 mil chamadas só para buscar os números ativos antes dessa contagem.
- **Cota das BMs (`meta_bm_uso_24h`):** 240 mil chamadas. Ela recarrega toda vez que alguém volta para a aba.
- **Instâncias para envio:** 27 mil chamadas com média de 0,3 s. São repetidas separadamente em Inbox Meta, Acordos, Acordos da Equipe, Retornos e no painel de reativação.
- **Etiquetas e qualificações dos contatos:** 80 mil e 48 mil chamadas. Já têm índice, mas são buscadas de novo a cada atualização da lista.
- Outras consultas pesadas: busca de templates (1,1 s) e de mensagens por instância (1,4 s).

## O que vou fazer (sem mudar nenhuma regra ou função)
1. **Contador de não lidas em uma única chamada rápida:** troca as duas consultas (instâncias + contagem) por uma função no banco que já aplica as permissões do usuário uma única vez e usa o índice existente. Ela só recalcula 30 s depois da última mudança e somente na aba visível.
2. **Memória compartilhada de "instâncias para envio" e "cota das BMs":** as telas guardam o resultado por 2 minutos e reaproveitam entre si, em vez de cada tela pedir de novo. A cota continua sendo conferida na hora do disparo, então o limite nunca é ultrapassado.
3. **Etiquetas e qualificações:** só são buscadas para contatos novos que aparecem na lista. Os que já foram carregados não são buscados de novo.
4. **Acordos da Equipe:** retirar as contagens exatas de páginas (a contagem total de pagamentos com junção de acordos) e carregar em blocos menores com o total calculado de uma vez no banco.
5. **Medir de novo** as mesmas consultas depois da mudança e comparar os números.

## Custo
Nenhuma dessas mudanças cria rotina automática, consulta periódica ou canal novo. Todas **reduzem** o uso do Lovable Cloud.

Se depois disso a memória do banco continuar acima de 90% nos horários de pico, o próximo passo é aumentar o tamanho do servidor do banco. Isso aumenta o custo mensal, então só faço com a sua confirmação.

## Detalhes técnicos
- Nova RPC `meta_inbox_nao_lidas_count()`, `SECURITY DEFINER`, com o mesmo filtro de acesso de `can_access_meta_folder`/dono da instância. Usa `idx_meta_contatos_nao_lidos_instancia` mais `folder_id is null`. `AppLayout.tsx` passa a chamá-la, com debounce de 30 s.
- Cache em módulo (TTL de 120 s, promise compartilhada) para `get_meta_whatsapp_active_instances_for_sending` e `meta_bm_uso_24h`. O `useBmCotas` ignora o evento de foco se o cache tiver menos de 2 min.
- Cache de etiquetas e qualificações por `contato_id` no `InboxMeta.tsx`, buscando só os ids que ainda faltam.
- `EquipeAcordos.tsx`: substituir `count: 'exact'` com `acordos!inner` por uma RPC de contagem agregada.
