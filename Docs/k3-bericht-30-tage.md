# Bericht Spielkreislauf: 30 Spieltage (K3)

Erzeugt mit `simcli run --days 30 --seed 1` am 05.11.2026. Waehrung: Infernalien (A-15). Alle Zahlen beruhen auf ersten Balancing-Annahmen aus `Content/balancing/clinic_loop.json`. Mit den Startwerten 1 bis 5 endet der Monat zwischen -4.710 und +9.055 Infernalien (Start 5.000): knapp, abhaengig vom Verlauf.

```
THE MONSTER CLINIC - Spielkreislauf, 30 Spieltage, Startwert 1

 Tag  Ankunft Geheilt Abbruch Tot Pink  Diagn. falsch Kompl.  Wartezeit  Einnahmen Ausgaben   Konto   Ruf Sauber
   1       13       8       0   0    0      12      2      5     55 min       1989     2309    4680   61    98%
   2       13      13       0   4    0      14      1      9     57 min       3665     2369    5976   68    99%
   3        7       6       0   2    0       7      0      4     25 min       2152     2279    5849   76    99%
   4       14      10       0   3    0      17      3      9     57 min       2730     2309    6270   77    96%
   5       17      11       0   1    4      21     10     12    108 min       3167     2549    6888   72    98%
   6        9       8       0   2    0      13      5      5     33 min       3153     2339    7702   76    97%
   7       10       8       0   1    0      11      2      5     23 min       2503     2399    7806   80    93%
   8        5       7       0   0    0       7      1      1      8 min       2420     2279    7947   85    99%
   9       11       9       0   0    2      12      1      5     66 min       2217     2339    7825   84    98%
  10       12       8       0   2    1      14      3      7     50 min       2444     2279    7990   84    99%
  11        9       6       0   0    3      11      2      5     92 min       1632     2369    7253   80    98%
  12       12      10       0   1    1      12      2      6     50 min       2724     2399    7578   81    97%
  13       13      11       0   1    2      14      1      7     67 min       3309     2369    8518   82    98%
  14       18       7       0   3    8      17      4     15    100 min       2529     2339    8708   75    96%
  15       16      10       0   3    3      16      3     10     78 min       2360     2369    8699   74    98%
  16       19       8       0   2    9      20      4     16    121 min       2528     2339    8888   69    97%
  17        8       5       0   1    1       8      2      2     35 min        949     2339    7498   74    99%
  18       16      13       0   2    1      18      4     11     69 min       3917     2339    9076   75    98%
  19        9       9       0   0    1      10      1      5     24 min       2581     2339    9318   81    99%
  20        9       6       0   0    0       8      0      1     14 min       1794     2309    8803   86    97%
  21        9      10       0   1    0      10      0      3     13 min       3393     2309    9887   89    98%
  22       10       4       0   3    4      10      3      8     94 min        624     2309    8202   81    99%
  23        9       7       0   2    0       9      2      7     30 min       2868     2369    8701   83    98%
  24       18      11       0   0    6      19      3     11    133 min       3447     2429    9719   76    98%
  25       10       6       0   2    3      12      3      6     76 min       1365     2429    8655   74    97%
  26       11       9       0   1    1      13      2      6     64 min       2009     2279    8385   77    97%
  27       18       9       0   6    2      17      5     15     89 min       3004     2339    9050   73    98%
  28        5       3       0   0    0       3      0      1      3 min       1170     2279    7941   81    99%
  29       18      11       0   2    7      20      6     14    108 min       3600     2429    9112   75    99%
  30        9       7       0   0    2      11      3      5     76 min       2282     2339    9055   75    98%

Summe: 357 Patienten, 250 geheilt, 0 abgebrochen, 45 gestorben, 61 dauerhaft pink
Diagnosen: 386, davon falsch: 78 (20 %), misslungene Behandlungen: 138
Kontostand: 9055 Infernalien (Start 5000), Ruf: 75 von 100
  expense.energy             -12600 Infernalien
  expense.insurance           -6000 Infernalien
  expense.material            -2100 Infernalien
  expense.rent               -11520 Infernalien
  expense.salary             -38250 Infernalien
  income.patient_bill         74525 Infernalien
Noch in der Klinik: 1

Je Krankheit (angekommen / geheilt / anders gegangen):
  disease.balloon_bloating            99    54    45
  disease.blood_deficiency            45    45     0
  disease.goblin_depression          113    52    61
  disease.zombie_rot                 100    99     0

Pruefsumme des Endzustands: 26056b939cbb4801c8ff9b7bfd0c3207a5781b101faef0af91de0084087624be
```
