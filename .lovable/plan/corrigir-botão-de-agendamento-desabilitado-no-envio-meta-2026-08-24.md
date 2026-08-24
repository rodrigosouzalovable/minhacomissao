# Corrigir botão de agendamento desabilitado no Envio Meta

## O problema

Na aba Envio Meta, tanto o botão de ativar "Agendar em vez de disparar agora" quanto o botão final ("Disparar" / "Agendar (N)") ficam desabilitados sem qualquer explicação na tela. Hoje eles são bloqueados por três condições internas — validação em andamento, campanha ativa em andamento e "instâncias sem o template aprovado" — e quando uma delas está ativa o botão simplesmente apaga, sem dizer o motivo. Fora do editor (domínio publicado) isso fica pior porque não há como investigar o estado.

Ainda não é possível afirmar qual das condições está travando no seu acesso publicado — o código publicado já é a versão nova, e não há campanha ativa no banco. Por isso a correção começa por tornar o motivo visível e deixar de bloquear onde o bloqueio não é necessário.

## O que muda na tela

1. **O botão de ativar o agendamento nunca mais fica desabilitado.** Ligar o agendamento e escolher data/hora é sempre permitido — a validação real acontece só no momento de confirmar.
2. **O botão principal só fica desabilitado enquanto uma ação está realmente em curso** (validando WhatsApp ou enviando teste). Nos outros casos ele fica clicável e, ao clicar, mostra uma mensagem clara do que falta, por exemplo:
   - "3 instâncias selecionadas não têm este template aprovado — remova-as ou troque o template."
   - "Selecione ao menos uma instância" / "Importe a planilha de destinatários" / "Selecione um template aprovado".
3. **Aviso permanente abaixo do botão** listando, em texto, o que ainda impede o agendamento/disparo (mesma lista usada na validação), para o motivo ficar visível sem precisar clicar.
4. **Tooltip no botão** com o mesmo motivo quando ele estiver desabilitado por ação em curso.

## Detalhes técnicos

- `src/pages/EnvioMeta.tsx`:
  - Criar um `motivosBloqueio: string[]` (memo) reunindo: sem template, sem instância, sem destinatários, instâncias incompatíveis, campanha ativa.
  - Botão principal (linha ~2038): `disabled` passa a ser apenas `validando || enviandoTeste`. `enviar()` já valida tudo e emite `toast.error` — acrescentar a checagem de instâncias incompatíveis e de destinatários vazios lá, com mensagem específica.
  - `AgendarCampanhaBox` (linha ~1743): remover a prop `disabled` derivada de `enviando/validando/instanciasIncompatíveis` (passa a `disabled={false}` / prop omitida).
  - Renderizar a lista de `motivosBloqueio` como texto `text-xs text-muted-foreground` ao lado/abaixo do botão, e envolver o botão em `Tooltip` quando desabilitado.
- `src/components/meta/CampanhaAgendadaSection.tsx`: sem mudança de lógica; a prop `disabled` continua existindo, apenas não é mais acionada pela página.
- Sem mudanças de backend, tabelas, crons ou funções — nenhum impacto de custo no Cloud.

## Depois de aplicar

Publicar novamente para o domínio, e se o botão ainda recusar o agendamento, a mensagem exibida dirá exatamente qual condição está travando.
