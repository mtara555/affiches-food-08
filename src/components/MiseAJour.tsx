/**
 * Mise a jour de l'application (PWA) : le service worker est remplace
 * automatiquement ; on propose simplement de recharger la page.
 */

import { useRegisterSW } from 'virtual:pwa-register/react';

export function MiseAJour() {
  const {
    needRefresh: [aRafraichir, setARafraichir],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, enregistrement) {
      // Verifie une nouvelle version toutes les heures (postes restant ouverts).
      if (enregistrement) window.setInterval(() => void enregistrement.update(), 60 * 60 * 1000);
    },
  });

  if (!aRafraichir) return null;
  return (
    <div className="notifications" style={{ pointerEvents: 'auto' }}>
      <div className="notification">
        Nouvelle version disponible.{' '}
        <button type="button" className="lien-bouton" style={{ color: '#ffd84a' }} onClick={() => void updateServiceWorker(true)}>
          Recharger
        </button>{' '}
        <button type="button" className="lien-bouton" style={{ color: '#aab0e0' }} onClick={() => setARafraichir(false)}>
          Plus tard
        </button>
      </div>
    </div>
  );
}
