## Objetivo
Personalizar o link do botão "Falar no WhatsApp" que aparece quando o CPF consultado no portal não retorna nenhum débito, incluindo o CPF digitado na mensagem pré-preenchida.

## Alteração
Arquivo: `src/pages/ConsultaResultado.tsx` (bloco "Nenhum débito encontrado", linhas ~272-287).

Trocar o `<a href="https://wa.me/${PHONE}">` (sem texto) por um link com `?text=` codificado contendo:

`Olá, meu CPF é {CPF_FORMATADO}, e eu quero verificar as condições de negociação disponíveis para mim.`

Onde `{CPF_FORMATADO}` usa o CPF digitado pelo cliente (`cpfCliente`) formatado como `000.000.000-00` via o helper `formatCpfFull` já existente no arquivo.

## Detalhes técnicos
```tsx
<a
  href={`https://wa.me/${PHONE}?text=${encodeURIComponent(
    `Olá, meu CPF é ${formatCpfFull(cpfCliente)}, e eu quero verificar as condições de negociação disponíveis para mim.`
  )}`}
  target="_blank"
  rel="noopener noreferrer"
>
```

Nenhum outro botão será alterado (os outros dois "Falar no WhatsApp" já têm mensagens contextualizadas).