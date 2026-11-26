import { useLayoutEffect, useRef, useState } from 'react';
import { TYPES_CAMPAGNE, TYPES_ORDONNES } from '../../config/constants';
import { totalComptes, type Intervalle } from '../../lib/statistiques';
import './Graphiques.css';

const HAUTEUR = 260;
const MARGE = { haut: 16, droite: 8, bas: 28, gauche: 40 };
const ECART = 2; // espace blanc entre segments empiles
const RAYON = 4; // extremite arrondie

/** Graduations « rondes » : 0, 5, 10… ou 0, 20, 40… */
function graduations(max: number): number[] {
  if (max <= 0) return [0, 1];
  const brut = max / 4;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = Math.max(1, Math.round([1, 2, 5, 10].map((m) => m * puissance).find((p) => p >= brut) ?? puissance * 10));
  const liste: number[] = [];
  for (let v = 0; v <= max + pas - 1; v += pas) liste.push(v);
  if (liste[liste.length - 1]! < max) liste.push(liste[liste.length - 1]! + pas);
  return liste;
}

/** Rectangle arrondi en haut seulement (base carree). */
function barreArrondie(x: number, y: number, l: number, h: number): string {
  const r = Math.min(RAYON, h, l / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + l - r}Q${x + l},${y} ${x + l},${y + r}V${y + h}Z`;
}

interface Props {
  readonly intervalles: readonly Intervalle[];
}

/**
 * Histogramme empile « elements par type de campagne » (A7, Vrac, Affiche, Balisage).
 * Survol ou focus d'une colonne : infobulle avec le detail et le total.
 */
export function GraphiqueCampagnes({ intervalles }: Props) {
  const conteneur = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(640);
  const [actif, setActif] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = conteneur.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setLargeur(Math.max(280, e!.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const max = Math.max(0, ...intervalles.map((i) => totalComptes(i.comptes)));
  const ticks = graduations(max);
  const haut = ticks[ticks.length - 1]!;
  const zoneL = largeur - MARGE.gauche - MARGE.droite;
  const zoneH = HAUTEUR - MARGE.haut - MARGE.bas;
  const bande = zoneL / Math.max(1, intervalles.length);
  const epaisseur = Math.min(24, bande * 0.62);
  const y = (v: number) => MARGE.haut + zoneH - (v / haut) * zoneH;
  // Un libelle sur n pour eviter les chevauchements (30 jours), cale sur la periode la plus recente.
  const pasLibelle = Math.max(1, Math.ceil(intervalles.length / Math.floor(zoneL / 44)));

  const survol = actif !== null ? intervalles[actif] : undefined;

  return (
    <div className="graphique" ref={conteneur}>
      <svg width={largeur} height={HAUTEUR} role="img" aria-label="Elements saisis par periode et par type de campagne">
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={MARGE.gauche}
              x2={largeur - MARGE.droite}
              y1={y(t)}
              y2={y(t)}
              className={t === 0 ? 'graphique__base' : 'graphique__grille'}
            />
            <text x={MARGE.gauche - 8} y={y(t)} dy="0.32em" textAnchor="end" className="graphique__axe">
              {t.toLocaleString('fr-FR')}
            </text>
          </g>
        ))}

        {intervalles.map((i, index) => {
          const cx = MARGE.gauche + bande * index + bande / 2;
          const x = cx - epaisseur / 2;
          const estActif = actif === index;
          const segments = TYPES_ORDONNES.filter((t) => i.comptes[t] > 0);
          let sommet = y(0);
          return (
            <g key={i.cle} className={actif !== null && !estActif ? 'graphique__col--attenue' : undefined}>
              {segments.map((t, k) => {
                const h = y(0) - y(i.comptes[t]);
                const yTop = sommet - h;
                const dernier = k === segments.length - 1;
                sommet = yTop - ECART;
                const couleur = TYPES_CAMPAGNE[t].couleur;
                return dernier ? (
                  <path key={t} d={barreArrondie(x, yTop, epaisseur, h)} fill={couleur} />
                ) : (
                  <rect key={t} x={x} y={yTop} width={epaisseur} height={h} fill={couleur} />
                );
              })}
              {(intervalles.length - 1 - index) % pasLibelle === 0 ? (
                <text x={cx} y={HAUTEUR - 8} textAnchor="middle" className="graphique__axe">
                  {i.libelle}
                </text>
              ) : null}
              {/* Zone de survol : toute la hauteur de la colonne */}
              <rect
                x={MARGE.gauche + bande * index}
                y={MARGE.haut}
                width={bande}
                height={zoneH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${i.libelleLong} : ${totalComptes(i.comptes)} element(s)`}
                onMouseEnter={() => setActif(index)}
                onMouseLeave={() => setActif(null)}
                onFocus={() => setActif(index)}
                onBlur={() => setActif(null)}
              />
            </g>
          );
        })}
      </svg>

      {survol && actif !== null ? (
        <div
          className="graphique__infobulle"
          style={{
            left: Math.min(Math.max(MARGE.gauche + bande * actif + bande / 2, 90), largeur - 90),
            top: Math.max(0, y(totalComptes(survol.comptes)) - 12),
          }}
          role="status"
        >
          <strong>{survol.libelleLong}</strong>
          {TYPES_ORDONNES.map((t) => (
            <span key={t}>
              <i style={{ background: TYPES_CAMPAGNE[t].couleur }} /> {TYPES_CAMPAGNE[t].court} <b>{survol.comptes[t]}</b>
            </span>
          ))}
          <span className="graphique__infobulle-total">
            Total <b>{totalComptes(survol.comptes)}</b>
          </span>
        </div>
      ) : null}
    </div>
  );
}
