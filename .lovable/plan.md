# Ver instâncias usadas x ignoradas na campanha

Hoje o painel da campanha só mostra o aviso "4 instância(s) ignorada(s) automaticamente após falhas consecutivas", sem dizer quais. A campanha guarda a lista de instâncias selecionadas e as listas de ignoradas, mas apenas como identificadores internos — nenhum nome é exibido.

## O que será adicionado

Um bloco recolhível **"Instâncias do disparo"** dentro do diálogo de detalhes da campanha, logo abaixo dos avisos amarelos, com duas listas:

- **Ativas (enviando)** — nome do número, BM, qualidade atual e quantos envios/erros essa instância já fez nesta campanha. A instância em uso no momento fica destacada.
- **Ignoradas** — nome do número + motivo: "falhas consecutivas" ou "template pausado pela Meta".

O aviso amarelo atual ganha um link "ver quais" que abre esse bloco já expandido.

Para o admin, cada instância ignorada por falhas consecutivas terá o botão **"Voltar para a campanha"**, que a remove da lista de ignoradas para que ela volte a receber envios (útil quando a falha foi temporária).

Os dados são buscados só quando o bloco é aberto e ao clicar em "Atualizar" — sem novo polling nem custo recorrente de banco.

## Detalhes técnicos

- Nova ação `instancias_status` na Edge Function de controle do envio (`envio-meta-controle`): recebe o `job_id`, lê `instancia_ids`, `instancias_bloqueadas_run`, `instancias_bloqueadas` e `atual_instancia` do job, junta com `meta_whatsapp_instances` (nome, BM, qualidade) e agrega contagens por `instancia_nome` em `envio_meta_job_item` (enviado/erro) apenas para esse job.
- Ação `desbloquear_instancia_run` na mesma função: retira o id de `instancias_bloqueadas_run` (somente admin).
- `EnvioMetaSendingContext`: expõe `listarInstanciasStatusJob(jobId)` e `reativarInstanciaJob(jobId, instanciaId)` seguindo o padrão de `listarInstanciasLivres`.
- UI: novo componente `src/components/meta/CampanhaInstanciasPanel.tsx` usado por `CampanhaDetalheDialog.tsx`; estado local de carregamento, sem intervalos.
