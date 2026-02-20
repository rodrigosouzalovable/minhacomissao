

## Ajustar Notificacao Extrajudicial para ficar identica ao documento modelo

### Resumo

O texto gerado atualmente nao segue fielmente o modelo do documento enviado. As alteracoes abaixo vao reescrever a funcao `gerarTextoNotificacao` e melhorar a geracao do PDF para que o conteudo e o layout fiquem identicos ao documento original.

### Diferencas identificadas entre o atual e o modelo

1. **Cabecalho**: O modelo tem "SOUZA & RIBEIRO - ADVOCACIA E COBRANÇAS" antes do nome do credor. Atualmente nao existe.
2. **Dados do credor**: O modelo inclui dados completos do credor (tipo juridico, CNPJ, endereco). Atualmente so mostra o nome.
3. **Dados do cliente**: O modelo inclui endereco e nomes dos socios. Atualmente so mostra nome e CPF.
4. **Texto principal**: O modelo menciona "mercadorias que lhes foram vendidas" e detalha correcao pela "Taxa Selic diaria, mais juros de mora de 1% ao mes e multa de 2%". O texto atual e generico.
5. **Secao EXIGENCIA**: O modelo detalha itens como juros, multa, correcao monetaria e honorarios em lista. Inclui dados de pagamento via PIX. Atualmente e um paragrafo unico.
6. **Secao CONSEQUENCIAS**: O modelo inclui "Pedido de desconsideracao da personalidade juridica" e "Cobranca de custas e honorarios judiciais". Faltam no texto atual.
7. **Texto de mora**: O modelo diz "Esta notificacao possui carater formal e definitivo, constituindo Vossas Senhorias em mora."
8. **Contatos para negociacao**: O modelo inclui nomes e telefones especificos para contato.
9. **Rodape**: O modelo tem assinatura com "p.p. [CREDOR]" e "Rodrigo Ribeiro de Souza - Souza e Ribeiro Sociedade de Advogados" e endereco/telefone/email do escritorio.
10. **PDF com logo**: O modelo tem o logotipo Souza & Ribeiro no topo de cada pagina.

### Alteracoes em `src/pages/DevedorDetalhe.tsx`

**1. Reescrever `gerarTextoNotificacao` (linhas 240-286)**

O novo texto seguira exatamente a estrutura do documento modelo:

```text
SOUZA & RIBEIRO
ADVOCACIA E COBRANÇAS

[CREDOR]

NOTIFICAÇÃO EXTRAJUDICIAL
Assunto: Cobrança de dívida vencida – Intimação para pagamento

À
[NOME DO CLIENTE]
CPF/CNPJ: [CPF]

Prezado(a) Cliente,

Notificamos Vossa Senhoria acerca da existência de [QTD] título(s) vencido(s) e não quitados, referentes às mercadorias/serviços contratados, os quais somam o valor total originário de: R$ [TOTAL ORIGINAL], sendo que, para efeito de negociação, esse valor será corrigido monetariamente, pela Taxa Selic diária, mais juros de mora de 1% (um por cento) ao mês e multa de 2% (dois por cento).

TÍTULOS EM ABERTO:
[lista de contratos]

EXIGÊNCIA
Fica concedido o prazo IMPRORROGÁVEL de 48 (quarenta e oito) horas, a contar do recebimento desta, para pagamento integral do débito, acrescido de:
- Juros de mora de 1% ao mês;
- Multa contratual de 2%;
- Correção monetária, pela Taxa Selic diária;
- Honorários e encargos de cobrança.

Pagamento via PIX (CNPJ 05.950.717/0001-18) ou depósito identificado.

CONSEQUÊNCIAS DO NÃO PAGAMENTO
O não cumprimento no prazo estipulado ensejará, sem novo aviso:
- Protesto dos títulos em cartório;
- Inclusão nos órgãos de proteção ao crédito;
- Ajuizamento de Ação de Execução, com penhora de bens;
- Pedido de desconsideração da personalidade jurídica, para atingir bens dos sócios;
- Bloqueio de valores via SISBAJUD;
- Cobrança de custas e honorários judiciais.

Esta notificação possui caráter formal e definitivo, constituindo Vossa Senhoria em mora.

Para tratativas imediatas de negociação do débito, contatar:
Luiz Carlos: (62) 99679-9697 ou Rodrigo: (62) 99167-2674.
contato@souzaeribeiro.com.br

[CIDADE], [DATA].

______________________________________________________________
p.p. [CREDOR]
Rodrigo Ribeiro de Souza - Souza e Ribeiro Sociedade de Advogados.

Rua 24, nº 208, Setor Marista, CEP: 74150-070, Goiânia-GO.
Telefone/WhatsApp: (62) 99679-9697 - E-mail: contato@souzaeribeiro.com.br
```

Os campos entre colchetes serao substituidos pelos dados reais do cliente (`devedor.nome`, `devedor.cpf`, `devedor.credor`, contratos, valores).

**2. Atualizar `handleDownloadNotifPDF` (linhas 293-308)**

Melhorar a geracao do PDF para incluir:
- Logotipo Souza & Ribeiro no topo de cada pagina (usar `src/assets/logo-souza-ribeiro.png` convertido em base64)
- Margem superior maior para acomodar o logo
- Rodape com endereco e contato do escritorio em cada pagina
- Formatacao com negrito para titulos das secoes (EXIGENCIA, CONSEQUENCIAS, etc.)

Para incluir o logo no PDF, importar a imagem como modulo e usar `doc.addImage()`.

**3. Importar o logo**

Adicionar import do logo no topo do arquivo:
```typescript
import logoSouzaRibeiro from '@/assets/logo-souza-ribeiro.png';
```

### Secao tecnica

- Arquivo modificado: `src/pages/DevedorDetalhe.tsx`
- Sem alteracoes no banco de dados
- O logo ja existe em `src/assets/logo-souza-ribeiro.png`
- O texto continua 100% editavel no Dialog antes do download
- A geracao do PDF usara `doc.addImage()` para o logo e `doc.setFont('helvetica', 'bold')` para titulos em negrito
- Rodape repetido em todas as paginas do PDF

