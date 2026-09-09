# Resgate de engajamento com contatos do Google Maps

Quando uma instância cai a taxa de resposta durante a campanha, o sistema passa a conversar com contatos do Google Maps (empresas que respondem sozinhas), sobe a taxa de resposta e devolve o número à campanha — sem você fazer nada.

## Situação de hoje (verificada)

- O sistema já freia números com resposta baixa: os 8 números do print saíram da campanha com 0% de resposta.
- Já existe um motor de aquecimento que pode mandar mensagem para contatos do Google Maps, mas ele está configurado para usar **100% números da UAZAPI e 0% contatos do Maps**.
- Já existe aprendizado por nicho/cidade (veterinário, consultoria, barbearia estão pontuados) e um cadastro de leads: 402 empresas, 349 com telefone, **160 com WhatsApp confirmado e ainda não usadas**.

Ou seja: a base existe, mas o resgate nunca entra em ação com contatos do Maps e a lista não se reabastece sozinha.

## O que vai passar a acontecer

1. **Gatilho automático.** Quando a resposta de um número cai abaixo do limite (o mesmo que hoje já freia a campanha), ele entra em "resgate": continua na campanha em ritmo reduzido e, em paralelo, começa a mandar mensagens para contatos do Google Maps.
2. **Escolha inteligente dos contatos.** Prioriza nichos e cidades com melhor histórico de resposta rápida, evita repetir empresa (carência de 15 dias) e nunca usa quem está na blacklist.
3. **A lista se reabastece sozinha.** Quando sobram poucos contatos com WhatsApp confirmado, o sistema busca novas empresas no Google Maps nos melhores nichos, confere quem tem WhatsApp e guarda.
4. **Base de "quem responde".** Toda resposta recebida marca aquela empresa e aquele nicho como bom; quem nunca responde ou reclama vai perdendo prioridade e o nicho pode ser bloqueado. A cada dia a escolha fica melhor.
5. **Saída do resgate.** Quando a taxa de resposta volta ao patamar saudável, o número sai do resgate e volta ao volume normal da campanha, com aviso no seu WhatsApp (62991672674).
6. **Segurança.** Só das 08h às 19h, nunca domingo, um contato por vez com intervalo aleatório, respeitando a cota real da Meta e parando na hora em caso de bloqueio/pendência da Meta. Disponível apenas para o seu login de administrador.

## Aviso de custo (Lovable Cloud + Google Maps)

Esta função aumenta custo em três frentes e precisa da sua confirmação:

- **Mensagens Meta extras**: cada mensagem de resgate é cobrada como conversa (estimativa: 20 a 40 mensagens por número em resgate por dia).
- **Google Maps**: cada reabastecimento faz buscas pagas. Vou limitar a 1 reabastecimento por dia e no máximo 60 empresas por vez.
- **Banco/execuções**: o resgate roda de carona no tick que já existe (a cada 2 minutos, 07h–20h), sem criar cron novo, para não somar custo.

## Detalhes técnicos

- `meta-engajamento-guardiao`: ao rebaixar a faixa, cria/atualiza `meta_aquecimento_trilha` com `mix_leads_pct` progressivo (30% na faixa 60%, 60% na faixa 30%, 100% quando removida da campanha) e grava `motivo='resgate_campanha'`; hoje ele fixa `mix_leads_pct: 0`.
- `meta-aquecimento-tick`: passa a considerar trilhas de resgate mesmo com a instância em campanha; seleção de leads ordenada por `aquecimento_nicho_score.score`, `usado_aquecimento_em is null or < now()-15d`, `tem_whatsapp = true`, exclusão por `meta_destinatario_supressao`.
- Nova função `google-maps-leads-abastecer`: dispara quando o pool de leads com WhatsApp e sem uso recente cai abaixo de 80; escolhe os melhores nichos/cidades não bloqueados, chama `google-maps-buscar-leads` + `google-maps-verificar-whatsapp`, deduplica por telefone (sufixo de 8 dígitos).
- `meta-aquecimento-aprender`: além do score por nicho, grava por lead em `google_maps_leads.resultado_aquecimento` (respondeu / não respondeu / tempo), realimentando a prioridade.
- Migração: colunas de resgate em `meta_aquecimento_trilha` (`motivo`, `origem_campanha_id`) e índices para a seleção de leads; GRANT + RLS admin-only, mantendo o padrão atual.
- Relatórios de 12h e 18h ganham bloco "Resgate de engajamento": números em resgate, mensagens enviadas, respostas obtidas, quem voltou à campanha.
