import { router } from 'expo-router';
import type { Firma } from '../../domain/types';
import { useAktivesProjekt } from '../../state/useApp';
import { useDaten } from '../../state/useDaten';
import { Knopf, Leer, Seite, Zeile } from '../../ui/bausteine';
import { MitProjekt, Titel } from '../../ui/Rahmen';

export default function FirmenScreen() {
  return (
    <>
      <Titel text="Firmen" zurueckZu="/mehr" />
      <MitProjekt>
        <Liste />
      </MitProjekt>
    </>
  );
}

function Liste() {
  const projekt = useAktivesProjekt()!;
  const firmen = useDaten<Firma>('firma', projekt.id);
  if (!firmen) return null;
  const sortiert = [...firmen].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return (
    <Seite>
      <Knopf titel="Neue Firma" icon="plus" onPress={() => router.push({ pathname: '/firmen/[id]', params: { id: 'neu' } })} testID="firma-neu" />
      {sortiert.length === 0 ? <Leer icon="account-hard-hat" text="Noch keine Firmen. Lege Nachunternehmer an – sie erscheinen dann bei Jour Fixe, Bautagebuch, Mängeln und Lieferscheinen zur Auswahl." /> : null}
      {sortiert.map((f) => (
        <Zeile
          key={f.id}
          testID={`firma-${f.name}`}
          icon="account-hard-hat"
          titel={f.name}
          untertitel={[f.gewerk, f.ansprechpartner, f.telefon, f.email].filter(Boolean).join(' · ')}
          onPress={() => router.push({ pathname: '/firmen/[id]', params: { id: f.id } })}
        />
      ))}
    </Seite>
  );
}
