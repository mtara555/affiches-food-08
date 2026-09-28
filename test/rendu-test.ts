import { dessinerElement, type Reference } from '../src/rendu';
import { PARAMETRES_DEFAUT } from '../src/lib/parametres';
import { gabaritsA7ParDefaut } from '../src/lib/gabarits';
import { gabaritsAfficheParDefaut } from '../src/rendu/affiche';
import { gabaritsBalisageParDefaut } from '../src/rendu/balisage';
import { pdfAffiches, pdfBalisage, pdfEtiquettesA7 } from '../src/rendu/pdf';
import type { GabaritA7, SaisieElement } from '../src/lib/types';
import type { TypeCampagne } from '../src/config/constants';

function fondA7(couleur: string): string {
  const c = document.createElement('canvas'); c.width = 740; c.height = 1050;
  const x = c.getContext('2d')!;
  x.fillStyle = couleur; x.fillRect(0, 0, 740, 1050);
  x.fillStyle = '#ffffff22'; x.fillRect(0, 0, 740, 180);
  x.fillStyle = '#ffffff'; x.font = 'bold 40px sans-serif'; x.fillText('FOND TEST', 30, 100);
  return c.toDataURL('image/jpeg', 0.9);
}

const a7: GabaritA7[] = gabaritsA7ParDefaut().map((g) => (g.id === 'PAT' || g.id === 'B_FIL' ? { ...g, image: fondA7(g.id === 'PAT' ? '#7a3b10' : '#123a7a') } : g));
const ref: Reference = {
  parametres: PARAMETRES_DEFAUT,
  mapA7: new Map(a7.map((g) => [g.id, g])),
  mapAffiche: new Map(gabaritsAfficheParDefaut().map((g) => [g.id, g])),
  mapBalisage: new Map(gabaritsBalisageParDefaut().map((g) => [g.id, g])),
  mapPictos: new Map(),
};

const exA7 = (gabarit: string, extra: Record<string, string> = {}) => ({
  code: '2690012000000', designationFr: 'CROISSANT PUR BEURRE AMANDES GRAND FORMAT', designationAr: 'كرواسون بالزبدة واللوز',
  prix: '3,50', unite: 'pièce', gabarit, grammage: '', fidelite: '',
  ingredientsFr: 'Farine de BLÉ, beurre (LAIT), sucre, OEUFS, AMANDES 12%, levure, sel, arôme naturel, émulsifiant: lécithine de SOJA.',
  ingredientsAr: 'دقيق القمح، زبدة، سكر، بيض، لوز 12٪، خميرة، ملح، نكهة طبيعية، صويا',
  origine: 'France', ...extra,
});

const cas: [TypeCampagne, SaisieElement][] = [
  ['A7', exA7('PAT')],
  ['A7', exA7('B_FIL', { prix: '89,90', unite: 'kg', grammage: '1,2', fidelite: '10' })],
  ['A7', exA7('FROM', { origine: '' })],
  ['AFFICHE', { code: '6111234567890', desFR: 'Huile de table Lesieur 5L', desAR: 'زيت المائدة 5 لتر', barre: 99.9, promo: 79.9, fidelite: 5, secteur: 'food', picto: '', gabarit: 'MARJANE_BLEU' }],
  ['AFFICHE', { code: '6111234567890', desFR: 'Téléviseur 55 pouces', desAR: 'تلفاز 55 بوصة', barre: 5999, promo: 4999, fidelite: 0, secteur: 'nonfood', picto: '', gabarit: 'MARJANE_JAUNE' }],
  ['AFFICHE', { code: '123', desFR: 'Yaourt', desAR: '', barre: 3, promo: 2.5, fidelite: 0, secteur: 'food', picto: '', gabarit: 'PROMO_ROUGE' }],
  ['BALISAGE', { code: '', gabarit: 'BOUL', desFR: 'Pain complet aux céréales', desAR: 'خبز كامل بالحبوب', ingFR: 'Farine de BLÉ complète, eau, graines de SÉSAME, graines de lin, levure, sel, gluten.', ingAR: 'دقيق القمح الكامل، ماء، سمسم، بذور الكتان، خميرة، ملح' }],
  ['BALISAGE', { code: '', gabarit: 'PAT', desFR: 'Tarte aux fraises', desAR: 'تارت بالفراولة', ingFR: 'Pâte sablée (farine de BLÉ, beurre, OEUFS), crème pâtissière (LAIT), fraises.', ingAR: 'عجين، زبدة، بيض، حليب، فراولة' }],
];

(async () => {
  const zone = document.getElementById('zone')!;
  for (const [type, e] of cas) {
    const c = document.createElement('canvas');
    await dessinerElement(type, e, ref, c, type === 'AFFICHE' ? 1 : 1.5);
    zone.appendChild(c);
  }
  // PDF
  const dess = (type: TypeCampagne, liste: SaisieElement[], k: number) => (c: HTMLCanvasElement, i: number) => dessinerElement(type, liste[i]!, ref, c, k, { signature: true });
  const a7s = cas.filter((x) => x[0] === 'A7').map((x) => x[1]);
  const affs = cas.filter((x) => x[0] === 'AFFICHE').map((x) => x[1]);
  const bals = cas.filter((x) => x[0] === 'BALISAGE').map((x) => x[1]);
  const r1 = await pdfEtiquettesA7(5, (c, i) => dess('A7', a7s, 4)(c, i % 3), 'Test', true);
  const r2 = await pdfAffiches(3, 'A5', dess('AFFICHE', affs, 4), 'Test');
  const r3 = await pdfBalisage(9, (c, i) => dess('BALISAGE', bals, 5)(c, i % 2), 'Test');
  const b64 = async (b: Blob) => { const buf = new Uint8Array(await b.arrayBuffer()); let s = ''; for (const x of buf) s += String.fromCharCode(x); return btoa(s); };
  (window as any).pdfs = { a7: await b64(r1.blob), a5: await b64(r2.blob), bal: await b64(r3.blob) };
  (window as any).fini = true;
})().catch((e) => { (window as any).erreur = String(e?.stack ?? e); });
