# Bericht Spielkreislauf: 30 Spieltage (K3)

Erzeugt mit `simcli run --days 30 --seed 1` am 05.11.2026. Alle Zahlen beruhen auf ersten Balancing-Annahmen aus `Content/balancing/clinic_loop.json`.

```
THE MONSTER CLINIC - Spielkreislauf, 30 Spieltage, Startwert 1

 Tag  Ankunft Geheilt Abbruch Tot Pink  Diagn. falsch Kompl.  Wartezeit  Einnahmen Ausgaben   Konto   Ruf Sauber
   1       13       8       0   0    0      12      2      5     55 min       1530      880    5650   61    98%
   2       13      13       0   4    0      14      1      9     57 min       2820      940    7530   68    99%
   3        7       6       0   2    0       7      0      4     25 min       1656      850    8336   76    99%
   4       14      10       0   3    0      17      3      9     57 min       2100      880    9556   77    96%
   5       17      11       0   1    4      21     10     12    108 min       2438     1120   10874   72    98%
   6        9       8       0   2    0      13      5      5     33 min       2426      910   12390   76    97%
   7       10       8       0   1    0      11      2      5     23 min       1926      970   13346   80    93%
   8        5       7       0   0    0       7      1      1      8 min       1862      850   14358   85    99%
   9       11       9       0   0    2      12      1      5     66 min       1706      910   15154   84    98%
  10       12       8       0   2    1      14      3      7     50 min       1880      850   16184   84    99%
  11        9       6       0   0    3      11      2      5     92 min       1256      940   16500   80    98%
  12       12      10       0   1    1      12      2      6     50 min       2096      970   17626   81    97%
  13       13      11       0   1    2      14      1      7     67 min       2546      940   19232   82    98%
  14       18       7       0   3    8      17      4     15    100 min       1946      910   20268   75    96%
  15       16      10       0   3    3      16      3     10     78 min       1816      940   21144   74    98%
  16       19       8       0   2    9      20      4     16    121 min       1946      910   22180   69    97%
  17        8       5       0   1    1       8      2      2     35 min        730      910   22000   74    99%
  18       16      13       0   2    1      18      4     11     69 min       3016      910   24106   75    98%
  19        9       9       0   0    1      10      1      5     24 min       1986      910   25182   81    99%
  20        9       6       0   0    0       8      0      1     14 min       1380      880   25682   86    97%
  21        9      10       0   1    0      10      0      3     13 min       2610      880   27412   89    98%
  22       10       4       0   3    4      10      3      8     94 min        480      880   27012   81    99%
  23        9       7       0   2    0       9      2      7     30 min       2208      940   28280   83    98%
  24       18      11       0   0    6      19      3     11    133 min       2652     1000   29932   76    98%
  25       10       6       0   2    3      12      3      6     76 min       1050     1000   29982   74    97%
  26       11       9       0   1    1      13      2      6     64 min       1546      850   30678   77    97%
  27       18       9       0   6    2      17      5     15     89 min       2312      910   32080   73    98%
  28        5       3       0   0    0       3      0      1      3 min        900      850   32130   81    99%
  29       18      11       0   2    7      20      6     14    108 min       2770     1000   33900   75    99%
  30        9       7       0   0    2      11      3      5     76 min       1756      910   34746   75    98%

Summe: 357 Patienten, 250 geheilt, 0 abgebrochen, 45 gestorben, 61 dauerhaft pink
Diagnosen: 386, davon falsch: 78 (20 %), misslungene Behandlungen: 138
Kontostand: 34746 (Start 5000), Ruf: 75 von 100
Noch in der Klinik: 1

Je Krankheit (angekommen / geheilt / anders gegangen):
  disease.balloon_bloating            99    54    45
  disease.blood_deficiency            45    45     0
  disease.goblin_depression          113    52    61
  disease.zombie_rot                 100    99     0

Pruefsumme des Endzustands: 8541571ac84a65d37e598c941dac0a42abb21e77214ccf60431ec18003ce717f
```
