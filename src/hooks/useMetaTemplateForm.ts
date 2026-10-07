import { useState } from 'react';
import { dynamicTemplateButtons, getTemplateVariables, initialTemplateValues, templateButtonError, templateValuesFor, templateVariablesFilled, type VariableTemplate } from '@/lib/metaTemplateVariables';

export function useMetaTemplateForm(template: VariableTemplate | null | undefined, open: boolean, name = '') {
  const key = `${open}:${template?.id || ''}`;
  const variables = getTemplateVariables(template);
  const initial = { key, values: initialTemplateValues(variables, name), buttonUrl: String(template?.variaveis?._button_url || '') };
  const [state, setState] = useState(initial);
  // Reset before rendering a newly selected template, not after an effect.
  if (state.key !== key) setState(initial);
  const form = state.key === key ? state : initial;
  const buttons = dynamicTemplateButtons(template);
  const linkError = templateButtonError(template, form.buttonUrl);
  return {
    variables, values: form.values, buttonUrl: form.buttonUrl, buttons, linkError,
    bodyValues: templateValuesFor(variables, form.values, 'body'),
    headerValues: templateValuesFor(variables, form.values, 'header'),
    filled: templateVariablesFilled(variables, form.values) && !linkError,
    setValue: (id: string, value: string) => setState(current => ({ ...(current.key === key ? current : initial), values: { ...form.values, [id]: value } })),
    setButtonUrl: (buttonUrl: string) => setState(current => ({ ...(current.key === key ? current : initial), buttonUrl })),
  };
}