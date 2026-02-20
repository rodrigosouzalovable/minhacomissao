

## Ajustar texto da Notificacao Extrajudicial e adicionar opcao de download em WORD

### Resumo

Reescrever a funcao `gerarTextoNotificacao` para seguir EXATAMENTE o modelo fornecido e adicionar botao de download em formato Word (.docx) alem do PDF.

### Alteracoes em `src/pages/DevedorDetalhe.tsx`

**1. Reescrever `gerarTextoNotificacao` (linhas 241-301)**

Remover a secao "TITULOS EM ABERTO" e ajustar o texto para ficar identico ao modelo. As principais mudancas:

- Remover cabecalho "SOUZA & RIBEIRO / ADVOCACIA E COBRANÇAS" (ja aparece no logo do PDF)
- Credor com dados completos: mapear cada credor para nome completo, tipo juridico, CNPJ e endereco. Exemplo para MONTREAL:
  ```
  MONTREAL - MONTADORA DE MÓVEIS E ELETRO-DOMÉSTICOS LTDA., pessoa jurídica de direito privado, inscrita no CNPJ nº 07.019.882/0001-86, com sede na Av. Eurípedes de Menezes, qd. 04, lts. 01/13 e 28/36, Setor Parque Industrial, CEP: 74993-540, Aparecida de Goiânia-GO.
  ```
- Linhas separadoras `________________________________________` entre secoes
- Destinatario com "E aos sócios:" e campo "[PRECISA SER PREENCHIDO]" para endereco e socios
- Texto principal: "mercadorias que lhes foram vendidas" e "Vossas Senhorias" (plural)
- Paragrafo sobre inadimplemento: "O inadimplemento persiste desde [data mais antiga], o que configura descumprimento contratual..."
- Secao EXIGENCIA com bullets usando "•" ao inves de "-"
- Secao CONSEQUENCIAS com bullets usando "•"
- Mora: "constituindo Vossas Senhorias em mora"
- Data: "Goiânia-GO, [data por extenso]."
- Assinatura: "p.p. [CREDOR COMPLETO]"
- Remover completamente a listagem de titulos em aberto

**Mapeamento de credores** - criar objeto com dados completos:

```typescript
const credoresInfo: Record<string, { nomeCompleto: string; cnpj: string; endereco: string }> = {
  'MONTREAL': {
    nomeCompleto: 'MONTREAL - MONTADORA DE MÓVEIS E ELETRO-DOMÉSTICOS LTDA.',
    cnpj: '07.019.882/0001-86',
    endereco: 'Av. Eurípedes de Menezes, qd. 04, lts. 01/13 e 28/36, Setor Parque Industrial, CEP: 74993-540, Aparecida de Goiânia-GO'
  },
  'UME | NOVO MUNDO': {
    nomeCompleto: 'UME | NOVO MUNDO',
    cnpj: '[CNPJ]',
    endereco: '[ENDEREÇO]'
  }
};
```

**2. Atualizar `handleDownloadNotifPDF` (linha 338)**

Remover "TÍTULOS EM ABERTO:" da lista de `boldSections`.

**3. Adicionar download em WORD**

Adicionar botao "Baixar Word" ao lado do "Baixar PDF" no DialogFooter. Para gerar o arquivo Word, criar um Blob com conteudo HTML simples (com o logo e formatacao) e salvar como `.doc`:

```typescript
const handleDownloadNotifWord = () => {
  // Gerar HTML com o conteudo formatado
  const html = `<html><head><meta charset="utf-8"></head><body style="font-family: Arial; font-size: 11pt;">
    <img src="..." width="150" /><br/><br/>
    ${notifContent.split('\n').map(line => {
      // Aplicar negrito em secoes de titulo
      if (['NOTIFICAÇÃO EXTRAJUDICIAL', 'EXIGÊNCIA', 'CONSEQUÊNCIAS'].some(s => line.startsWith(s))) {
        return `<b>${line}</b><br/>`;
      }
      return `${line}<br/>`;
    }).join('')}
  </body></html>`;
  
  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Notificacao-Extrajudicial-${devedor.nome}.doc`;
  a.click();
  URL.revokeObjectURL(url);
};
```

**4. Atualizar DialogFooter (linhas 465-470)**

Adicionar o botao "Baixar Word" ao lado do botao "Baixar PDF":

```
[Fechar]  [Baixar Word]  [Baixar PDF]
```

### Secao tecnica

- Arquivo modificado: `src/pages/DevedorDetalhe.tsx`
- Sem alteracoes no banco de dados
- Sem novas dependencias (Word gerado via HTML/Blob nativo)
- Os dados de UME | NOVO MUNDO precisarao ser preenchidos pelo usuario (CNPJ e endereco ficarao como placeholder editavel)
- Campos de endereco e socios do cliente ficam como "[PRECISA SER PREENCHIDO]" para edicao manual
