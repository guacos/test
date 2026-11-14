import { router } from 'expo-router';
import { useApp } from '../../state/useApp';
import { useSync } from '../../sync/dienst';
import { Abschnitt, Badge, Seite, Zeile } from '../../ui/bausteine';

export default function MehrScreen() {
  const anzahl = useApp((s) => s.projekte.length);
  const autor = useApp((s) => s.autor);
  const sync = useSync();
  const kontoText = sync.konto
    ? `${sync.konto.name || sync.konto.email} · ${sync.konflikte ? `${sync.konflikte} Konflikt(e)` : sync.offen ? `${sync.offen} Änderung(en) warten` : 'abgeglichen'}`
    : 'Nicht angemeldet – Daten liegen nur auf diesem Gerät';

  return (
    <Seite>
      <Abschnitt titel="Baustelle">
        <Zeile icon="notebook-edit" titel="Bautagebuch" untertitel="Wetter, Firmen und Arbeiter, Notizen" onPress={() => router.push('/bautagebuch')} testID="mehr-bautagebuch" />
        <Zeile icon="alert-octagon-outline" titel="Mängel" untertitel="Foto, Pin im Grundriss, Firma, Frist, Mängelliste als PDF" onPress={() => router.push('/maengel')} testID="mehr-maengel" />
        <Zeile icon="truck-delivery" titel="Lieferscheine" untertitel="Fotografieren, prüfen, mit geplanter Lieferung verknüpfen" onPress={() => router.push('/lieferscheine')} testID="mehr-lieferscheine" />
        <Zeile icon="file-document-multiple" titel="Unterlagen und KI-Assistent" untertitel="Pläne, LV, Verträge offline ansehen; Fragen mit Quellenangabe" onPress={() => router.push('/unterlagen')} testID="mehr-unterlagen" />
        <Zeile icon="account-hard-hat" titel="Firmen" untertitel="Nachunternehmer und Ansprechpartner" onPress={() => router.push('/firmen')} testID="mehr-firmen" />
        <Zeile icon="magnify" titel="Suche" untertitel="Alle Bereiche, auch projektübergreifend" onPress={() => router.push('/suche')} testID="mehr-suche" />
      </Abschnitt>

      <Abschnitt titel="Verwaltung">
        <Zeile
          icon="briefcase"
          titel="Projekte"
          untertitel={`${anzahl} ${anzahl === 1 ? 'Projekt' : 'Projekte'}`}
          onPress={() => router.push('/projekte')}
          testID="projekte-verwalten"
        />
        <Zeile
          icon="microsoft"
          ton={sync.konflikte ? 'rot' : sync.konto ? 'ok' : 'neutral'}
          titel="Microsoft-Konto und Abgleich"
          untertitel={kontoText}
          rechts={sync.konflikte ? <Badge text={String(sync.konflikte)} ton="rot" /> : undefined}
          onPress={() => router.push('/sync')}
          testID="mehr-sync"
        />
        <Zeile icon="cog" titel="Einstellungen" untertitel={`Name: ${autor} · Gewerke, Geschosse, KI-Backend`} onPress={() => router.push('/einstellungen')} testID="mehr-einstellungen" />
      </Abschnitt>
    </Seite>
  );
}
