import { router } from 'expo-router';
import { Knopf, Leer, Seite, Zeile } from '../../ui/bausteine';
import { Titel } from '../../ui/Rahmen';
import { useApp } from '../../state/useApp';

export default function ProjekteScreen() {
  const projekte = useApp((s) => s.projekte);
  const aktiv = useApp((s) => s.aktivesProjektId);

  return (
    <Seite>
      <Titel text="Projekte" />
      <Knopf titel="Neues Projekt" icon="plus" onPress={() => router.push('/projekte/neu')} testID="projekt-neu" />
      {projekte.length === 0 ? <Leer icon="briefcase-outline" text="Noch kein Projekt angelegt." /> : null}
      {projekte.map((p) => (
        <Zeile
          key={p.id}
          testID={`projekt-${p.nr}`}
          icon={p.id === aktiv ? 'check-circle' : 'briefcase-outline'}
          ton={p.id === aktiv ? 'ok' : 'navy'}
          titel={`${p.nr} · ${p.name}`}
          untertitel={[p.bauherr, p.adresse, p.kiErlaubt ? 'KI an' : 'KI aus'].filter(Boolean).join(' · ')}
          onPress={() => router.push({ pathname: '/projekte/[id]', params: { id: p.id } })}
        />
      ))}
    </Seite>
  );
}
