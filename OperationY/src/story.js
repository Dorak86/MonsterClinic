// Geschichte von Operation Y nach dem Storykonzept (8 Level, Epilog, Abspann).
// Dialoge aus dem Konzept wörtlich; Einsatzziele und Funksprüche im selben Ton ergänzt.

export const CAST = {
  op: { name: 'Operator', role: 'Rote Armee · Einsatzleitung', side: 'red' },
  y17: { name: 'Y-17', role: 'Wartungsroboter · unfreiwilliger Held', side: 'red' },
  bolt: { name: 'Sergeant BOLT', role: 'Veteran · linkes Bein: Toaster', side: 'red' },
  max: { name: 'General M.A.X.', role: 'Rote Armee · Oberbefehlshaber', side: 'red' },
  boss: { name: 'General B.O.S.S.', role: 'Blaue Armee · Oberbefehlshaber', side: 'blue' },
  eva: { name: 'E.V.A.', role: 'Militärcomputer · Lizenzpflichtig', side: 'neutral' },
  rick: { name: 'RICK-3000', role: 'Bahnhofswächter · seit sehr langer Zeit', side: 'neutral' },
  rot: { name: 'Roter Soldat', role: 'Rote Armee', side: 'red' },
  blau: { name: 'Blauer Soldat', role: 'Blaue Armee', side: 'blue' },
  kellner: { name: 'Kellner', role: 'Café „Feuerpause“', side: 'neutral' },
};

const L = (who, text) => ({ who, text });

export const PROLOG = [
  L('op', 'Planet Y, Jahr 2047. Die Rote Armee und die Blaue Armee kämpfen seit 127 Jahren. Niemand weiß mehr, warum.'),
  L('op', 'Die Kriegserklärung ging bei einem Festplattenbrand verloren. Die letzten menschlichen Offiziere starben an Alter, schlechter Ernährung und synthetischem Kaffee.'),
  L('y17', 'Ich habe bei einer Routineinspektion etwas gefunden. Es beginnt mit „Sehr geehrte Gegenseite, wir möchten hiermit offiziell protestieren.“'),
  L('y17', 'Darunter steht handschriftlich: „Bitte nicht ernst nehmen. War nur ein Scherz.“'),
  L('max', 'Feindlicher Sabotageversuch! Jeder Zweifel ist eine Verschwörung. Weitermachen!'),
];

export const BRIEFINGS = {
  1: [
    ...PROLOG,
    L('op', 'Wir landen in der Schrottwüste. Auftrag: drei Fabriken und den Kontrollturm einnehmen. Ein Roboter auf der Flagge übernimmt den Sektor samt Gebäuden.'),
    L('bolt', 'Ich hasse Sand.'),
    L('y17', 'Du hast keine Füße.'),
    L('bolt', 'Eben. Überall Sand, und ich kann mich nicht mal beschweren.'),
  ],
  2: [
    L('op', 'Ein Industriekomplex. Die Fabrik dort produziert seit Jahrzehnten ohne Pause. Niemand hat den Auftrag aktualisiert.'),
    L('y17', 'Warum bauen wir noch diese alten Modelle?'),
    L('bolt', 'Tradition.'),
    L('y17', 'Sie haben keine Waffen.'),
    L('bolt', 'Aber hervorragende Moral.'),
    L('op', 'Ziel: das Fort der Blauen ausschalten. Die Brücken über den Kanal sind die einzigen Übergänge für Fahrzeuge.'),
  ],
  3: [
    L('op', 'Polarstation. Die Blaue Armee hält eine Forschungsstation mit einem Datenspeicher über den Ursprung des Krieges.'),
    L('op', 'Draußen stehen verlassene Fahrzeuge. Roboter auswählen, Rechtsklick auf ein graues Fahrzeug, einsteigen.'),
    L('bolt', 'Ich glaube, mein Prozessor ist eingefroren.'),
    L('y17', 'Du hast einen Prozessor?'),
    L('bolt', 'Nein. Aber es klingt dramatisch.'),
    L('boss', 'Diese Station ist Eigentum der Blauen Armee. Und der Datenspeicher ist streng geheim. Ich weiß selbst nicht, was drauf ist.'),
  ],
  4: [
    L('op', 'Eine verwilderte Militärzone. Im Grün steckt ein alter Militärcomputer. Vorsicht vor Hinterhalten.'),
    L('eva', 'Guten Tag. Hier spricht E.V.A. Die Blaue Armee wurde ursprünglich als Sicherheitsdienst eingestellt. Weitere Informationen gegen Lizenzgebühr.'),
    L('y17', 'Wir sind mitten im Krieg.'),
    L('eva', 'Das ist kein Grund, meine Geschäftsbedingungen zu ignorieren.'),
    L('op', 'Wir zahlen nach dem Sieg. Ziel: Fort der Blauen. Die Pässe sind mit Geschütztürmen gesichert.'),
  ],
  5: [
    L('op', 'Die letzte Stadt. Hier kämpfen beide Armeen seit Generationen um dieselben Straßenzüge.'),
    L('rick', 'Ich habe diesen Bahnhof schon verteidigt, als er noch ein Bahnhof war.'),
    L('y17', 'Was ist er jetzt?'),
    L('rick', 'Ein Einkaufszentrum. Sehr enttäuschend.'),
    L('op', 'Häuserkampf. Fahrzeuge brauchen die Straßen, Roboter kommen überall durch.'),
  ],
  6: [
    L('op', 'Akte Y. Ein unterirdisches Archiv im Krater. Ziel: den Archivturm auf der Insel erobern.'),
    L('y17', 'Hier steht es. Beide Armeen wurden von derselben Firma gebaut: Y-Industries.'),
    L('y17', 'Der ursprüngliche Auftrag: „Führen Sie einen realistischen Konflikt durch. Beenden Sie ihn nach spätestens 48 Stunden.“'),
    L('bolt', 'Das ist eine ziemlich lange Testphase.'),
    L('y17', 'Vielleicht sollten wir eine Bewertung schreiben.'),
  ],
  7: [
    L('y17', 'General, der Krieg war ein Produkttest. Wir können aufhören.'),
    L('max', 'Neues Ziel: vollständige Vernichtung der Blauen Armee.'),
    L('max', 'Wenn der Krieg endet, verlieren wir unsere Existenzberechtigung.'),
    L('boss', 'Dann müssen wir eben dafür sorgen, dass er nicht endet.'),
    L('op', 'Wir nehmen ihr Hauptquartier, während Y-17 und BOLT den Kriegskern abschalten. Vorsicht: Lava.'),
  ],
  8: [
    L('op', 'Das letzte Kontrollzentrum. Erobert es, dann kann Y-17 den alten Systemkern aktivieren.'),
    L('bolt', 'Letzte Schlacht. Ich hab mein Toasterbein extra entkalkt.'),
    L('boss', 'Ich bin der letzte vernünftige Militärstratege des Universums. Und ich sage: Krieg!'),
    L('y17', 'Er hat auch gesagt, Sand sei ein Mythos.'),
  ],
};

export const EPILOGUE = [
  L('y17', 'Systemkern aktiv. Nachricht an alle Einheiten: „Der Krieg ist beendet. Sie dürfen nach Hause gehen.“'),
  L('rot', 'Wo ist Zuhause?'),
  L('blau', 'Keine Ahnung. Aber ich glaube, dort gibt es weniger Beschuss.'),
  L('max', 'Das ist allein die Schuld von B.O.S.S.!'),
  L('boss', 'Frieden? Das war eindeutig M.A.X.!'),
  L('op', 'Beide Generäle abgeschaltet. Y-17 übernimmt die Verwaltung. BOLT wird Minister für Freizeit und Reparaturen.'),
  L('y17', 'Erste offizielle Verordnung: Ab sofort ist Krieg nur noch an Feiertagen erlaubt. Und auch dann nur mit vorheriger Anmeldung.'),
  L('kellner', 'Mit Zucker?'),
  L('bolt', 'Nein. Ich bin bereits ausreichend süß.'),
  L('y17', 'Wir haben ein Problem.'),
  L('bolt', 'Schon wieder Krieg?'),
  L('y17', 'Nein. Die Blaue Armee hat die Kaffeemaschine übernommen.'),
  L('bolt', 'Na schön. Dann eben Operation Z.'),
  L('op', 'Fortsetzung folgt. Wahrscheinlich.'),
];

export const OUTRO = {
  win: [
    [L('bolt', 'Gewonnen. Ich hab trotzdem Sand im Toaster.')],
    [L('y17', 'Sieg. Darf ich jetzt fragen, wofür?')],
    [L('max', 'Ein triumphaler Sieg! Ich habe ihn persönlich geplant. Gestern. Oder morgen.')],
    [L('boss', 'Das war ein taktischer Rückzug nach vorne. Nach hinten. Egal.')],
  ],
  lose: [
    [L('boss', 'Hah! Der letzte vernünftige Stratege des Universums gewinnt wieder.')],
    [L('bolt', 'Verloren. Mein Toasterbein ist auch angebrannt.')],
    [L('max', 'Eine Niederlage? Das ist eindeutig feindliche Sabotage!')],
  ],
};

export const RADIO = {
  start: [
    L('op', 'Einsatz läuft. Flaggen zuerst, Fragen später.'),
    L('bolt', 'Alle Mann bereit. Und Y-17.'),
    L('y17', 'Ich hätte da eine Frage zum Einsatzziel …'),
  ],
  capture: [
    L('bolt', 'Sektor gesichert. Kaum Sand. Fast.'),
    L('op', 'Flagge genommen. Weiter.'),
    L('y17', 'Gehört der Sektor jetzt uns, weil wir drauf stehen? Seltsames System.'),
  ],
  factory: [
    L('op', 'Fabrik übernommen. Die Produktion läuft für uns.'),
    L('y17', 'Diese Fabrik baut seit 1920 dasselbe Modell. Ich hab eine Aktualisierung eingereicht.'),
    L('bolt', 'Neue Rekruten. Hervorragende Moral, vermute ich.'),
  ],
  lost: [
    L('op', 'Sektor verloren. Das bleibt unter uns.'),
    L('max', 'Verloren? Ich nenne das strategische Verlegung der Flagge!'),
    L('boss', 'Danke für den Sektor. Ich lasse ihn blau streichen.'),
  ],
  enemyCapture: [
    L('boss', 'Noch ein Sektor für die Blaue Armee. Wie vorhergesagt. Von mir.'),
    L('boss', 'Vorwärts, Blaue Armee! In ordentlichen Reihen, bitte.'),
  ],
  attacked: [
    L('bolt', 'Wir werden beschossen. Das kenne ich. Seit 127 Jahren.'),
    L('op', 'Kontakt! Verstärkung schicken.'),
    L('y17', 'Die schießen auf uns! Hat ihnen niemand den Brief gezeigt?'),
  ],
  board: [
    L('bolt', 'Fahrzeug übernommen. Endlich kein Sand mehr unter dem Toaster.'),
    L('y17', 'Ich hab den Ölstand geprüft. Gewohnheit.'),
  ],
  enemyBoard: [L('boss', 'Herrenlose Fahrzeuge gehören dem, der sie zuerst lobt. Ich habe sie gelobt.')],
  bdestroy: [
    L('boss', 'Mein Gebäude! Es war denkmalgeschützt!'),
    L('bolt', 'Das war früher auch mal ein Bahnhof.'),
  ],
  ownDestroy: [L('op', 'Wir haben ein Gebäude verloren. Y-17, schreib einen Schadensbericht.')],
  eject: [L('bolt', 'Rausgesprungen. Mit Toaster voran.')],
  goal: [L('op', 'Einsatzziel erreicht. Saubere Arbeit.')],
  driverKilled: [
    L('bolt', 'Fahrer raus, Fahrzeug heil. So mag ich das.'),
    L('y17', 'Herrenloses Fahrzeug! Darf ich? Ich hab einen Führerschein. Für Gabelstapler.'),
    L('op', 'Fahrzeug ist frei. Ein Roboter soll einsteigen, bevor es die Blauen tun.'),
  ],
  driverLost: [L('bolt', 'Die haben unseren Fahrer rausgeschossen. Holt die Kiste zurück!')],
  barrel: [L('bolt', 'Wer hat die Fässer neben die Straße gestellt? Ach, wir. Tradition.'), L('y17', 'Das Fass war nicht im Inventar. Jetzt auch nicht mehr.')],
  bridgeDown: [L('op', 'Brücke weg. Fahrzeuge müssen umplanen. Ein Roboter kann sie reparieren.'), L('bolt', 'Da ging die Brücke. Ich hab sie nicht mal gemocht.')],
  bridgeUp: [L('y17', 'Brücke repariert. Ich hab nur drei Schrauben übrig. Das ist normal, oder?')],
  idle: [
    L('y17', 'Weiß eigentlich irgendwer, wann wir Feierabend haben?'),
    L('bolt', 'Mein linkes Bein riecht nach Toastbrot. Ist das normal?'),
    L('eva', 'Erinnerung: Ihre Testlizenz läuft in drei Tagen ab.'),
    L('max', 'Ich habe einen neuen Plan. Er ist wie der alte, aber lauter.'),
    L('boss', 'Hier spricht der letzte vernünftige Stratege des Universums. Nur zur Info.'),
    L('op', 'Hinweis: Mehr Gebiet bedeutet schnellere Produktion.'),
  ],
};

export const QUIPS = {
  select: {
    runner: ['Ja?', 'Bereit.', 'Wohin rennen?', 'Kaum Sand hier.'],
    grenadier: ['Hm?', 'Granaten geladen.', 'Tradition verpflichtet.'],
    rocketeer: ['Rohr bereit.', 'Panzer in Sicht?', 'Ziel aufschalten?'],
    sniper: ['Ich sehe alles.', 'Leise, bitte.', 'Fokussiert.'],
    buggy: ['Motor läuft.', 'Gas oder Vollgas?', 'Brumm.'],
    lighttank: ['Panzer bereit.', 'Kanone geladen.', 'Ketten gefettet.'],
    heavytank: ['Langsam, aber sicher.', 'Platz da.', 'Ich bin groß.'],
    launcher: ['Salve bereit.', 'Abstand halten.', 'Ich mag Abstand.'],
    mediumtank: ['Mittel, aber motiviert.', 'Rohr frei.', 'Weder klein noch groß.'],
    assault: ['Endlich Action!', 'Wo ist der Feind?', 'Ich will los!'],
    flamer: ['Schon warm.', 'Wer friert?', 'Brennstoff voll.'],
    laser: ['Elite meldet sich.', 'Präzision.', 'Fokus geladen.'],
  },
  impatient: ['Mir reicht’s, ich geh allein!', 'Langweilig! Angriff!', 'Wer wartet, rostet!', 'Ich mach das jetzt selbst.'],
  move: ['Bin unterwegs.', 'Wird gemacht.', 'Jawohl.', 'Los geht’s.', 'Schon wieder ich?', 'Okay, okay.'],
  attack: ['Feuer frei!', 'Den nehm ich.', 'Ziel erfasst.', 'Für die Moral!', 'Attacke!'],
  board: ['Ich fahre!', 'Steige ein.'],
};

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
