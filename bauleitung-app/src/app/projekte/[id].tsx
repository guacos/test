import { router, useLocalSearchParams } from 'expo-router';
import { Leer, Seite } from '../../ui/bausteine';
import { bestaetigen } from '../../ui/bestaetigen';
import { ProjektFormular } from '../../ui/ProjektFormular';
import { useApp } from '../../state/useApp';

export default function ProjektBearbeitenScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useApp((s) => s.projekte.find((x) => x.id === id));
  const loeschen = useApp((s) => s.projektLoeschen);
  const zurueck = () => (router.canGoBack() ? router.back() : router.replace('/projekte'));

  if (!p) {
    return (
      <Seite>
        <Leer text="Projekt nicht gefunden." />
      </Seite>
    );
  }

  return (
    <ProjektFormular
      id={p.id}
      start={{ nr: p.nr, name: p.name, bauherr: p.bauherr, adresse: p.adresse, kiErlaubt: p.kiErlaubt }}
      onFertig={zurueck}
      onLoeschen={async () => {
        const ok = await bestaetigen(
          'Projekt löschen?',
          `${p.nr} · ${p.name} wird aus der App entfernt. Dateien in OneDrive bleiben erhalten.`,
        );
        if (!ok) return;
        await loeschen(p.id);
        zurueck();
      }}
    />
  );
}
