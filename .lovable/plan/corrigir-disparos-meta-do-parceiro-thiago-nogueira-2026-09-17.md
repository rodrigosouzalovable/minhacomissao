# Corrigir disparos Meta do parceiro Thiago Nogueira

## Diagnóstico confirmado

O login de **Thiago Nogueira** está corretamente marcado como Parceiro Meta e possui oito instâncias vinculadas.

O número mostrado na imagem, **AMARAL 61 8263-7820**, apresenta hoje:

- conexão `CONNECTED`;
- nome de exibição `APPROVED`;
- BUSINESS e WABA disponíveis, portanto sem evidência atual de pendência de pagamento;
- qualidade `YELLOW`;
- limitação `LIMITED` no próprio número, com retorno da Meta informando que clientes bloquearam esse telefone;
- quarentena de qualidade vigente até 22/09/2026.

O sistema está exibindo para ele o motivo incorreto **“Nome de exibição ainda não aprovado”**. Esse texto ficou gravado apesar de o nome já estar aprovado. O bloqueio atual é de qualidade/reputação confirmado pela Meta, não de pagamento nem de nome.

Também foi confirmado que **AMARAL 62 8273-8416** está `CONNECTED`, `GREEN`, disponível e enviando normalmente — houve envio aceito às 10:55 BRT de hoje. Portanto, o parceiro possui uma rota saudável para continuar os disparos.

## Correção

1. **Corrigir a interpretação da resposta da Meta**
   - Não associar toda limitação `PHONE_NUMBER = LIMITED` a nome pendente.
   - Classificar separadamente pagamento, nome, qualidade/reputação e outras limitações.
   - Quando o nome estiver `APPROVED`, nunca manter ou recriar o aviso de nome não aprovado.

2. **Corrigir os estados dos números do Thiago**
   - Revalidar as oito instâncias diretamente na Meta.
   - Limpar motivos antigos que já não correspondem à resposta atual.
   - Manter fora das campanhas apenas os números com restrição atual confirmada, qualidade baixa ou quarentena vigente.
   - Preservar no pool as instâncias realmente saudáveis, sem exigir ativação novamente.

3. **Evitar que uma instância bloqueada trave todo o disparo**
   - Na tela Envio Meta, distinguir claramente “pagamento confirmado”, “qualidade baixa”, “restrição da Meta” e “quarentena”.
   - Remover automaticamente da seleção de campanha números que a Meta acabou de confirmar como inelegíveis.
   - Manter selecionáveis e utilizáveis as instâncias `CONNECTED`, `GREEN`, sem restrição e já ativas.
   - Informar qual número foi retirado e permitir que a campanha prossiga pelos números saudáveis do parceiro.

4. **Respeitar o controle administrativo do pool**
   - O botão de retorno manual continua exclusivo do administrador, conforme a regra já aprovada.
   - Thiago não receberá um botão para forçar o retorno de número restrito.
   - Números saudáveis não serão retirados ou devolvidos ao pool apenas por marcar/desmarcar no login parceiro.

5. **Validar o fluxo completo**
   - Testar a tela com o login de Thiago.
   - Confirmar que o AMARAL 61 8263-7820 mostra o motivo real e não aparece como falha de pagamento/nome.
   - Confirmar disparo de teste pela instância saudável AMARAL 62 8273-8416.
   - Confirmar que nenhuma proteção real da Meta foi burlada.

## Detalhes técnicos

- Ajustar `check-meta-instance-health` para derivar o motivo da limitação usando `name_status`, `quality_rating`, `health_status.additional_info` e o nível da entidade afetada.
- Fazer a reconciliação sempre substituir motivos obsoletos por um motivo atual, ou limpá-los quando não houver restrição.
- Ajustar `EnvioMeta.tsx` para impedir seleção incoerente e continuar com as instâncias elegíveis após a revalidação.
- Revisar os bloqueios em `envio-meta-massa-iniciar` e `pick-meta-instance` para que usem o estado atual confirmado, mantendo GREEN/leitura recente e bloqueios reais.
- Revalidar e reconciliar os registros vinculados ao Thiago após publicar a correção.

Não serão criados novos agendamentos, buscas repetidas ou canais em tempo real; não há aumento relevante de custo no Lovable Cloud.
