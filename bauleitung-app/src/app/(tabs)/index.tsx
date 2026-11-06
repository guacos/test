import { Leer, Seite, Ueberschrift } from '../../ui/bausteine';
import { MitProjekt } from '../../ui/Rahmen';

export default function BoardScreen() {
  return (
    <MitProjekt>
      <Seite>
        <Ueberschrift>Wochen-Board</Ueberschrift>
        <Leer text="Das Wochen-Board folgt in Schritt 3." />
      </Seite>
    </MitProjekt>
  );
}
