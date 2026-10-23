import { useEffect } from 'react';

const ANDROID = 'https://play.google.com/store/apps/details?id=com.ume&pcampaignid=web_share';
const IOS = 'https://apps.apple.com/br/app/ume-cr%C3%A9dito-pix-e-mais/id6633412884';

export default function RedirectAppUme() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const ios = /iPhone|iPad|iPod|Macintosh/i.test(ua) && !/Android/i.test(ua);
  const destino = ios ? IOS : ANDROID;
  useEffect(() => { window.location.replace(destino); }, [destino]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-lg font-medium">Abrindo o App UME…</p>
      <a className="underline" href={ANDROID}>Baixar para Android</a>
      <a className="underline" href={IOS}>Baixar para iPhone</a>
    </div>
  );
}
