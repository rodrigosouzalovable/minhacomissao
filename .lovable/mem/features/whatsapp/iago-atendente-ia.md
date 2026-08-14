---
name: IAGO — atendente de IA
description: Atendente de IA IAGO na fila do Inbox Meta Oficial: caixas por membership, follow-up único 2h (08-19h), opt-out BLOQUEAR CONTATO, escalada Aguardando Humano, aprendizado automático
type: feature
---

IAGO RIBEIRO DE SOUZA é um usuário real do sistema que atende como humano no Inbox Meta Oficial.

- Atua somente nas caixas em que estiver marcado em "Atendentes desta caixa" (`meta_inbox_folder_members` / `meta_inbox_default_members`) E na conversa que tiver a etiqueta `Atendente: IAGO...`. Conversa de outro atendente ou sem etiqueta: não responde.
- Atendimento 24h/7 dias. Nunca se identifica como IA/robô. Nunca lança acordo.
- Valores sempre calculados pelo sistema (débitos + `meta_ia_config`: desconto à vista, 30% parcelado, grade 2x/4x/8x/12x/16x/20x/24x, parcela mínima R$ 100 — se nenhuma parcela alcança R$ 100, oferece só o à vista). Proposta enviada no mesmo formato da aba Modelo Mensagem (à vista em destaque + lista de parcelas + pergunta final).
- Follow-up: **um único** toque, `followup_horas` (padrão 2h) depois, só entre 08h e 19h BRT e dentro da janela de 24h da Meta. Cliente respondeu = follow-up cancelado.
- Follow-up lê o histórico da conversa: só usa o texto "viu a proposta que te mandei" se valores realmente foram enviados (`contexto.proposta_enviada` ou "R$" em saída). Sem proposta, o texto é gerado pela IA a partir do histórico (retoma o CPF/motivo, cita o credor da caixa) e é cancelado se repetiria algo já enviado.

- "BLOQUEAR CONTATO" (e variações) → `optout=true`, silêncio definitivo, sem follow-up.
- Não sabe responder / assunto proibido / cliente aceitou proposta / já tem acordo → etiqueta "Aguardando Humano", `aguardando_humano=true` e aviso aos contatos de emergência (`meta_ia_contatos_emergencia`).
- Mensagem de atendente humano na conversa desliga o IAGO ali (`send-whatsapp-meta-text` com `origem !== 'ia'`).

Tabelas: `iago_config`, `iago_conhecimento` (instrucao | qa | proibido | aprendizado), `iago_conversa_estado`.
Functions: `iago-atendimento` (chamada pelo `meta-whatsapp-webhook`), `iago-followup-tick` (cron */15 das 11-22 UTC), `iago-aprender` (cron diário 06:30 UTC, resume conversas que viraram acordo).
UI: Usuários > linha do IAGO > "Configurar IAGO" (`src/components/admin/IagoConfigDialog.tsx`), abas Personalidade / Ensinar / Perguntas / Nunca fazer / Aprendizado / Follow-up / Testar.
- Número errado / identidade negada ("não sou o X", "número errado", "é engano", "não conheço"): `ehNumeroErrado` detecta antes de qualquer consulta ou chamada de IA. O IAGO envia só uma mensagem educada de encerramento (sem CPF, sem credor, sem valores), grava `etapa='numero_errado'`, cancela follow-up, marca `aguardando_humano=true` e aplica a etiqueta "Aguardando Humano". Sem aviso no WhatsApp.
