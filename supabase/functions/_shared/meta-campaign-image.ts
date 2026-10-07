export const CAMPAIGN_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const CAMPAIGN_IMAGE_BUCKET = 'meta-template-media';

export function validateCampaignImageFile(type: string, size: number): string | null {
  if (!['image/jpeg', 'image/png'].includes(type)) return 'Use uma imagem JPG ou PNG.';
  if (size <= 0 || size > CAMPAIGN_IMAGE_MAX_BYTES) return 'A imagem deve ter no máximo 5 MB.';
  return null;
}

export function campaignImagePathAllowed(path: string, userId: string): boolean {
  return !!userId && path.startsWith(`${userId}/campaign-images/`) &&
    /^[a-zA-Z0-9/-]+\.(jpg|png)$/.test(path) && !path.includes('..');
}

export function campaignImageForTemplate(vars: Record<string, unknown> | undefined, template: { nome_template: string; idioma: string }): string | null {
  if (vars?._campaign_image_template !== `${template.nome_template}|${template.idioma}`) return null;
  return typeof vars._campaign_image_path === 'string' ? vars._campaign_image_path : null;
}

export function templateHasImage(template: { variaveis?: any }): boolean {
  const vars = template.variaveis || {};
  if (Array.isArray(vars._components) && vars._components.length) {
    return vars._components.some((c: any) => String(c?.type).toUpperCase() === 'HEADER' && String(c?.format).toUpperCase() === 'IMAGE');
  }
  return String(vars._header_format || '').toUpperCase() === 'IMAGE';
}

/** Clone the sending snapshot; never mutate the registered template or inherit old media IDs. */
export function withCampaignImage<T extends { variaveis?: any }>(template: T, url: string): T {
  if (!templateHasImage(template)) throw new Error('Este template não possui cabeçalho de imagem.');
  const vars = { ...(template.variaveis || {}), _header_image_url: url };
  delete vars._header_media_ids;
  return { ...template, variaveis: vars, _campaign_image: true };
}