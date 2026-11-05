# Stilprobe: Briefing für Gemini (Phase 0, T0-07)

Ziel: beweisen, dass die KI-Grafik einen einheitlichen Stil hält (Lastenheft Kap. 16). Phase 1 beginnt erst nach deiner Freigabe der Stilprobe im Spiel.

## Was gebraucht wird

| Nr. | Bild | Hinweis |
| --- | --- | --- |
| 1 | Stilleitfaden: Farbpalette (16–24 Farben), Lichtrichtung, Beispiel-Silhouetten | zuerst, alle weiteren Bilder bauen darauf auf |
| 2 | Bodenkachel Untersuchungszimmer | eine Kachel, nahtlos kombinierbar |
| 3 | Wandstück gerade, Innenseite und Außenseite | je Seite ein Bild |
| 4 | Wandecke außen und innen | |
| 5 | Tür und Fenster, jeweils in der Wand | |
| 6 | Untersuchungsliege von 4 Seiten | vorn links, vorn rechts, hinten links, hinten rechts |
| 7 | Röntgengerät von 4 Seiten | wie 6 |
| 8 | Vampir-Patient: Referenzbogen (vorn, seitlich, hinten) | Grundlage für alle Vampirbilder |
| 9 | Vampir-Patient isometrisch von vorn rechts und hinten rechts | die anderen 2 Richtungen entstehen durch Spiegeln |

## Feste Stilbeschreibung (jedem Prompt voranstellen)

Englische Prompts liefern bei Gemini meist bessere Ergebnisse.

```
Hand-painted 2D game art for an isometric hospital management game set in a whimsical,
gothic version of hell. Style: Gothic Whimsy, Dark Storybook, Victorian architecture,
grotesque but charming fantasy. Dark but not depressing, with warm candlelight accents.
Painterly brush texture, clean readable silhouettes, soft outlines.
Strict dimetric isometric projection with 2:1 ratio (26.57 degree floor lines),
camera from above, no perspective distortion.
Light always comes from the top left, shadows fall to the bottom right.
Single object only, centered, on a plain flat #FF00FF magenta background, no floor, no scene, no text.
```

## Beispiel-Prompts

**Stilleitfaden (Nr. 1)**
```
[Stilbeschreibung] Create a style guide sheet: a color palette of 20 swatches
(deep plum, bruised purple, moss green, bone white, candle amber, rust red, soot black ...),
three small example silhouettes (a vampire, a ghost, a goblin), and an arrow showing light from the top left.
```

**Röntgengerät (Nr. 7)**
```
[Stilbeschreibung] A Victorian-era X-ray machine for monsters: brass frame, glowing green
glass tube, leather straps, small gargoyle ornament. Seen from the front-left isometric angle.
```
Dann dasselbe mit „front-right“, „back-left“, „back-right“. Immer das erste Bild als Referenz mitgeben („same object as in the reference image, now seen from …“).

**Vampir-Referenzbogen (Nr. 8)**
```
[Stilbeschreibung] Character reference sheet of a sickly vampire patient: tall, thin, pale grey skin,
tattered black cape with red lining, slippers, holding a hot water bottle. Front view, side view,
back view, standing in a neutral pose, same character in all three views.
```

## Nacharbeit

1. **Hintergrund entfernen**: Gemini erzeugt keine zuverlässige Transparenz. Deshalb Magenta-Hintergrund und danach freistellen (z. B. mit GIMP oder einem Freistell-Werkzeug).
2. **Auf Raster prüfen**: Bodenkanten müssen 2:1 verlaufen (zwei Pixel breit, ein Pixel hoch). Abweichungen nachkorrigieren oder neu erzeugen.
3. **Größe**: Eine Bodenkachel ist in Arbeitsauflösung 256 × 128 Pixel. Objekte und Figuren im passenden Maßstab skalieren.
4. **Für die Animation**: Kopf, Rumpf, Arme, Beine und Umhang des Vampirs als getrennte Ebenen in einer PSD/PSB-Datei ausschneiden. Das geht nicht zuverlässig per KI und braucht Handarbeit.
5. **Asset-Verzeichnis**: Jedes Bild mit Werkzeug, Datum und Prompt in `Docs/assets.md` eintragen (Steam-Offenlegung).

Schick mir die fertigen Bilder. Ich baue daraus die Stilprobe in Unity und prüfe Projektion, Licht und Zeichenreihenfolge.
