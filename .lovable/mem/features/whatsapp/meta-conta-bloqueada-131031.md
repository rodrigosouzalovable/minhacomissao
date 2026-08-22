---
name: Meta Business Account bloqueada (#131031)
description: Erro #131031 restringe a instância no pool, avisa admin 1x/dia e libera sozinho na revalidação; qualidade RED/YELLOW nunca bloqueia resposta na janela de 24h
type: feature
---

- Erro `#131031 – Business Account locked` é bloqueio real da Meta: nenhum envio passa naquele número, nem resposta na janela de 24h. Não confundir com qualidade RED/YELLOW.
- Ao detectar (`_shared/meta-conta-bloqueada.ts`) nos envios de texto/mídia: `estado_pool='restrita'`, `pausa_automatica_motivo='Business Account locked'`, pausa 24h e aviso ao admin idempotente por dia.
- `check-meta-instance-health` faz auto-liberação: se a instância estava pausada por bloqueio real (locked/NUMERO_INACESSIVEL) e a Graph volta CONNECTED sem `ban_info`, devolve ao pool (`estado_pool='ativo'`, pausa limpa) e avisa o admin.
- Botão "Revalidar na Meta" no card da instância força esse diagnóstico manualmente.
- Banner do Inbox (`MetaInstanceHealthBanner`) mostra o bloqueio real com prioridade sobre o aviso de qualidade; qualidade baixa segue apenas informativa.
