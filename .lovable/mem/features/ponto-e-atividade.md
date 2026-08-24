---
name: Controle de Ponto e Atividade
description: Ponto 4x/dia restrito por IP do escritório, bloqueio total até bater entrada, monitor de inatividade 10min e relatório admin-only
type: feature
---

# Controle de Ponto e Atividade

- 4 marcações diárias: entrada, saida_almoco, volta_almoco, saida (`ponto_registros`, único por user/dia/tipo).
- Registro somente via edge function `ponto-registrar` (service role): valida JWT, IP (`ponto_ips_autorizados`, IP exato ou CIDR IPv4), ordem das marcações e grava horário do servidor em BRT. Admin é isento da restrição de IP.
- IP do escritório é cadastrado pelo painel admin (`/admin/ponto` → Redes) com botão "Autorizar o IP atual" (`ponto-ip-autorizar`). Nunca tentar "descobrir" o IP do escritório de outra forma.
- `PontoGate` (dentro do AppLayout) bloqueia TODO o sistema para funcionário até bater a entrada; também bloqueia enquanto `saida_almoco` sem `volta_almoco`. Admin e gestor nunca são bloqueados.
- `useAtividadeMonitor` + `InatividadeFlutuante`: após 10 min sem interação mostra cronômetro flutuante global e grava janela em `atividade_inatividade`. Heartbeat no máximo 1x/min e nada com aba oculta (economia).
- Relatório, presença ao vivo (RPC `presenca_ao_vivo`), redes e jornadas só para admin em `/admin/ponto`. Funcionário só vê as próprias marcações.
- Crons: `ponto-alerta-manha` 12:15 UTC (09:15 BRT) e `ponto-alerta-noite` 21:30 UTC (18:30 BRT) → `ponto-alertas-diarios` avisa 62991672674; domingo é ignorado.
