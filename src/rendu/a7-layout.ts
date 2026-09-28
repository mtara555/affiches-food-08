/**
 * Mises en page A7 par defaut — valeurs relevees dans le modele PowerPoint
 * A7_AVRIL2026 (diapositive 74 × 105 mm).
 * Positions en fraction du canevas (0..1), tailles en px du canevas 222 × 315.
 * Rectangle 6 = designation FR, 7 = designation AR, 9 = prix, 10 = unite,
 * 3 = allergenes, 4 = ingredients, 11 = fidelite (B_FIL, B_FIL_MN, FROM_CAN).
 * Un administrateur peut surcharger chaque valeur par gabarit (ecran Gabarits).
 */

import type { LayoutA7 } from '../lib/types';

export const LAYOUT_A7_DEFAUT: Readonly<Record<string, LayoutA7>> = {
    PAT: {
      yDesFR:0.2198, yDesAR:0.3190, fzDesFR:28, fzDesAR:20,
      priceY:0.4008, uniteX:0.97, uniteY:0.4008, fzUnite:16,
      ingY:0.7499,   ingBoxW:214, ingBoxH:46, ingBoxX:3,
      ingArY:0.7881, ingArBoxH:44,
      fzIngFR:8, fzIngAR:7,
      fzPrixInt:52, fzPrixDec:16,
      allergyY:0.7261
    },
    PAT_M: {
      yDesFR:0.2198, yDesAR:0.3190, fzDesFR:28, fzDesAR:20,
      priceY:0.4008, uniteX:0.97, uniteY:0.4008, fzUnite:16,
      ingY:0.7466,   ingBoxW:214, ingBoxH:46, ingBoxX:3,
      ingArY:0.7829, ingArBoxH:44,
      fzIngFR:8, fzIngAR:7,
      fzPrixInt:52, fzPrixDec:16,
      allergyY:0.7181
    },
    BOUL: {
      yDesFR:0.2198, yDesAR:0.3190, fzDesFR:28, fzDesAR:20,
      priceY:0.4008, uniteX:0.97, uniteY:0.4008, fzUnite:16,
      ingY:0.7532,   ingBoxW:214, ingBoxH:46, ingBoxX:3,
      ingArY:0.7881, ingArBoxH:44,
      fzIngFR:8, fzIngAR:7,
      fzPrixInt:52, fzPrixDec:16,
      allergyY:0.7261
    },
    B_AGN: {
      yDesFR:0.2822, yDesAR:0.3814, fzDesFR:28, fzDesAR:20,
      priceY:0.5502, uniteX:0.97, uniteY:0.5502, fzUnite:16,
      ingY:0.8606,   ingBoxW:196, ingBoxH:40, ingBoxX:10,
      ingArY:0.9176, ingArBoxH:38,
      fzIngFR:8, fzIngAR:7,
      fzPrixInt:52, fzPrixDec:16,
      allergyY:0.8606
    },
    B_FIL: {
      yDesFR:0.2629, yDesAR:0.3814, fzDesFR:26, fzDesAR:18,
      priceY:0.5346, uniteX:0.57, uniteY:0.5346, fzUnite:14,
      ingY:0.8579,   ingBoxW:196, ingBoxH:40, ingBoxX:10,
      ingArY:0.9283, ingArBoxH:38,
      fzIngFR:8, fzIngAR:7,
      fzPrixInt:40, fzPrixDec:12,
      allergyY:0.8579,
      // Fidélité — Rectangle 11
      fidX:0.5960, fidY:0.5346, fidW:0.3767, fidH:0.2917,
      fzFidInt:24, fzFidDec:10,
      // Labels arabes fidélité
      fidLabelArabicY:0.7191, fidRbhY:0.5785
    },
    B_FIL_MN: {
      yDesFR:0.1996, yDesAR:0.3002, fzDesFR:26, fzDesAR:18,
      priceY:0.4008, uniteX:0.55, uniteY:0.4008, fzUnite:13,
      ingY:0.7675,   ingBoxW:214, ingBoxH:44, ingBoxX:3,
      ingArY:0.8161, ingArBoxH:42,
      fzIngFR:8, fzIngAR:7,
      fzPrixInt:40, fzPrixDec:12,
      allergyY:0.7261,
      // Fidélité — Rectangle 11
      fidX:0.6024, fidY:0.4008, fidW:0.3546, fidH:0.2917,
      fzFidInt:24, fzFidDec:10,
      fidLabelArabicY:0.5860, fidRbhY:0.4255
    },
    B_BCK: {
      yDesFR:0.2607, yDesAR:0.3629, fzDesFR:28, fzDesAR:20,
      priceY:0.5215, uniteX:0.97, uniteY:0.5215, fzUnite:16,
      ingY:0.8740,   ingBoxW:196, ingBoxH:40, ingBoxX:10,
      ingArY:0.9430, ingArBoxH:38,
      fzIngFR:8, fzIngAR:7,
      fzPrixInt:52, fzPrixDec:16,
      allergyY:0.8740
    },
    B_VOL: {
      yDesFR:0.2685, yDesAR:0.3649, fzDesFR:28, fzDesAR:20,
      priceY:0.5038, uniteX:0.97, uniteY:0.5052, fzUnite:16,
      ingY:0.8220,   ingBoxW:196, ingBoxH:40, ingBoxX:10,
      ingArY:0.9114, ingArBoxH:38,
      fzIngFR:8, fzIngAR:7,
      fzPrixInt:52, fzPrixDec:16,
      allergyY:0.8220
    },
    'B_VOL-MN': {
      yDesFR:0.2314, yDesAR:0.3190, fzDesFR:28, fzDesAR:20,
      priceY:0.4008, uniteX:0.97, uniteY:0.4008, fzUnite:16,
      ingY:0.7546,   ingBoxW:214, ingBoxH:46, ingBoxX:3,
      ingArY:0.7921, ingArBoxH:44,
      fzIngFR:8, fzIngAR:7,
      fzPrixInt:52, fzPrixDec:16,
      allergyY:0.7261
    },
    FROM: {
      yDesFR:0.2628, yDesAR:0.3549, fzDesFR:28, fzDesAR:20,
      priceY:0.4852, uniteX:0.97, uniteY:0.4838, fzUnite:16,
      ingY:0.8420,   ingBoxW:196, ingBoxH:40, ingBoxX:10,
      ingArY:0.9430, ingArBoxH:38,
      fzIngFR:8, fzIngAR:7,
      fzPrixInt:52, fzPrixDec:16,
      allergyY:0.8420
    },
    TRAIT: {
      yDesFR:0.2198, yDesAR:0.3190, fzDesFR:28, fzDesAR:20,
      priceY:0.4008, uniteX:0.97, uniteY:0.4008, fzUnite:16,
      ingY:0.7507,   ingBoxW:214, ingBoxH:46, ingBoxX:3,
      ingArY:0.7917, ingArBoxH:44,
      fzIngFR:8, fzIngAR:7,
      fzPrixInt:52, fzPrixDec:16,
      allergyY:0.7261
    },
    FROM_CAN: {
      yDesFR:0.2556, yDesAR:0.3348, fzDesFR:26, fzDesAR:18,
      priceY:0.4752, uniteX:0.56, uniteY:0.4752, fzUnite:13,
      ingY:0.8606,   ingBoxW:196, ingBoxH:40, ingBoxX:10,
      ingArY:0.9257, ingArBoxH:38,
      fzIngFR:8, fzIngAR:7,
      fzPrixInt:40, fzPrixDec:12,
      allergyY:0.8606,
      // Fidélité — Rectangle 11
      fidX:0.5963, fidY:0.4752, fidW:0.3882, fidH:0.2917,
      fzFidInt:24, fzFidDec:10,
      fidLabelArabicY:0.6973, fidRbhY:0.5057
    },
    GLACE: {
      yDesFR:0.3082, yDesAR:0.4132, fzDesFR:28, fzDesAR:20,
      priceY:0.6495, uniteX:0.97, uniteY:0.6489, fzUnite:16,
      ingY:0.75,     ingBoxW:214, ingBoxH:46, ingBoxX:3,
      ingArY:0.80,   ingArBoxH:44,
      fzIngFR:8, fzIngAR:7,
      fzPrixInt:52, fzPrixDec:16,
      allergyY:0.74
    }
};
