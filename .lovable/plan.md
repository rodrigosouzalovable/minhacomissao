# Aquecimento de números RED/YELLOW: avisos no WhatsApp e escopo restrito

## Situação atual (verificada agora)

- O aquecimento automático **está funcionando**. Hoje há 6 números em RED, todos com recuperação ligada, e ontem (27/08) foram **134 mensagens** de aquecimento enviadas com sucesso, 11 a 14 por número.
- O motor roda a cada 10 minutos (`meta-recuperacao-tick`), das 09h às 19h BRT, nunca no domingo, com intervalo de 20–40 min por número, no máximo 2 conversas por destino/dia. Hoje é 07:56 — por isso ainda não há envios do dia.
- A checagem de qualidade roda a cada 2 horas e hoje já avisa você quando: a qualidade cai, o número volta a GREEN por 3 dias, a Meta pausa o número, um bloqueio é liberado e quando a recuperação é interrompida por erro fatal.
- O que **falta** é justamente o que você pediu: aviso quando o aquecimento do dia começa, acompanhamento de quantas mensagens já foram enviadas e o que foi feito, e restrição para que isso valha só nos seus números.
- Hoje nenhum dos números em recuperação é de parceiro, mas o motor não tem nenhuma trava: se um parceiro Meta cadastrar um número e ele cair de qualidade, ele entraria no aquecimento automático.

## O que será implementado

### 1. Aviso de início do aquecimento (por número, 1x por dia)
Na primeira mensagem de aquecimento de cada número no dia, chega no seu WhatsApp:

```text
🔥 Aquecimento iniciado — SOUZA 62 8269-3405
BM: <nome da BM>
Qualidade: RED · dia 2 de recuperação
Meta de hoje: 14 mensagens (intervalo 20–40 min, 09h–19h)
Destino: números UAZAPI da caixa AQUECIMENTO (o IAGO responde tudo)
Fora das campanhas até 03/09 (quarentena)
```

### 2. Resumo de progresso às 13h e às 18h BRT
Um único WhatsApp com todos os números em recuperação:

```text
📈 Aquecimento de qualidade — 13:00
SOUZA 62 8269-3405 · RED · 7/14 hoje · 0 falhas · 6 respostas recebidas · 2 dias em recuperação
SOUZA 62 8269-9096 · RED · 6/12 hoje · 1 falha (template) · 5 respostas
...
Total: 34 enviadas hoje · 28 respondidas · nenhuma parada
Nenhum número atingiu 3 dias em GREEN ainda.
```

### 3. Aviso de qualquer mudança de estado
Além dos avisos que já existem, passa a avisar também:
- número entrou em aquecimento (com o motivo da queda e o volume das últimas 24h);
- meta do dia concluída (“14/14 enviadas, todas respondidas”);
- avanço no caminho de volta: 1º, 2º e 3º dia em GREEN, e o retorno ao pool com o teto da escada (20 → 40 → 80/dia);
- piora durante a recuperação (RED depois de YELLOW) e a redução automática do volume para 5/dia;
- falhas repetidas (3 seguidas no mesmo número) e recuperação interrompida.

Todos com controle de repetição — no máximo um aviso por número, por tipo, por dia.

### 4. Restrição aos seus números
- Novo campo por instância: **aquecimento de qualidade permitido** (ligado por padrão nas suas instâncias, desligado em qualquer instância vinculada a parceiro Meta).
- O motor de aquecimento e a checagem de qualidade passam a só ligar a recuperação em instâncias permitidas e sem vínculo de parceiro. Números de parceiros continuam com quarentena e freio (proteção), mas sem aquecimento automático e sem gerar avisos para você.
- No painel “Recuperação automática de qualidade” (Monitor de Envios) aparece um interruptor por número, visível só para administradores.

### 5. Painel com o histórico do que foi feito
No painel existente, cada número passa a mostrar: enviadas/meta do dia, respostas recebidas, falhas, dias em recuperação, dias em GREEN, previsão de retorno ao pool e as últimas 10 ações (data/hora, destino, template, resultado).

## O que eu acho importante você acompanhar

1. **Taxa de resposta**, não só o volume enviado: aquecimento sem entrada não recupera qualidade.
2. **Volume de campanha no número em quarentena** deve ser zero — se sair mensagem fria, a recuperação não avança.
3. **Dias consecutivos em GREEN** (precisa de 3) e o teto de retorno em escada.
4. **Falhas de template/Meta**: número que não consegue enviar template não está aquecendo nada.
5. **Piora durante a recuperação**: sinal de bloqueio/denúncia real, que aquecimento não resolve — aí é reduzir base e revisar conteúdo.

## Detalhes técnicos

- `meta_whatsapp_instances`: novo campo `aquecimento_qualidade_permitido boolean default true`; migração desliga o campo em instâncias com vínculo em `meta_instance_parceiros` ou de usuários com tag Parceiro Meta.
- `meta-recuperacao-tick`: filtra por `aquecimento_qualidade_permitido = true`; ao registrar o primeiro envio do dia (nenhum log `enviado` no dia), chama `notificarAdmin` com chave `meta_aquec_inicio_<inst>_<dia>`; ao atingir a meta do dia, chave `meta_aquec_meta_<inst>_<dia>`; 3 falhas seguidas no dia → chave `meta_aquec_falhas_<inst>_<dia>`.
- `check-meta-instance-health`: só liga `recuperacao_ativa` se o campo permitir; novos avisos de 1º/2º/3º dia GREEN e de piora, com chaves por dia.
- Nova função `meta-recuperacao-relatorio` (cron 16:00 e 21:00 UTC = 13h/18h BRT) agregando `meta_recuperacao_log` do dia + respostas de `meta_whatsapp_mensagens` (direção entrada dos destinos de aquecimento) e enviando um único WhatsApp via `notificar-admin` (instância sticky com failover, como já é o padrão).
- `RecuperacaoQualidadePanel.tsx`: colunas de resposta/falha/dias, últimas ações e o interruptor por número (admin).

## Custo (Lovable Cloud)

⚠️ **Aviso de custo**: adiciona **1 novo cron 2x/dia** (duas execuções diárias, consultas agregadas com filtro por dia/instância — impacto mínimo) e algumas mensagens WhatsApp extras por dia. Não há novo polling, nem Realtime, nem cron de alta frequência. Confirme para eu implementar.
