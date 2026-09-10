# Templates só de utilidade + aquecimento intensivo com leads do Google Maps

## 1. Nada de variável com nome — só número

- Ao criar/editar template mestre, só é aceito `{{1}}`, `{{2}}`... Se o texto tiver `{{nome}}`, aparece aviso em vermelho com botão para converter automaticamente e o salvar fica bloqueado.
- A injeção em lote e a auditoria também recusam qualquer modelo com variável nomeada, antes de mandar para a Meta (é o motivo real de várias reprovações anteriores).
- No disparo, a montagem da mensagem passa a usar só variáveis numeradas.

## 2. Se a Meta virar o template para MARKETING, o sistema para

- Ao verificar o status na Meta, se a categoria voltar como MARKETING o modelo é marcado como "reclassificado para marketing": sai de "injetar em números novos", sai de "usar no aquecimento de leads", os itens pendentes na fila são cancelados e você recebe um aviso no WhatsApp (62991672674).
- O aquecimento e a injeção passam a aceitar exclusivamente categoria UTILITY, tanto pelo cadastro daqui quanto pela categoria que a Meta devolve.

## 3. BM ao lado de cada número

Na aba Templates, em "Ver detalhes por instância", e no painel de progresso da injeção, cada linha passa a mostrar o nome da BM vinculada ao número, com atalho para abrir a BM. Assim a falha fica identificada na hora.

## 4. Por que a mensagem do NeoPets ficou com bolinha vermelha

Verificado no banco: o envio saiu pelo número **SOUZA 62 8269-3405**, da BM **BM Rodrigo Ribeiro (Facebook Avatus)**, e a Meta recusou com **"Business Account locked (#131031)"** — a BM está bloqueada, então a mensagem não chegou. Nas últimas horas praticamente todas as falhas de aquecimento são esse mesmo erro, na mesma BM.

O que muda:
- Ao receber #131031, todos os números daquela BM saem do aquecimento na hora (pausa até a BM ser liberada), em vez de continuar consumindo tentativas e leads.
- O lead usado numa tentativa que falhou volta para a fila (hoje ele fica marcado como usado e só volta depois de 15 dias).
- Aviso único no WhatsApp com o nome da BM bloqueada e quantos números foram afetados.
- Regularizar a BM no lado da Meta continua sendo por sua conta; assim que liberar, o sistema volta a usar os números sozinho.

## 5. Nome da empresa: só o primeiro nome

Na hora do disparo, "NeoPets Veterinária e Petshop" passa a virar apenas "NeoPets". Regra: primeira palavra significativa do nome, ignorando prefixos genéricos (Clínica, Dr., Dra., Consultório, Petshop, Loja, Casa, Auto, Studio, Espaço) — nesses casos usa as duas primeiras palavras para não ficar sem sentido. Fica com inicial maiúscula e sem sufixos tipo LTDA/ME/CNPJ.

## 6. Aquecimento intensivo com `lead_followup_sem_resposta` — 1.300 em 3 dias

- Assim que esse modelo aparecer como aprovado num número marcado como "nova BM", o aquecimento começa a usá-lo imediatamente para leads do Google Maps, sem esperar o planejamento do dia seguinte.
- Novo modo intensivo por número: alvo de ~450 destinatários únicos por dia (1.300 em 3 dias), respeitando janela 08h–19h BRT, sem domingo, e teto de 60% do tier.
- Para dar conta do volume, cada rodada do motor passa a enviar em lotes (em vez de 5 por rodada), com intervalo curto e aleatório entre mensagens e limite por número por hora.
- Escada de tier acompanhada e mostrada no painel: 250 → 1k → 10k → 100k → ilimitado, com quantos únicos faltam para o próximo degrau.
- Estoque de leads é reposto automaticamente quando cai abaixo do necessário para o ritmo do dia.

## 7. Aprender quem responde e ir para onde responde

- Placar por nicho/cidade passa a ser recalculado várias vezes ao dia (não só à noite), com taxa de resposta, resposta em até 2 minutos e reclamações.
- Nichos campeões recebem prioridade crescente na fila; nichos sem nenhuma resposta em N envios saem da fila do dia.
- Novo gatilho de correção de rota: se numa janela de 30 minutos a taxa de resposta dos leads ficar abaixo do mínimo, o motor troca a fila para os nichos com melhor histórico e aumenta a proporção de números próprios da UAZAPI (resposta garantida) até a taxa voltar a subir.
- Buscas novas no Google Maps ficam concentradas nos nichos com melhor score, respeitando o limite mensal de consultas já existente.

## Detalhes técnicos

Banco:
- `meta_templates_mestre`: `reclassificado_marketing boolean`, `categoria_meta text`.
- `meta_aquecimento_trilha`: `modo_intensivo boolean`, `alvo_unicos_dia` usado pelo modo intensivo.
- `meta_whatsapp_instances`: reaproveita `pausa_automatica_ate` para pausa por BM bloqueada.
- `aquecimento_nicho_score`: `atualizado_em` já existe; passa a ser gravado a cada recálculo intradiário.

Backend:
- `_shared/meta-aquecimento-alvo.ts`: filtro UTILITY em `escolherTemplateLead`, recusa de variável nomeada, `primeiroNomeEmpresa()` aplicada em `renderTemplateBody` e `enviarTemplateAquecimento`.
- `meta-aquecimento-tick`: lotes por rodada, pausa por BM em #131031, devolução do lead na falha, reordenação por score de nicho e correção de rota por taxa de resposta.
- `meta-aquecimento-planejar`: modo intensivo (450/dia) para números marcados como nova BM.
- `meta-verificar-status-templates` / `meta-templates-auditar-instancias` / `meta-criar-template-lote` / `meta-templates-onboarding-tick`: bloqueio de MARKETING e de variável nomeada, cancelamento da fila e aviso.
- `meta-aquecimento-aprender`: recálculo intradiário do score.
- Frontend: `MetaTemplates.tsx` (validação de variável, BM por linha, selo de reclassificado), `TemplatesInjecaoProgresso.tsx` (BM por linha).

## Aviso de custo (Lovable Cloud)

O modo intensivo aumenta o volume de escrita no log de aquecimento e faz o motor rodar com lotes maiores; o recálculo de nichos passa de 1x/dia para algumas vezes ao dia (sem cron novo, de carona no tick existente). Impacto de infraestrutura moderado. O custo relevante continua sendo o da Meta: ~1.300 mensagens de utilidade por número em 3 dias ficam acima do teto atual de R$ 50/dia — o teto diário precisa ser elevado (sugestão R$ 120/dia durante o teste) ou o motor para no meio do caminho. Confirme o teto que devo usar.
