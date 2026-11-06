# Modelo editável da proposta UME ("Enviar na conversa")

## O que o usuário vai ver
Na calculadora "Consulta UME", ao lado de **Enviar na conversa**, um botão de engrenagem **Configurar mensagem**. Ele abre uma janela com 3 passos:

1. **Colar o modelo** — o usuário cola um texto que já usa com clientes, por exemplo:
   "Oi Larissa, seu débito de R$ 10.461,00 sai à vista por R$ 4.713,00 ou 12x de R$ 432,03..."
2. **Sugerir campos** — botão "Identificar partes editáveis". O sistema troca nomes, valores, quantidades de parcelas e datas por campos automáticos e mostra o texto sugerido, com os campos destacados:
   "Oi {primeiro_nome}, seu débito de {total_com_juros} sai à vista por {avista} ou {parcelas_lista}..."
   O usuário pode ajustar o texto à vontade e clicar nos campos disponíveis para inseri-los.
3. **Pré-visualizar e salvar** — mostra como a mensagem fica preenchida com o cliente consultado na hora. Ao salvar, o botão "Enviar na conversa" (e "Copiar proposta") passam a usar esse modelo.

Também haverá "Restaurar modelo padrão", que volta ao texto atual.

## Campos que o sistema preenche
- {nome}, {primeiro_nome}, {cpf}, {dias_atraso}, {fase}
- {total_sem_juros}, {total_com_juros}, {total_proposta} (o total da tabela escolhida, como hoje)
- {avista}
- {parcelas_lista} — a lista "• 2x de R$ ..." já sem as parcelas abaixo de R$ 100
- {maior_parcelamento} (ex.: "18x de R$ 288,02") e {menor_parcela}
- {tabela} (Padrão / Desconto Especial / Sem Juros + 10%)

A regra de esconder parcelas abaixo de R$ 100 e os cálculos não mudam. Só muda o texto.

## De quem é o modelo
Cada usuário tem o próprio modelo (o do Thiago não altera o seu). Ele fica salvo na conta, então vale em qualquer computador. Quem não configurar continua com o texto atual.

## Custo
- A identificação automática usa a IA do Lovable **apenas quando o usuário clica** em "Identificar partes editáveis". É uma chamada curta, de centavos, e não acontece no envio.
- Não há rotina automática nem atualização periódica. O envio continua instantâneo, sem IA.

## Detalhes técnicos
- Nova tabela `ume_proposta_modelos` (user_id único, texto, atualizado_em) com RLS para o dono, mais GRANTs. Leitura feita uma vez ao abrir a janela.
- `src/lib/umePropostaModelo.ts`: lista de variáveis, função `preencherModelo(texto, consulta, tabela)` e uma detecção local por regex como reserva (R$ → valor mais próximo, "Nx de" → parcelas, primeiro nome do cliente). Testes unitários para o preenchimento e para a regra das parcelas abaixo de R$ 100.
- Nova função de backend `ume-modelo-sugerir`: recebe o texto colado e os valores atuais do cliente e devolve o texto com os campos `{...}` (modelo padrão do Gateway, usuário autenticado obrigatório). Se a IA falhar, usa a detecção local.
- `ConsultaUmeDialog.tsx`: botão de engrenagem e novo `ConfigurarModeloUmeDialog`. `textoProposta` usa o modelo salvo quando ele existir.
