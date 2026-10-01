# Captação nacional de WhatsApps verificados

## Objetivo

Captar diariamente em todo o Brasil até atingir **200 novos números com WhatsApp verificado**, inclusive aos domingos, respeitando o teto de **650 consultas ou US$ 20,80 por dia**.

A meta é buscar 200 por dia, mas não será tratada como garantia absoluta: se o teto diário for alcançado primeiro, a coleta encerra e mostra claramente quantos faltaram.

## Execução

1. **Ampliar a cobertura para o Brasil**
   - Substituir a lista restrita a Goiás por uma rotação nacional de capitais, regiões metropolitanas e cidades relevantes de todos os estados.
   - Distribuir as buscas entre regiões para evitar concentração e repetir menos empresas.
   - Manter a seleção de nichos em 70% comprovados, 20% intermediários e 10% exploratórios.

2. **Executar até a meta ou o teto**
   - Processar lotes limitados e sequenciais até obter 200 novos WhatsApps verificados.
   - Encerrar imediatamente ao atingir 200, 650 consultas ou US$ 20,80 no dia.
   - Continuar todos os dias, inclusive domingos, dentro da janela operacional.
   - Usar trava única, deduplicação pelos últimos 8 dígitos e retomada segura entre execuções.

3. **Proteger custos e estabilidade**
   - Manter esta captação separada da coleta antiga, das campanhas e de qualquer envio de mensagem.
   - Não repetir consultas já realizadas para a mesma combinação de nicho e cidade no período definido.
   - Parar em erros definitivos de autorização ou restrição do Google; aplicar espera limitada apenas em falhas temporárias.
   - Registrar consultas, custo estimado, rendimento e motivo de encerramento de cada dia.

4. **Deixar o resultado explícito na tela**
   - Alterar o texto de Goiás para Brasil.
   - Exibir meta diária, captados, faltantes, consultas usadas, custo estimado e percentual concluído.
   - Mostrar um estado final claro: “Meta atingida” ou “Teto diário atingido — faltaram X”.
   - Manter busca, filtros, paginação, exportação em Excel e promoção automática para confirmados.

5. **Validar sem enviar mensagens**
   - Testar autenticação, limite diário, deduplicação, rotação nacional e interrupção no teto.
   - Conferir a tela em tamanhos desktop e celular.
   - Confirmar que a captação não reativa Certificado, Clara, Google Maps antigo ou campanhas, e não envia WhatsApp automaticamente.

## Critérios de aceite

- A região exibida e pesquisada passa a ser Brasil.
- A rotina roda todos os dias e tenta completar 200 novos WhatsApps verificados.
- Nenhum dia ultrapassa 650 consultas ou US$ 20,80 estimados.
- Quando 200 não forem alcançados, a tela informa a quantidade obtida e o motivo da interrupção.
- Telefones repetidos não entram novamente.
- O Excel contém apenas os candidatos disponíveis selecionados.
- Nenhuma mensagem é enviada automaticamente.
