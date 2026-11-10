import { router } from 'expo-router';
import { Knopf, Leer, Seite, Zeile } from '../ui/bausteine';
import { useApp } from '../state/useApp';

export default function ProjektwahlScreen() {
  const projekte = useApp((s) => s.projekte);
  const aktiv = useApp((s) => s.aktivesProjektId);
  const waehlen = useApp((s) => s.projektWaehlen);

  return (
    <Seite>
      {projekte.length === 0 ? <Leer icon="briefcase-outline" text="Noch kein Projekt angelegt." /> : null}
      {projekte.map((p) => (
        <Zeile
          key={p.id}
          testID={`wahl-${p.nr}`}
          icon={p.id === aktiv ? 'check-circle' : 'briefcase-outline'}
          titel={`${p.nr} · ${p.name}`}
          untertitel={[p.bauherr, p.kiErlaubt ? 'KI an' : 'KI aus'].filter(Boolean).join(' · ')}
          aktiv={p.id === aktiv}
          onPress={async () => {
            await waehlen(p.id);
            useApp.setState({ boardKw: null });
            router.back();
          }}
        />
      ))}
      <Knopf titel="Neues Projekt" icon="plus" onPress={() => router.replace('/projekte/neu')} testID="wahl-neu" />
      <Knopf titel="Projekte verwalten" art="neben" onPress={() => router.replace('/projekte')} />
    </Seite>
  );
}
