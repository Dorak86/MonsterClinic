# SEKTORFRONT

Echtzeit-Strategiespiel um Flaggen, Fabriken und jeden Meter Boden. Eigenständiges Spiel im
Stil der Territorial-RTS der 90er Jahre: Roboter erobern Sektoren über deren Flaggen, Werke
in eroberten Sektoren produzieren schneller, je mehr Gebiet man hält. Sieg durch Zerstören des
feindlichen Forts oder Erobern seiner Flagge.

Anforderungen und Umsetzungsstand: [PFLICHTENHEFT.md](PFLICHTENHEFT.md)

## Spielen

`dist/sektorfront.html` im Browser öffnen (Chrome, Edge oder Firefox mit WebGL2). Die Datei
enthält alles, läuft offline und braucht keinen Server.

## Inhalt

- 8 Kampagnenlevel in 4 Klimazonen (Steppe, Eis, Sumpf, Vulkan), Gefechtsmodus mit 3 Schwierigkeitsstufen
- 4 Roboter- und 4 Fahrzeugtypen, Fort, Roboter-/Fahrzeugwerk, Radarmast, Geschützturm
- herrenlose Fahrzeuge zum Besteigen, Reparatur an Werken, Nebel des Krieges, Minikarte, Gruppen
- 3D-Grafik mit Three.js: Echtzeitschatten, ACES-Tonemapping, Bloom, Partikel, dynamisches
  Explosionslicht, animiertes Wasser und Lava; alle Modelle und Texturen prozedural erzeugt
- Ton und Musik vollständig per WebAudio synthetisiert

## Entwickeln

```
npm install
npm run build      # erzeugt dist/sektorfront.html
npm test           # KI gegen KI auf allen Leveln (Simulation, ohne Grafik)
npm run test:browser   # Headless-Chromium: lädt jedes Level, Screenshots nach dist/shots
```

| Ordner | Inhalt |
| --- | --- |
| `src/sim/` | Simulation ohne Grafik: Karte, Wegfindung, Einheiten, Sektoren, KI, Leveldaten |
| `src/render/` | Three.js-Darstellung: Gelände, Modelle, Effekte, Nebel des Krieges |
| `src/ui/` | HUD, Minikarte, Eingabe, Portraits |
| `src/audio.js` | prozeduraler Ton |
| `tools/` | Build, Rauchtest, Browsertest |
