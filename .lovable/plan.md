## Problema
Quando nenhum débito é encontrado, o botão "Falar no WhatsApp" abre a mensagem sem o CPF (aparece "meu CPF é ,"). Causa: o state `cpfCliente` só é preenchido quando `debitos.length > 0` (linha 89). No caminho "nenhum débito encontrado" ele fica vazio, então `formatCpfFull('')` retorna string vazia.

## Correção
Arquivo: `src/pages/ConsultaResultado.tsx` (linhas 280-283).

Usar como fallback o CPF vindo da URL (`cpf` do `useParams`), que já está disponível mesmo sem débitos. Sanitizar só os dígitos antes de formatar.

```tsx
const cpfParaMensagem = (cpfCliente || cpf || '').replace(/\D/g, '');
// ...
href={`https://wa.me/${PHONE}?text=${encodeURIComponent(
  `Olá, meu CPF é ${formatCpfFull(cpfParaMensagem)}, e eu quero verificar as condições de negociação disponíveis para mim.`
)}`}
```

Nenhuma outra lógica é alterada.