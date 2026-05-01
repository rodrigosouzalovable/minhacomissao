## Objetivo

Permitir que, ao **editar um acordo**, o usuário também consiga alterar o credor entre **UME | INADIMPLENTES** e **UME | APORTE** — exatamente o mesmo seletor que já existe na tela de "Novo Acordo".

## Contexto técnico

Na tabela `acordos`, o credor é representado pela coluna `empresa`:

- `ume_novo_mundo` → exibido como **UME | INADIMPLENTES**
- `mundo_da_moda` → exibido como **UME | APORTE** (nome legado no banco)

Em `EditarAcordo.tsx` o estado `empresa` já é carregado do banco (linha 67 e 111), porém:
1. Não existe nenhum seletor na UI para alterá-lo.
2. O `update` enviado ao Supabase no submit (linhas 171–186) **não inclui** o campo `empresa`, então qualquer alteração seria descartada.

## Mudanças

### `src/pages/EditarAcordo.tsx`

1. **Adicionar o seletor de Empresa no formulário**, dentro do card "Dados do Cliente" (logo após o telefone), idêntico ao de `NovoAcordo.tsx`:

   ```tsx
   <div className="space-y-2">
     <Label>Empresa *</Label>
     <div className="flex gap-3">
       <Button type="button"
         variant={empresa === 'ume_novo_mundo' ? 'default' : 'outline'}
         className="flex-1"
         onClick={() => setEmpresa('ume_novo_mundo')}>
         UME | INADIMPLENTES
       </Button>
       <Button type="button"
         variant={empresa === 'mundo_da_moda' ? 'default' : 'outline'}
         className="flex-1"
         onClick={() => setEmpresa('mundo_da_moda')}>
         UME | APORTE
       </Button>
     </div>
   </div>
   ```

2. **Incluir `empresa: empresa` no payload do `update`** dos acordos (junto com os demais campos), garantindo que a troca seja persistida.

3. Manter o seletor habilitado mesmo quando há parcelas pagas (a alteração de credor é apenas reclassificação, não regenera parcelas).

## Itens fora do escopo

- Não mexer em recálculo de comissões nem em parcelas já pagas.
- Não alterar regras de Montreal (foi explicitamente pedido para deixar como está).
- Não alterar `NovoAcordo.tsx`, `NovoAcordoAdmin.tsx` nem permissões — o seletor já existe na criação.