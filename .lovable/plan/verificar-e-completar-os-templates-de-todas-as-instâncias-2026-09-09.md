# Verificar e completar os templates de todas as instâncias

## O que muda na aba API Oficial Meta

Um botão novo no topo: **Verificar templates de todas as instâncias** (visível só para o administrador).

Ao clicar, o sistema:

1. Pega a lista de modelos marcados como **"Injetar em números novos"** na aba Templates Meta (campo Aplicar em lote).
2. Percorre os seus números da API Oficial (não inclui números de parceiros nem os espelhos do WhatsApp comum).
3. Ignora números com qualidade **amarela ou vermelha**, desconectados, com nome reprovado, banidos, restritos ou com pendência de pagamento.
4. Compara, número por número, quais desses modelos já existem e quais estão faltando.
5. Mostra um resumo antes de agir: quantos números foram verificados, quantos estão completos, quantos estão ignorados (com o motivo) e a lista de números com a quantidade de modelos faltando.
6. Com a confirmação, cria a fila de injeção dos modelos faltantes para cada número.

## Como a injeção acontece

Usa exatamente o ritmo seguro que já existe hoje:

- Um modelo por vez, com intervalo aleatório de 15 a 25 minutos.
- Somente das 09h às 18h (horário de Brasília) e nunca no domingo.
- Se o dia acabar antes de terminar, continua no dia seguinte automaticamente.
- Pausa automática do número após duas reprovações seguidas ou bloqueio/limite da Meta.
- Avisos no seu WhatsApp (62991672674): início, reprovação, pausa e conclusão.
- Nada é reenviado se o modelo já existir no número.

O card de cada número continua mostrando o selo de progresso ("templates: 7/22") e o motivo da pausa quando houver.

## Detalhes técnicos

- Nova Edge Function `meta-templates-auditar-instancias`:
  - Auth: exige `has_role(admin)`.
  - Seleciona instâncias em `meta_whatsapp_instances` com `provider='meta'`, próprias (sem vínculo de parceiro), conectadas/aprovadas; exclui qualidade `YELLOW`/`RED` e os bloqueios reais já usados hoje (banimento, restrição, cobrança, nome reprovado).
  - Lê `meta_templates_mestre` com `injetar_em_novos = true` e `meta_templates_instancia` para calcular o que falta por instância.
  - Modo `dry_run: true` retorna só o relatório; sem `dry_run`, insere em `meta_templates_onboarding_fila` (`upsert` com `onConflict: instancia_id,template_mestre_id`, `ignoreDuplicates`) e marca `templates_auto_copiar/templates_auto_status/templates_auto_iniciado_em` nas instâncias com pendência.
  - Reaproveita `notificarAdmin` para o aviso de início consolidado (um resumo, não um por número).
- `supabase/functions/meta-templates-onboarding-tick/index.ts`: sem mudança de regra — já respeita `sem_limite_diario`, intervalo 15–25 min, janela 09h–18h e domingo.
- `src/pages/ConfigurarMeta.tsx`: botão + dialog de relatório (tabela número / faltando / status), botão "Iniciar injeção dos faltantes", `refetch` da fila para atualizar os selos.
