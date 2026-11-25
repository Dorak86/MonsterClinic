# SEKTORFRONT – Pflichtenheft

Version 1.0 · Stand 25.11.2026

## 1. Zielbestimmung

SEKTORFRONT ist ein Echtzeit-Strategiespiel im Stil der Territorial-RTS der 90er Jahre
(Genre-Vorbild: *Z*, The Bitmap Brothers, 1996). Übernommen wird **die Spielidee des Genres**,
nicht das Werk selbst: Name, Figuren, Grafik, Musik, Texte und Level sind vollständig neu.

Kernidee: Zwei Roboterarmeen kämpfen um eine in Sektoren aufgeteilte Karte. Wer die Flagge
eines Sektors berührt, besitzt ihn samt aller Gebäude darin. Je mehr Sektoren eine Seite
hält, desto schneller produzieren ihre Fabriken. Gewonnen hat, wer das feindliche Fort
zerstört oder dem Gegner alle Einheiten und Fabriken nimmt.

### 1.1 Musskriterien

| Nr. | Kriterium |
| --- | --- |
| M1 | Spielbar im Browser ohne Installation, als **eine** HTML-Datei (offline, Doppelklick genügt). |
| M2 | Moderne 3D-Grafik: Echtzeitschatten, Tonemapping, Bloom/Leuchteffekte, Partikel (Rauch, Feuer, Funken, Trümmer), animiertes Wasser, Dynamik-Licht bei Explosionen. |
| M3 | Sektorsystem mit Flaggen, Gebietsfärbung, Übernahme von Gebäuden mit dem Sektor. |
| M4 | Fabriken mit Produktionswahl; Bauzeit sinkt mit Gebietsanteil. |
| M5 | Mindestens 4 Roboter- und 4 Fahrzeugtypen plus Geschütztürme mit Stärken/Schwächen (Panzerungsklassen). |
| M6 | Roboter können herrenlose (graue) Fahrzeuge besteigen und übernehmen. Geschütztürme gehören dem Besitzer ihres Sektors. |
| M7 | Computergegner mit 3 Schwierigkeitsstufen. |
| M8 | Kampagne mit mindestens 8 eigenen Leveln in 4 Klimazonen, Freischaltung wird gespeichert. |
| M9 | Gefechtsmodus: jede freigeschaltete Karte frei wählbar mit Schwierigkeit. |
| M10 | Nebel des Krieges, Minikarte, Auswahlrahmen, Gruppen (Strg+1–9). |
| M11 | Ton: prozedurale Effekte und Hintergrundmusik (WebAudio, keine fremden Dateien). |
| M12 | Bedienung vollständig mit Maus + Tastatur, Oberfläche auf Deutsch. |

### 1.2 Wunschkriterien

- Pause, Spielgeschwindigkeit (1×/2×), Grafikqualität (niedrig/hoch).
- Reparatur von Einheiten in eigenen Fabriken.
- Brücken, die zerstört werden können.

### 1.3 Abgrenzungskriterien

- Kein Mehrspieler über Netzwerk.
- Kein Karteneditor in Version 1.0.
- Keine Videosequenzen; Briefings als Text mit Kommandanten-Figur, die neu entworfen ist.

## 2. Produkteinsatz

Einzelspieler am Desktop-Rechner (Chrome, Edge, Firefox aktuell; WebGL2). Mindestauflösung
1280×720. Zielwert 60 Bilder/s bei 150 Einheiten auf Mittelklasse-Hardware.

## 3. Produktfunktionen

### 3.1 Karte und Sektoren

- Kachelraster (Standard 64×48 Felder, Feldgröße 2 m). Geländearten: Boden, Straße,
  Fels (unpassierbar), Wasser (unpassierbar, Brücken passierbar), Wald (passierbar für Roboter,
  langsam; unpassierbar für Fahrzeuge).
- Höhenrelief rein optisch, Gameplay auf Ebene.
- Jeder Sektor ist ein zusammenhängendes Gebiet mit genau einer Flagge. Grenzen werden
  als leuchtende Linien in Besitzerfarbe dargestellt, der Boden leicht eingefärbt.
- Eroberung: Ein Roboter (kein Fahrzeug) steht auf der Flagge → nach der Eroberungszeit
  wechselt der Sektor den Besitzer (1 s normal, 2,5 s mit Werk, 12 s Fortflagge; Fortschritt
  als Ring um die Flagge). Stehen Roboter beider Seiten dort, ruht die Eroberung.

### 3.2 Gebäude

| Gebäude | Funktion |
| --- | --- |
| Fort | Hauptquartier, viel Struktur. Zerstört = Niederlage. |
| Roboterwerk | Produziert Roboter. |
| Fahrzeugwerk | Produziert Fahrzeuge (mit Roboterfahrer). |
| Radarmast | Deckt großen Bereich im Nebel auf. |
| Geschützturm | Feste Verteidigung, gehört dem Sektorbesitzer, bevorzugt Roboter auf der eigenen Flagge. |

Gebäude gehören dem Besitzer ihres Sektors. Werke können zerstört werden (dann Ruine,
keine Produktion mehr).

### 3.3 Produktion

- Werk anklicken → Produktionsleiste mit allen Einheiten des Werks, Fortschrittsbalken.
- Endlosproduktion der gewählten Einheit (Genre-typisch), Sammelpunkt per Rechtsklick.
- Bauzeit = Grundzeit × Faktor(Gebietsanteil); Faktor 1,6 bei 10 % bis 0,55 bei 100 %.
- Einheitenlimit je Seite: 60.

### 3.4 Einheiten

| Typ | Klasse | Waffe | Stärke |
| --- | --- | --- | --- |
| Läufer | Roboter | Schnellfeuer-Karabiner | billig, schnell, Eroberer |
| Grenadier | Roboter | Granatwerfer (Fläche) | gegen Gruppen |
| Panzerjäger | Roboter | Raketen | gegen Fahrzeuge/Gebäude |
| Scharfschütze | Roboter | Langgewehr, hohe Reichweite | gegen Roboter |
| Flitzer | Fahrzeug | MG | sehr schnell, Aufklärung |
| Leichtpanzer | Fahrzeug | Kanone | Allround |
| Schwerpanzer | Fahrzeug | Doppelkanone | robust, langsam |
| Raketenwerfer | Fahrzeug | Salvenraketen, große Reichweite | Belagerung |

Schadensmatrix nach Waffenart × Panzerungsklasse (leicht/mittel/schwer/Gebäude).

Ein zerstörtes Fahrzeug kann seinen Fahrer freigeben (30 %). Herrenlose Fahrzeuge
(grau) stehen auf manchen Karten und werden durch Rechtsklick eines Roboters bestiegen.

### 3.5 Steuerung

| Eingabe | Wirkung |
| --- | --- |
| Linksklick / Ziehen | Auswählen / Rahmenauswahl; Doppelklick: alle gleichen Typs im Bild |
| Rechtsklick | Bewegen, Angreifen, Fahrzeug besteigen, Sammelpunkt setzen (auch auf der Minikarte) |
| F + Rechtsklick | Angriffsmarsch |
| WASD / Pfeile / Bildschirmrand | Kamera bewegen |
| Mausrad | Zoom; Q/E drehen |
| Strg+1–9, 1–9 | Gruppe speichern/abrufen (zweimal: hinspringen) |
| X | Halt; H Fort zentrieren, Leertaste letztes Ereignis, P/Esc Pause, +/− Tempo |

### 3.6 Computergegner

Zustandsbasierte KI, alle 1–3 s Entscheidung:
1. Produktion: Mischung nach Bedarf (Konterwahl gegen gesichtete Spielereinheiten).
2. Eroberung: Trupps gehen zu nächsten neutralen/feindlichen Flaggen, gewichtet nach Werken.
3. Verteidigung: Bedrohte eigene Sektoren mit Werken werden verstärkt.
4. Großangriff auf das Fort, sobald Übermacht.

Schwierigkeit beeinflusst Reaktionszeit, Bautempo (×0,8/1,0/1,2) und Zielwahl.

### 3.7 Level

| Nr. | Name | Klima | Besonderheit |
| --- | --- | --- | --- |
| 1 | Erstkontakt | Steppe | Tutorial-Hinweise, kleiner Gegner |
| 2 | Kupfertal | Steppe | Fluss mit zwei Brücken |
| 3 | Frostgrat | Eis | herrenlose Fahrzeuge |
| 4 | Gletscherpass | Eis | enger Pass, Geschütztürme |
| 5 | Moorkessel | Sumpf | viel Wald, Infanteriekarte |
| 6 | Nebelsee | Sumpf | Insel mit Radarmast |
| 7 | Schlackefeld | Vulkan | Lavaflüsse, schwere Fahrzeuge |
| 8 | Glutkern | Vulkan | großer Endkampf, Gegner startet stark |

### 3.8 Oberfläche

Hauptmenü (Kampagne, Gefecht, Optionen, Steuerung), Briefing, Spiel-HUD (Gebietsbalken
beider Seiten, Einheitenzahl, Spielzeit), Minikarte mit Klick-Navigation, Auswahlpanel,
Produktionspanel, Meldungsleiste („Sektor verloren“, „Fort wird angegriffen“), Pause-,
Sieg- und Niederlagenbildschirm mit Statistik.

## 4. Produktdaten

Fortschritt (freigeschaltete Level, Bestzeiten) und Optionen in `localStorage`.

## 5. Leistungsanforderungen

- Ladezeit < 3 s; keine externen Dateien zur Laufzeit.
- Simulation mit fester Schrittweite 20 Hz, Darstellung interpoliert.
- Wegfindung A* auf dem Raster mit Flussfeld-Caching für Gruppen, Ausweichen zwischen Einheiten.

## 6. Qualitätsanforderungen

- Deterministische Kartengenerierung aus Leveldaten (gleiche Karte bei jedem Start).
- Automatischer Rauchtest: Headless-Browser startet jedes Level, lässt KI gegen KI
  laufen und prüft auf Fehler und ein Spielende.

## 7. Technik

- Three.js (WebGL2), JavaScript-Module, gebündelt mit esbuild zu `dist/sektorfront.html`.
- Alle Modelle prozedural aus Grundkörpern, Texturen prozedural auf Canvas erzeugt.
- Ton per WebAudio-Synthese.

## 8. Umsetzungsstand (v1.0)

| Kriterium | Stand |
| --- | --- |
| M1–M12 | erfüllt |
| Pause, Tempo 1×/2×, Grafikqualität | erfüllt |
| Reparatur an eigenen Werken | erfüllt (stehende Einheiten, 4 % Struktur/s) |
| Zerstörbare Brücken | nicht umgesetzt (Wunschkriterium, zurückgestellt) |

Balancing: Jedes Level wurde mit KI gegen KI auf „Normal“ je viermal durchgespielt; die
Startaufstellungen sind so gewählt, dass die Spielerseite mit gleicher KI mindestens ein
Viertel der Partien gewinnt (Level 1, 2, 5, 7 deutlich öfter). Ein menschlicher Spieler hat
durch gezielte Steuerung zusätzlich einen Vorteil; späte Level bleiben bewusst fordernd.

## 9. Abnahme

Abgenommen ist das Produkt, wenn alle Musskriterien erfüllt sind, der Rauchtest für alle
Level fehlerfrei läuft und Level 1 von Hand gewonnen werden kann.
