# Permitir seleção manual de RED/YELLOW sem confundir qualidade com bloqueio

## Diagnóstico confirmado
- As últimas verificações registradas às 15h50 de 09/10 mostram **SOUZA 62 8267-7554** e **SOUZA 62 8276-5462** conectadas, com qualidade RED e sem banimento registrado.
- A Meta retornou `LIMITED` no telefone com o aviso de que a cota poderá diminuir se a qualidade não melhorar; WABA e empresa retornaram `AVAILABLE`. Os erros SIP presentes dizem respeito a chamadas, não ao envio de mensagens.
- A opção global de liberação por qualidade está ligada. Mesmo assim, a verificação grava “Restrição de qualidade/reputação confirmada pela Meta” e o início da campanha rejeita esse estado do pool.
- Esses registros não garantem disponibilidade futura: a liberação precisa depender da consulta feita no momento de iniciar.

## Alteração proposta
1. Diferenciar **aviso de qualidade/cota** de **bloqueio real de mensagens**, usando os estados e detalhes retornados pela Meta, não apenas RED/YELLOW.
2. Permitir que números RED/YELLOW selecionados deliberadamente participem de campanhas manuais conforme a liberação e confirmação de risco aplicáveis, quando a consulta atual não apontar bloqueio real. Corrigir também as etapas de retomada e envio que compartilhem a classificação incorreta.
3. Reconciliar o impedimento antigo das duas instâncias após nova verificação individual. Não liberar uma BM inteira por associação nem apagar pausas manuais ou bloqueios comerciais/de segurança.
4. Tornar os avisos específicos: qualidade baixa e possível redução de cota são alertas; bloqueios reais exibem instância, motivo, código disponível e orientação correspondente.

## Proteções mantidas
- Bloqueios `BLOCKED`, `RESTRICTED`, `UNAVAILABLE`, banimento, pagamento pendente e limitações de causa desconhecida continuam impedindo envio. `LIMITED` só recebe tratamento informativo quando a resposta comprovar que se trata exclusivamente do aviso de qualidade/cota.
- Consulta incompleta ou com erro não libera a instância. Um aviso de qualidade não pode neutralizar outro bloqueio simultâneo.
- Preservar permissões, exclusão de internacionais/banidos, templates aprovados, cotas, intervalos, consentimento e blacklist.
- Não aumentar volume, criar rotinas ou iniciar disparos reais nesta correção; nenhuma promessa de retorno ao GREEN.

## Detalhes técnicos e validação
- Consolidar a classificação em regra compartilhada para a verificação de saúde e os caminhos manuais de campanha, seleção e envio que precisarem dela.
- Testar os dois retornos observados: telefone `LIMITED` por qualidade, WABA/empresa `AVAILABLE`, erros SIP sem bloqueio de mensagens.
- Cobrir RED/YELLOW sem restrição, bloqueio verdadeiro no telefone/WABA/empresa, pagamento, banimento, `LIMITED` desconhecido, restrições simultâneas e consulta inconclusiva.
- Verificar as funções publicadas, consultar novamente as duas instâncias e conferir a seleção/início por validação sem envio real. Informar separadamente qualquer impedimento que a Meta ainda confirmar.