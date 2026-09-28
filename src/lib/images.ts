/**
 * Compression des images dans le navigateur avant enregistrement Firestore.
 * Un document Firestore est limite a 1 Mo : on vise 850 Ko au plus pour la
 * data URL, en reduisant d'abord la qualite JPEG puis la resolution.
 */

const LIMITE_OCTETS = 850_000;

function lireFichier(fichier: File): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const r = new FileReader();
    r.onload = () => resoudre(String(r.result));
    r.onerror = () => rejeter(new Error('Lecture du fichier impossible.'));
    r.readAsDataURL(fichier);
  });
}

function chargerImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resoudre, rejeter) => {
    const img = new Image();
    img.onload = () => resoudre(img);
    img.onerror = () => rejeter(new Error("Ce fichier n'est pas une image lisible."));
    img.src = src;
  });
}

/** Recompresse une image deja en data URL (reprise des anciennes donnees). */
export async function recompresserDataUrl(source: string, coteMax = 1600, transparence = false): Promise<string> {
  if (source.length <= LIMITE_OCTETS && (transparence || source.startsWith('data:image/jpeg'))) return source;
  const blob = await (await fetch(source)).blob();
  return compresserImage(new File([blob], 'image', { type: blob.type }), coteMax, transparence);
}

/**
 * @param coteMax plus grand cote en pixels (1600 = ~ 390 dpi pour une A7,
 *                ~ 190 dpi pour une A4)
 * @param transparence garder le PNG (pictos detoures)
 */
export async function compresserImage(fichier: File, coteMax = 1600, transparence = false): Promise<string> {
  const source = await lireFichier(fichier);
  const img = await chargerImg(source);
  let cote = coteMax;
  for (let essai = 0; essai < 8; essai++) {
    const echelle = Math.min(1, cote / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * echelle));
    const h = Math.max(1, Math.round(img.naturalHeight * echelle));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canevas indisponible.');
    if (!transparence) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const qualites = [0.9, 0.82, 0.74];
    if (transparence) {
      const png = canvas.toDataURL('image/png');
      if (png.length <= LIMITE_OCTETS) return png;
    } else {
      for (const q of qualites) {
        const jpg = canvas.toDataURL('image/jpeg', q);
        if (jpg.length <= LIMITE_OCTETS) return jpg;
      }
    }
    cote = Math.round(cote * 0.8);
  }
  throw new Error('Image trop lourde, meme compressee. Utilisez une image plus simple.');
}

/** Poids lisible d'une data URL. */
export function poids(dataUrl: string | null | undefined): string {
  if (!dataUrl) return '—';
  const o = Math.round((dataUrl.length * 3) / 4);
  return o > 1_000_000 ? `${(o / 1_000_000).toFixed(1)} Mo` : `${Math.round(o / 1000)} Ko`;
}
