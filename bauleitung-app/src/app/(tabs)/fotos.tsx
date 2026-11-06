import { Leer, Seite, Ueberschrift } from '../../ui/bausteine';
import { MitProjekt } from '../../ui/Rahmen';

export default function FotosScreen() {
  return (
    <MitProjekt>
      <Seite>
        <Ueberschrift>Fotodokumentation</Ueberschrift>
        <Leer text="Die Fotodokumentation folgt in Schritt 4." />
      </Seite>
    </MitProjekt>
  );
}
