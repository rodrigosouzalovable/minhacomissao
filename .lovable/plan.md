

## Plano: Substituir "Área Restrita" por ícone personalizado

### O que será feito

Substituir o link de texto "Área Restrita" no header do portal por um ícone discreto. Como a imagem enviada é apenas uma referência visual do texto atual, será utilizado um ícone do `lucide-react` (por exemplo, `Lock` ou `UserCog`) para representar o acesso restrito.

### Alteração

**Arquivo:** `src/pages/PortalConsulta.tsx` (linha 81)

**De:**
```
<a href="/auth" className="text-xs underline" style={{ color: 'rgba(255,255,255,0.5)' }}>Área Restrita</a>
```

**Para:**
```
<a href="/auth" className="hover:opacity-80 transition-opacity" style={{ color: 'rgba(255,255,255,0.5)' }} title="Área Restrita" aria-label="Área Restrita">
  <Lock className="h-5 w-5" />
</a>
```

### Detalhes Técnicos

- Importar o ícone `Lock` do `lucide-react` (já instalado)
- Manter `title` e `aria-label` para acessibilidade (tooltip ao passar o mouse)
- Remover o texto e underline, deixando apenas o ícone
- Manter a mesma cor discreta (`rgba(255,255,255,0.5)`) e efeito hover

