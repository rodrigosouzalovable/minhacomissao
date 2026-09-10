# Antirrepetição: de 7 dias para 1 dia

Hoje, ao iniciar uma campanha, o sistema ignora números que já receberam mensagem nos últimos **7 dias**. Vou mudar esse padrão para **1 dia** — ou seja, só bloqueia quem recebeu mensagem ontem/hoje.

## O que muda

1. **Novo padrão de 1 dia**
   - A configuração global (`antirrepeticao_dias`) passa de 7 para 1 via atualização no banco.
   - Os fallbacks no código (página Envio Meta e função de início de campanha) passam de 7 para 1, para o padrão valer mesmo se a configuração estiver ausente.

2. **Textos acompanham sozinhos**
   O aviso de confirmação ("N contatos já receberam mensagem nos últimos X dia(s)") e o bloco "Ignorados por envio recente" já leem o valor configurado, então passam a mostrar 1 dia automaticamente.

3. **Sem mudança de comportamento além do tempo**
   Continua valendo: o bloqueio impede o disparo se a lista inteira cair na regra, o aviso de lista repetida na importação e o registro dos ignorados em Ver Detalhes.

## Detalhes técnicos

- `UPDATE public.meta_envio_pool_config SET antirrepeticao_dias = 1 WHERE id = 1;`
- `src/pages/EnvioMeta.tsx`: fallback `?? 7` → `?? 1` na leitura de `antirrepeticao_dias`.
- `supabase/functions/envio-meta-massa-iniciar/index.ts`: fallback `?? 7` → `?? 1`; republicar a função.
- Custo: neutro — mesma consulta, janela menor (tende a ser mais barata).
