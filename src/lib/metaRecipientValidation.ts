import { z } from 'zod';
import { telefoneMeta } from '../../supabase/functions/_shared/meta-destinatario';
import { splitLinhaEnvio } from './valorBR';
import { recipientRecordLines } from './metaRecipientRecords';

const recipientPhoneSchema = z.string().trim().min(1).max(80).regex(/^[+\d\s().-]+$/);

export function validRecipientPhone(value: string): string | null {
  const parsed = recipientPhoneSchema.safeParse(value);
  return parsed.success ? telefoneMeta(parsed.data) : null;
}

/** Preserve entire imported rows; incomplete phones are not evidence of no WhatsApp. */
export function partitionRecipientLines(input: string): { validRaw: string; ignored: number } {
  const valid: string[] = [];
  let ignored = 0;
  for (const line of recipientRecordLines(input)) {
    if (!line.trim()) continue;
    const phone = splitLinhaEnvio(line.trim())[0] || '';
    if (validRecipientPhone(phone)) valid.push(line);
    else ignored++;
  }
  return { validRaw: valid.join('\n'), ignored };
}