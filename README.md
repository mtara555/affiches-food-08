# AFFICHES FOOD & NON FOOD — reconstruction étape par étape

Nouvelle version de « Marjane Étiquettes A7/A4 » (Marjane Tanger Médina 08) :
React + TypeScript + Vite, PWA sur GitHub Pages, données partagées sur Firebase.

| Étape | Contenu | État |
|---|---|---|
| 0 | Nouveau dépôt : structure React / Vite, déploiement automatique GitHub Pages | ✅ Terminé |
| 1 | Firebase : connexion, rôles, premier administrateur | ✅ Terminé |
| 2 | Catalogue articles + reprise des données de l'ancienne application | ⏳ En cours |
| 3 | Gabarits A7 / affiches / balisage, pictos | À venir |
| 4 | Campagnes, saisie et impression A7 | À venir |
| 5 | Affiches promo A3 / A4 / A5 | À venir |
| 6 | Balisage BOUL / PAT | À venir |
| 7 | Utilisateurs, journal, tableau de bord — mise en production | À venir |

## Ancienne application
Elle reste inchangée dans son dépôt d'origine :
<https://mtarabet72.github.io/G-n-rateur-A4-A7_marjane08_6-265/>.
Ses données seront reprises à l'étape 2 grâce au fichier « Sauvegarder tout » (JSON).

## Commandes (GitHub Codespaces)
| Commande | Effet |
|---|---|
| `npm install` | Installation |
| `npm run dev` | Serveur de développement |
| `npm run build` | Contrôle des types + compilation dans `dist/` |

## Affiches vrac (dimensions personnalisees)
Nouveau type de campagne « Vrac » (menu *Campagnes → Nouvelle campagne*) :
meme structure que l'etiquette A7 (designation FR/AR, prix, unite, fidelite, origine),
avec **largeur et hauteur au choix (30 a 420 mm)** et, au choix, **avec** ou **sans ingredients**.
- Les reglages sont enregistres dans la campagne et modifiables depuis l'ecran d'impression.
- Gabarits : ceux de l'A7 (memes fonds, memes mises en page, adaptes proportionnellement).
- PDF : imposition automatique sur A4 (portrait ou paysage, le plus de pieces par feuille) ;
  trop grande pour un A4 -> une affiche par page, a sa taille exacte.
- Moteur : `src/rendu/a7.ts` (`GeometrieA7`), imposition : `src/rendu/pdf.ts` (`pdfVrac`).
- Apres mise a jour, redeployer `firestore.rules` (nouveaux champs de campagne autorises).
