# Art Direction

Stand 05.11.2026. Verbindlich nach Lastenheft Kap. 16 und Entscheidung des Auftraggebers.

## Leitbild

Das Spiel darf nicht wie ein beliebiger Krankenhaus-Klon mit Monstern aussehen. Drei gleich starke Säulen:

1. **Viktorianische Monsterklinik**: Gaslicht, Schmiedeeisen, Messing, dunkles geschnitztes Holz, gesprungene Fliesen, Bleiglasfenster mit anatomischen Motiven, Apothekergläser.
2. **Düsteres Märchenbuch**: handgezogene Tuschelinien, Aquarell-Lasuren, leichte Papierstruktur, wie ein illustriertes Märchen des 19. Jahrhunderts.
3. **Groteske Fantasy-Komödie**: übertriebene Proportionen, kleine boshafte Details, schwarzer Humor, nie blutig.

Architektur, Möbel, Geräte, Patienten, Personal und Oberfläche stammen aus derselben Art Direction. Licht immer von oben links.

## Oberfläche

Keine moderne, flache Oberfläche. Obere Leiste wie ein Instrumentenbrett aus Messing und Pergament (Datum mit Mondsymbol, Sanduhr-Geschwindigkeitsknöpfe, Münze mit gehörntem Schädel, Ruf als Kerzenreihe). Unten eine Bauleiste mit Symbolen als kleine Tuschezeichnungen auf alten Etiketten. Rechts ein Infofenster wie eine Seite aus einem alten Krankenbuch. Warnungen als Gepäckanhänger an Fäden.

## Erstes Konzeptbild (Gemini, 05.11.2026)

Vom Auftraggeber als „sehr nah dran“ bewertet. Hinweise für die nächsten Bilder:

- Goblins sind **rot** (Goblin-Depression: rot wird pink). Im Konzeptbild sind zwei Goblins grün, das ist falsch.
- Der Grundriss im Konzeptbild ist zu klein und unlogisch; maßgeblich ist der Grundriss aus `Content/clinics`.
- Texte auf Gemini-Bildern sind unzuverlässig; im Spiel kommen sie aus den Sprachtabellen.

## Prompt

Der vollständige Prompt mit Folgeprompts steht in `Docs/stilprobe-briefing.md` (Stilprobe) und wurde für die Oberfläche am 05.11.2026 im Chat übergeben. Feste Stilbeschreibung und Ausschlüsse:

```
Victorian monster clinic, dark storybook, grotesque fantasy comedy. Hand-inked outlines, watercolor washes,
subtle paper grain. Deep plum, soot black, moss green, bone white, warm candle-amber light, small accents of
sickly green and blood red. Isometric 2:1, light from the top left, clear silhouettes.
AVOID: bright cheerful corporate hospital look, glossy 3D plastic, cartoon sitcom style, rounded bubbly UI,
pastel colors, modern sans-serif dashboard, any existing game's branding, photorealism, gore.
```

## Bodenkacheln: Regel fuer Abwechslung

Jeder Boden besteht aus Bloecken von 4 x 4 Spielkacheln. Kachel (x, y) nutzt Variante (x mod 4, y mod 4) aus einem Kachelsatz.
Welcher Satz (A, B, ...) fuer einen Block gilt, bestimmt eine feste Formel aus der Blockposition:
`((bx * 73856093) xor (by * 19349663)) mod Anzahl Saetze` mit bx = x div 4, by = y div 4.
Weitere Saetze entstehen durch Drehung um 180 Grad (Schachbrett bleibt erhalten; Spiegeln wuerde es verschieben) und zusaetzliche Flecken.
