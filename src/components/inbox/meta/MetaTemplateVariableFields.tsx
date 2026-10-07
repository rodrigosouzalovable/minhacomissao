import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { useMetaTemplateForm } from '@/hooks/useMetaTemplateForm';

export function MetaTemplateVariableFields({ form, disabled = false }: { form: ReturnType<typeof useMetaTemplateForm>; disabled?: boolean }) {
  return <div className="space-y-3">
    {form.variables.map(variable => {
      const id = `template-${variable.section}-${variable.key}`;
      return <div key={variable.id} className="space-y-1">
        <Label htmlFor={id} className="text-xs">
          {variable.section === 'header' ? 'Cabeçalho' : 'Mensagem'} {'{{'}{variable.key}{'}}'}{variable.hint ? ` — ${variable.hint}` : ''} *
        </Label>
        <Input id={id} required disabled={disabled} value={form.values[variable.id] || ''}
          placeholder={`Valor para {{${variable.key}}}`} onChange={event => form.setValue(variable.id, event.target.value)} />
      </div>;
    })}
    {form.buttons.length > 0 && <div className="space-y-1">
      <Label htmlFor="template-button-url" className="text-xs">Link do botão — {form.buttons.map(button => button.text).join(', ')} *</Label>
      <Input id="template-button-url" type="url" required disabled={disabled} value={form.buttonUrl}
        aria-invalid={Boolean(form.linkError)} placeholder="https://" onChange={event => form.setButtonUrl(event.target.value)} />
      {form.linkError && <p className="text-xs text-destructive">{form.linkError}</p>}
    </div>}
  </div>;
}