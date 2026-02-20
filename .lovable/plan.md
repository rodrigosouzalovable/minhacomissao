

## Botao de Notificacao Extrajudicial na Ficha do Cliente

### Resumo

Adicionar um botao "Notificacao Extrajudicial" no cabecalho da ficha do cliente. Ao clicar, abre um Dialog com o texto do modelo de notificacao ja preenchido com os dados do cliente (nome, CPF/CNPJ, contratos em aberto, valores, datas). O conteudo e editavel e pode ser baixado como PDF.

### Alteracoes em `src/pages/DevedorDetalhe.tsx`

**1. Novos estados**

- `notifDialogOpen` - controle do Dialog
- `notifContent` - texto editavel da notificacao

**2. Funcao `gerarTextoNotificacao`**

Monta o texto do modelo com base nos dados do cliente e contratos:

- Nome do cliente (`devedor.nome`)
- CPF/CNPJ (`devedor.cpf`)
- Credor (`devedor.credor`)
- Quantidade de contratos em aberto (`contratos.length`)
- Valor total atualizado (soma dos `valor_atualizado`)
- Data atual formatada
- Listagem dos contratos com numero, vencimento, valor original e valor atualizado

O modelo segue a estrutura do documento anexado:

```text
[CREDOR]

NOTIFICACAO EXTRAJUDICIAL
Assunto: Cobranca de divida vencida - Intimacao para pagamento

A
[NOME DO CLIENTE]
CPF/CNPJ: [CPF]

Notificamos Vossa Senhoria acerca da existencia de [QTD] titulo(s) vencido(s)...
valor total originario de: R$ [TOTAL]...

EXIGENCIA
Fica concedido o prazo IMPRORROGAVEL de 48 horas...

CONSEQUENCIAS DO NAO PAGAMENTO
- Protesto dos titulos em cartorio
- Inclusao nos orgaos de protecao ao credito
- Ajuizamento de Acao de Execucao
- Bloqueio de valores via SISBAJUD

[DATA ATUAL]
```

**3. Botao no cabecalho**

Posicionado ao lado do botao "Voltar", com icone `FileText`:

```
[Notificacao Extrajudicial]  [<- Voltar]
```

Ao clicar, chama `gerarTextoNotificacao()`, preenche `notifContent` e abre o Dialog.

**4. Dialog com editor e download**

- Dialog largo (`max-w-4xl`) com scroll
- Textarea editavel com o texto gerado
- Botao "Baixar PDF" no footer
- Usa a biblioteca `jspdf` (ja instalada) para gerar o PDF com o conteudo editado
- O PDF e gerado com quebra de linha automatica e formatacao basica

**5. Geracao do PDF**

Usa `jsPDF` para criar o documento:

```typescript
import jsPDF from 'jspdf';

const handleDownloadPDF = () => {
  const doc = new jsPDF();
  const lines = doc.splitTextToSize(notifContent, 170);
  doc.setFontSize(11);
  // Adiciona texto com paginacao automatica
  doc.text(lines, 20, 20);
  doc.save(`Notificacao-Extrajudicial-${devedor.nome}.pdf`);
};
```

### Secao tecnica

- Arquivo modificado: `src/pages/DevedorDetalhe.tsx`
- Sem alteracoes no banco de dados
- Usa `jspdf` ja existente nas dependencias
- O texto e 100% editavel antes do download
- O modelo e gerado dinamicamente com dados reais do cliente

