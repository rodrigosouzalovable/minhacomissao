import { resolveButtonUrlParam } from '../../supabase/functions/_shared/meta-button-url';

export interface VariableTemplate {
  id?: string;
  body_text?: string | null;
  variaveis?: Record<string, any> | null;
}
export interface TemplateVariable {
  id: string;
  section: 'header' | 'body';
  key: string;
  hint: string;
  isName: boolean;
}

export function getTemplateVariables(template: VariableTemplate | null | undefined): TemplateVariable[] {
  if (!template) return [];
  const components = Array.isArray(template.variaveis?._components) ? template.variaveis._components : [];
  const header = components.find((c: any) => String(c?.type).toUpperCase() === 'HEADER');
  const body = components.find((c: any) => String(c?.type).toUpperCase() === 'BODY');
  const variables: TemplateVariable[] = [];
  const collect = (section: 'header' | 'body', text: string, examples: unknown[]) => {
    const keys = [...new Set(Array.from(text.matchAll(/\{\{\s*([a-zA-Z_0-9]+)\s*\}\}/g), match => match[1]))];
    keys.sort((a, b) => /^\d+$/.test(a) && /^\d+$/.test(b) ? Number(a) - Number(b) : 0);
    for (const key of keys) {
      const mapping = section === 'body' ? template.variaveis?.[key] : undefined;
      const mappedName = String(mapping || key).replace(/[{}]/g, '').trim();
      const example = /^\d+$/.test(key) ? examples[Number(key) - 1] : undefined;
      variables.push({
        id: `${section}:${key}`, section, key,
        hint: String(mapping || example || '').replace(/[{}]/g, '').trim(),
        isName: /^(nome|name|first_name|primeiro_nome|nome_cliente|customer_name)$/i.test(mappedName),
      });
    }
  };
  collect('header', String(header?.format).toUpperCase() === 'TEXT' ? String(header?.text || '') : '', header?.example?.header_text || []);
  collect('body', String(body?.text || template.body_text || ''), body?.example?.body_text?.[0] || []);
  return variables;
}

export function initialTemplateValues(variables: TemplateVariable[], name = ''): Record<string, string> {
  return Object.fromEntries(variables.map(variable => [variable.id, variable.isName ? name.trim().split(/\s+/)[0] || '' : '']));
}

export function templateValuesFor(variables: TemplateVariable[], values: Record<string, string>, section: 'header' | 'body') {
  return Object.fromEntries(variables.filter(variable => variable.section === section)
    .map(variable => [variable.key, (values[variable.id] || '').trim()]));
}

export function templateVariablesFilled(variables: TemplateVariable[], values: Record<string, string>): boolean {
  return variables.every(variable => Boolean(values[variable.id]?.trim()));
}

export function dynamicTemplateButtons(template: VariableTemplate | null | undefined): { text: string; url: string }[] {
  const components = template?.variaveis?._components;
  const buttons = Array.isArray(components) ? components.find((c: any) => String(c?.type).toUpperCase() === 'BUTTONS')?.buttons : [];
  return Array.isArray(buttons) ? buttons.filter((button: any) => String(button?.type).toUpperCase() === 'URL' && /\{\{\s*\d+\s*\}\}/.test(button?.url || '')) : [];
}

export function templateButtonError(template: VariableTemplate | null | undefined, link: string): string {
  try {
    for (const button of dynamicTemplateButtons(template)) resolveButtonUrlParam(button.url, link);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : 'Informe um link HTTPS válido para o botão.';
  }
}