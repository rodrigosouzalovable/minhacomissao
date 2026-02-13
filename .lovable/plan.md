

## Plano: Ajustar header da pagina de negociacao

### Alteracoes

**Arquivo**: `src/pages/ConsultaResultado.tsx` (linhas 144-150)

Modificar o header para:
- Aumentar o tamanho da logo de `h-10` para `h-14`
- Remover o texto "GRUPO ALTUM"
- Manter apenas "Portal de Negociacao" abaixo da logo

**De:**
```tsx
<img src={logoGrupoAltum} alt="Grupo Altum" className="h-10" />
<div>
  <h1 className="text-lg font-bold" style={{ color: '#fff' }}>GRUPO ALTUM</h1>
  <p className="text-xs" style={{ color: '#ffffffaa' }}>Portal de Negociação</p>
</div>
```

**Para:**
```tsx
<img src={logoGrupoAltum} alt="Grupo Altum" className="h-14" />
<p className="text-sm" style={{ color: '#ffffffaa' }}>Portal de Negociação</p>
```

