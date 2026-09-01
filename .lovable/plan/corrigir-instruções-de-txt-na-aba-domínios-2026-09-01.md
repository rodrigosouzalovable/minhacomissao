# Corrigir instruções de TXT na aba Domínios

## Respondendo agora à sua dúvida

No registro.br, no campo **Nome** você digita:

```text
_lovable.luizcarlos
```

(o registro.br completa sozinho com `.meusacordos.com.br`, resultando em `_lovable.luizcarlos.meusacordos.com.br`)

E no campo de **valor/dados** do TXT:

```text
lovable_verify=c0376db03c9b0a506ce2c0c469d3f7103cdda66f4c6dfcae7b36f404217b7cbe
```

O registro A do subdomínio (`luizcarlos` → 185.158.133.1) já está correto e visível publicamente. Falta apenas esse TXT.

## O que está errado na aba Domínios

- O campo "Registro TXT — nome" mostra apenas `_lovable`, sem o prefixo do subdomínio — isso levaria a criar o registro no host errado.
- Não existe campo para o **valor** do TXT, que é diferente para cada subdomínio e é gerado pela Lovable no fluxo Connect Domain.

## Correções

1. Campo "Registro TXT — nome" passa a mostrar `_lovable.<prefixo>` (ex.: `_lovable.luizcarlos`), com nota de que o registro.br completa o restante do domínio.
2. Novo campo "Registro TXT — valor" com botão de copiar, alimentado por um valor salvo por subdomínio (coluna nova em `portal_dominios`), editável no formulário de criação/edição. Quando vazio, mostra aviso de que o valor deve ser copiado do fluxo Connect Domain da Lovable.
3. Passo a passo atualizado para citar o nome completo do TXT e o valor salvo.
4. Preencher o valor já conhecido do subdomínio `luizcarlos` no cadastro existente.

## Detalhes técnicos

- Migração: `ALTER TABLE public.portal_dominios ADD COLUMN txt_verify text`; update do registro `luizcarlos.meusacordos.com.br` com o valor acima.
- `src/pages/AdminDominios.tsx`: tipo `DominioRow` + `FormState` com `txt_verify`; `CopyField` extra; nome do TXT calculado como `_lovable.${prefixoDeHost(hostname)}`; texto do passo a passo ajustado.
- Sem mudanças no portal público nem na lógica de contato por domínio.
