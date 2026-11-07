import { dessinerElement, type Reference } from '../src/rendu';
import { PARAMETRES_DEFAUT } from '../src/lib/parametres';
import { gabaritsAfficheParDefaut } from '../src/rendu/affiche';
import type { GabaritAffiche } from '../src/lib/types';

function fondBlanc(): string {
  const c = document.createElement('canvas'); c.width = 794; c.height = 1123;
  const x = c.getContext('2d')!; x.fillStyle = '#ffffff'; x.fillRect(0, 0, 794, 1123);
  return c.toDataURL('image/png');
}
const params = new URLSearchParams(location.search);
const barre = Number(params.get('barre') ?? 36.25);
const promo = Number(params.get('promo') ?? 32.5);
const fid = Number(params.get('fid') ?? 10);
const actif = params.get('actif') !== '0';
const base = gabaritsAfficheParDefaut()[0]!;
const g: GabaritAffiche = { ...base, id: 'FID', image: fondBlanc(), fidelite: { actif } };
const ref: Reference = {
  parametres: PARAMETRES_DEFAUT, mapA7: new Map(), mapBalisage: new Map(), mapPictos: new Map(),
  mapAffiche: new Map([['FID', g]]),
};
(async () => {
  const c = document.createElement('canvas');
  await dessinerElement('AFFICHE', { code: '6111032009139', desFR: 'PACK PROMO : SALIM LAIT UHT ENTIER 1/2L X6', desAR: 'حليب معقم', barre, promo, fidelite: fid, secteur: 'food', picto: '', gabarit: 'FID' }, ref, c, 794 / 420);
  document.getElementById('zone')!.appendChild(c);
  (window as any).fini = true;
})().catch((e) => { (window as any).erreur = String(e?.stack ?? e); });
