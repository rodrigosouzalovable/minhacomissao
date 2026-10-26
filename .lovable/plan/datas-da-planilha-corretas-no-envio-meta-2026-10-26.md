# Datas da planilha corretas no Envio Meta

## O que foi conferido
- Em `CERTIFICADO_1.xlsx`, a coluna D ({{3}}) guarda datas reais do Excel (ex.: 21/10/2026). A importação lê o número interno da data (ex.: 46316) em vez do texto exibido, por isso aparecem "números estranhos".

## Correção
- Ao importar, células de data passam a virar texto no padrão brasileiro **dd/mm/aaaa** (21/10/2026), igual ao que você vê na planilha.
- Vale para qualquer coluna com data, na tabela de conferência, na prévia da mensagem e no envio.
- Demais colunas (CNPJ, nome, telefone, valor R$) continuam como hoje.

## Detalhes técnicos
- Em `src/pages/EnvioMeta.tsx`, ler com `XLSX.read(buf, { type: "array", cellDates: true })` e converter valores `Date` para `dd/MM/yyyy` (usando componentes UTC para não perder um dia por fuso) antes de passar as linhas ao mapeador.
- Aplicar o mesmo tratamento à colagem/demais leituras XLSX do mesmo fluxo, se existirem.
- Teste unitário: data do Excel 2026-10-21 vira "21/10/2026".
- Sem mudanças no banco ou nos envios.
