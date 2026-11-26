// Geschichte, Figuren und Funksprüche von Operation Y (alles eigene Texte)

export const CAST = {
  op: { name: 'Operator Ypsilon', role: 'Blaue Allianz · Einsatzleitung' },
  bolzen: { name: 'Bolzen', role: 'Läufer · übermotiviert' },
  kurbel: { name: 'Kurbel', role: 'Grenadier · noch 3 Tage bis zur Rente' },
  groll: { name: 'General Grollmann', role: 'Rote Kolonne · Oberbefehlshaber' },
};

const L = (who, text) => ({ who, text });

// Briefings je Level (id)
export const BRIEFINGS = {
  1: [
    L('groll', 'Hier spricht General Grollmann von der Roten Kolonne! Ihr Satellit parkt auf MEINEM reservierten Orbitplatz. Das ist Krieg!'),
    L('op', 'Wir haben geprüft. Auf dem Schild steht „Parken nur für Besucher“. Er ist kein Besucher.'),
    L('bolzen', 'Krieg?! Endlich! Ich hab mich schon dreimal poliert!'),
    L('kurbel', 'Ich hab noch drei Tage bis zur Rente. Wehe, das wird lang.'),
    L('op', 'Ziel: Flaggen erobern. Ein Roboter auf der Flagge, und der Sektor samt Fabriken gehört uns. Je mehr Gebiet, desto schneller bauen wir.'),
    L('op', 'Das Fort der Roten liegt im Osten. Zerstören oder seine Flagge halten. Und Bolzen: nicht wieder vor die eigene Kanone laufen.'),
    L('bolzen', 'Das war EIN Mal!'),
  ],
  2: [
    L('bolzen', 'Operator, mal ehrlich: Warum heißt das hier eigentlich „Operation Y“?'),
    L('op', 'Weil Z schon vergeben war.'),
    L('kurbel', 'Und X klang zu geheimnisvoll. Hab ich auf dem Formular gelesen.'),
    L('op', 'Konzentration. Ein Fluss teilt das Kupfertal. Fahrzeuge kommen nur über die Brücken.'),
    L('kurbel', 'Gut so. Ich geh nicht ins Wasser. Ich roste schon beim Duschen.'),
    L('groll', 'Die Brücken gehören der Roten Kolonne! Ich habe sie gestern persönlich angestarrt!'),
  ],
  3: [
    L('op', 'Frostgrat. Hier stehen verlassene Fahrzeuge einer alten Schlacht. Graue Fahrzeuge: Roboter auswählen, Rechtsklick drauf, einsteigen.'),
    L('bolzen', 'Ich fahre! Ich fahre!'),
    L('kurbel', 'Du hast keinen Führerschein.'),
    L('bolzen', 'Ich habe Zuversicht. Das ist fast dasselbe.'),
    L('groll', 'Es ist kalt hier. Ich verlange eine Heizung. Und eure Kapitulation. In dieser Reihenfolge.'),
  ],
  4: [
    L('op', 'Ein Eiswall trennt uns vom Feind. Die Pässe sind mit Geschütztürmen gesichert. Panzerjäger und Raketenwerfer knacken die am besten.'),
    L('groll', 'Ich habe Ihnen eine offizielle Beschwerde geschickt. In dreifacher Ausfertigung!'),
    L('op', 'Ist angekommen. Liegt jetzt unter „Altpapier, sehr dringend“.'),
    L('kurbel', 'Zwei Tage bis zur Rente. Ich halte mich hinten. Ganz hinten. Im Idealfall zu Hause.'),
  ],
  5: [
    L('op', 'Moorkessel. Dichter Wald, Fahrzeuge bleiben auf den Dämmen. Roboter kommen durchs Unterholz.'),
    L('kurbel', 'Hier quietscht alles. Oder das bin ich.'),
    L('bolzen', 'Ich hab einen Frosch gefunden! Er heißt jetzt Leutnant Quak und ist mein Stellvertreter.'),
    L('op', 'Leutnant Quak hat keine Befehlsgewalt.'),
    L('bolzen', 'Er hat genickt.'),
    L('groll', 'Ein Frosch? Die Rote Kolonne hat einen Hamster. Er ist Oberst.'),
  ],
  6: [
    L('op', 'Nebelsee. Auf der Insel stehen Radar und Fahrzeugwerk. Wer die Insel hält, sieht mehr und baut mehr.'),
    L('kurbel', 'Ich sehe gar nichts. Ist das der Nebel oder meine Linse?'),
    L('bolzen', 'Da hinten steht ein feindlicher Späher! Ganz still! Seit einer Stunde!'),
    L('op', 'Das ist ein Pappaufsteller, Bolzen.'),
    L('groll', 'Unsere Pappaufsteller sind hochmoderne Täuschungseinheiten! Sie haben uns ein Vermögen gekostet!'),
  ],
  7: [
    L('op', 'Schlackefeld. Lavaflüsse. Wer reinfährt, schmilzt. Die Roten setzen auf schwere Panzer.'),
    L('bolzen', 'Kann ich hier Marshmallows rösten?'),
    L('kurbel', 'Wir sind Roboter. Wir essen nicht.'),
    L('bolzen', 'Dann röste ich Schrauben.'),
    L('kurbel', 'Ein Tag bis zur Rente. Ich hab mir einen Liegestuhl bestellt. Hitzebeständig.'),
    L('groll', 'Dieses Feld ist heiß, aber mein Zorn ist heißer! Das hat mein Redenschreiber geschrieben. Gut, oder?'),
  ],
  8: [
    L('op', 'Glutkern. Grollmanns Hauptquartier. Drei Sektoren mit Werken, schwere Verteidigung. Das ist die Entscheidung.'),
    L('groll', 'Willkommen in meinem Hauptquartier! Bitte die Füße abtreten. Und dann verlieren.'),
    L('kurbel', 'Letzter Tag vor der Rente. Natürlich ist das die größte Schlacht. Natürlich.'),
    L('bolzen', 'Operator, falls ich das nicht überlebe: Leutnant Quak kriegt meine Ersatzschrauben.'),
    L('op', 'Du überlebst das. Du bist zu laut zum Sterben. Los geht’s.'),
  ],
};

// Epilog nach Level 8
export const EPILOGUE = [
  L('groll', 'Na schön. Die Rote Kolonne kapituliert. Unter einer Bedingung: Der Parkplatz wird geteilt.'),
  L('op', 'Gerade Tage blau, ungerade rot. Ich lasse das Schild drucken.'),
  L('kurbel', 'Und damit bin ich offiziell in Rente. Tschüss, ihr Blechbüchsen.'),
  L('bolzen', 'Operator … nächster Einsatz? Operation Z?'),
  L('op', 'Ist vergeben, Bolzen. Ist vergeben.'),
];

// Abschluss je Level: Sieg / Niederlage
export const OUTRO = {
  win: [
    [L('bolzen', 'Gewonnen! Ich hab nur zweimal auf mich selbst geschossen!')],
    [L('kurbel', 'Sieg. Schön. Kann ich jetzt nach Hause?')],
    [L('groll', 'Das zählt nicht! Ich hatte die Sonne im Auge! Und im Fort!')],
    [L('op', 'Sauber gemacht. Grollmann schreibt sicher gleich eine Beschwerde.')],
  ],
  lose: [
    [L('groll', 'HA! Der Parkplatz bleibt rot! Ich lasse ihn rot anstreichen!')],
    [L('kurbel', 'Na toll. Das kostet mich mindestens eine Woche Rente.')],
    [L('op', 'Das lief nicht. Wir versuchen es nochmal. Diesmal mit Plan.')],
  ],
};

// Funksprüche im Spiel, nach Ereignis
export const RADIO = {
  start: [
    L('op', 'Einsatz läuft. Flaggen zuerst, Heldentaten später.'),
    L('bolzen', 'Ich bin so bereit, ich vibriere!'),
    L('kurbel', 'Na dann. Bringen wir es hinter uns.'),
  ],
  capture: [
    L('bolzen', 'Flagge ist unser! Kann ich sie behalten?'),
    L('op', 'Sektor gesichert. Weiter so.'),
    L('bolzen', 'Noch eine! Ich sammle die jetzt!'),
    L('kurbel', 'Ein Sektor mehr. Ein Grund weniger, mich zu wecken.'),
  ],
  factory: [
    L('kurbel', 'Ein Werk. Endlich Nachschub, der nicht ich bin.'),
    L('op', 'Werk übernommen. Produktion läuft.'),
    L('bolzen', 'Neue Kollegen! Ich bring ihnen alles bei. Vor allem Rennen.'),
  ],
  lost: [
    L('op', 'Sektor verloren. Das schreibe ich nicht ins Protokoll.'),
    L('kurbel', 'Weg ist er. Wie meine Motivation.'),
    L('groll', 'Dieser Sektor ist hiermit Parkzone der Roten Kolonne!'),
  ],
  enemyCapture: [
    L('groll', 'Noch ein Sektor für mich! Ich stelle gleich ein Schild auf.'),
    L('groll', 'Rote Kolonne, vorwärts! Bitte ordentlich in Reihe.'),
  ],
  attacked: [
    L('kurbel', 'Wir werden beschossen. Wie immer.'),
    L('op', 'Kontakt! Verstärkung schicken.'),
    L('bolzen', 'Die schießen auf uns! Unhöflich!'),
  ],
  board: [
    L('bolzen', 'Ich fahre! Keine Sorge, ich hab das Handbuch angeschaut. Das Bild vorne drauf.'),
    L('kurbel', 'Endlich sitzen. Mein Rücken dankt.'),
  ],
  enemyBoard: [L('groll', 'Danke für das Fahrzeug! Ich schicke eine Dankeskarte. Mit Granate.')],
  bdestroy: [
    L('groll', 'Mein Gebäude! Das war frisch gestrichen!'),
    L('bolzen', 'Rumms! Hat das jemand gesehen?'),
  ],
  ownDestroy: [L('op', 'Wir haben ein Gebäude verloren. Wiederaufbau nach dem Krieg. Vielleicht.')],
  eject: [L('kurbel', 'Ausgestiegen. Freiwillig. Fast.')],
  idle: [
    L('bolzen', 'Operator? Darf ich mal den großen Panzer fahren? Nur kurz?'),
    L('kurbel', 'Wusstet ihr, dass meine Rente in Schrauben ausgezahlt wird?'),
    L('groll', 'Ich beobachte Sie! Also, mein Hamster beobachtet Sie. Er ist Oberst.'),
    L('bolzen', 'Leutnant Quak lässt grüßen!'),
    L('op', 'Kurzer Hinweis: Mehr Gebiet bedeutet schnellere Produktion.'),
    L('groll', 'Wussten Sie, dass ich drei Parkausweise besitze? Drei!'),
  ],
};

// Antworten der Einheiten beim Auswählen und bei Befehlen
export const QUIPS = {
  select: {
    runner: ['Ja?', 'Bereit!', 'Bin wach!', 'Wohin rennen?'],
    grenadier: ['Hm?', 'Was denn jetzt?', 'Granaten sind geladen.', 'Ich war gerade so schön still.'],
    rocketeer: ['Rohr bereit.', 'Panzer in Sicht?', 'Ziel aufschalten?'],
    sniper: ['Ich sehe alles.', 'Leise, bitte.', 'Fokussiert.'],
    buggy: ['Brumm brumm!', 'Gas oder Vollgas?', 'Motor läuft!'],
    lighttank: ['Panzer bereit.', 'Kanone geladen.', 'Ketten gefettet.'],
    heavytank: ['Ich bin groß.', 'Langsam, aber sicher.', 'Platz da.'],
    launcher: ['Salve bereit.', 'Abstand halten!', 'Ich mag Abstand.'],
  },
  move: ['Bin unterwegs!', 'Wird gemacht!', 'Jawohl!', 'Los geht’s!', 'Schon wieder ich?', 'Okay, okay.'],
  attack: ['Feuer frei!', 'Den nehm ich!', 'Zielerfassung!', 'Für den Parkplatz!', 'Attacke!'],
  board: ['Ich fahre!', 'Steige ein!'],
};

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
