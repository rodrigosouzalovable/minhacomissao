

## Formatar o Word da Notificacao Extrajudicial igual ao documento modelo

### Resumo

Reescrever a funcao `handleDownloadNotifWord` para gerar um documento Word com formatacao profissional identica ao modelo: logo centralizado no cabecalho, textos em negrito nos lugares corretos, titulo centralizado e sublinhado, texto justificado, bullets com quadrados, linhas separadoras, rodape com contato em todas as paginas e margens adequadas.

### Alteracoes em `src/pages/DevedorDetalhe.tsx`

**Reescrever `handleDownloadNotifWord` (linhas 404-422)**

Substituir o HTML simples por um HTML completo com formatacao Word (usando namespaces Microsoft Office XML) que reproduz exatamente o layout do documento modelo:

**Formatacao a aplicar:**

1. **Cabecalho com logo** - Usar a imagem `logo-souza-ribeiro.png` convertida em base64 e incluida via `<img>` centralizado no topo. O logo sera inserido via `@page` header section do Word XML.

2. **Texto justificado** - `text-align: justify` no corpo do documento.

3. **Negrito seletivo** - Aplicar `<b>` nos trechos corretos:
   - Nome completo do credor (primeira linha)
   - "NOTIFICACAO EXTRAJUDICIAL" (centralizado e sublinhado)
   - "Assunto: Cobranca de divida vencida - Intimacao para pagamento"
   - "A" e nome do cliente
   - "E aos socios:"
   - Quantidade e valor em extenso dentro do paragrafo (ex: "31 (trinta e um) titulos vencidos e nao quitados", "R$103.749,05 (cento e tres mil...)")
   - "EXIGENCIA" (sublinhado)
   - "IMPRORROGAVEL de 48 (quarenta e oito) horas"
   - "CONSEQUENCIAS DO NAO PAGAMENTO"
   - "sem novo aviso"
   - "formal e definitivo"
   - Linhas de assinatura ("p.p. CREDOR..." e "Rodrigo Ribeiro...")

4. **Bullets com quadrados** - Usar `<table>` com "□" (U+25A1) como marcador ao inves de listas HTML, para garantir alinhamento no Word.

5. **Linhas separadoras** - Usar `<hr>` com estilo adequado entre as secoes.

6. **Rodape em todas as paginas** - Usar `mso-header` e `mso-footer` sections do Word XML para repetir o rodape com endereco e contato.

7. **Margens** - Configurar `@page` com margens de ~2.5cm (equivalente ao modelo).

8. **Fonte e tamanho** - Arial, 11pt, line-height 1.5.

**Estrutura do HTML Word:**

```html
<html xmlns:o="urn:schemas-microsoft-com:office:office" 
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <style>
    @page { 
      margin: 2.5cm 2.5cm 3cm 2.5cm; 
      mso-header-margin: 1cm;
      mso-footer-margin: 1cm;
    }
    @page Section1 { mso-header: h1; mso-footer: f1; }
    div.Section1 { page: Section1; }
    body { font-family: Arial; font-size: 11pt; text-align: justify; line-height: 1.5; }
    table.MsoTableGrid { ... }
  </style>
</head>
<body>
  <div class="Section1">
    <!-- Header with logo (Word XML header) -->
    <div style="mso-element:header" id="h1">
      <p align="center"><img src="data:image/png;base64,..." width="200" /></p>
    </div>
    
    <!-- Content with proper formatting -->
    <p><b>MONTREAL - MONTADORA...</b>, pessoa juridica...</p>
    <hr/>
    <p align="center" style="text-decoration:underline"><b>NOTIFICACAO EXTRAJUDICIAL</b></p>
    <!-- ... resto do conteudo formatado ... -->
    
    <!-- Footer -->
    <div style="mso-element:footer" id="f1">
      <hr/>
      <p align="center" style="font-size:9pt">Rua 24, n 208...</p>
      <p align="center" style="font-size:9pt">Telefone/WhatsApp...</p>
    </div>
  </div>
</body>
</html>
```

**Logica de conversao do texto editado:**

Como o usuario pode editar o texto no textarea antes de baixar, a funcao precisara "parsear" o texto editado e aplicar a formatacao correta. A abordagem sera:

- Converter o logo para base64 usando um canvas (ou importar como data URL)
- Identificar as secoes do texto por palavras-chave e aplicar a formatacao HTML adequada
- Para trechos em negrito dentro de paragrafos (como "IMPRORROGAVEL de 48 horas"), usar regex para envolver em `<b>`
- Gerar o HTML completo com headers/footers do Word XML

**Tambem sera necessario:**

- Importar o logo como base64 para embutir no HTML (o Word nao carrega URLs externas). Criar uma funcao auxiliar que converte a imagem importada para base64 usando canvas.

### Secao tecnica

- Arquivo modificado: `src/pages/DevedorDetalhe.tsx`
- Sem novas dependencias
- O logo sera convertido para base64 via canvas em tempo de execucao
- A formatacao usa namespaces Microsoft Office XML para garantir compatibilidade com Word
- O texto continua editavel no textarea - a formatacao e aplicada no momento do download
