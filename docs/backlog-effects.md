# Backlog: Offene/Zurueckgestellte Effekte

Effekte, die nicht in der aktuellen Implementierung enthalten sind und fuer spaetere Releases vorgemerkt werden.

## Mittlerer Aufwand (koennte spaeter kommen)

| Effekt | YGO-Referenz | Grund fuer Zurueckstellung | Voraussetzung |
|---|---|---|---|
| **Hand-Traps** | Kuriboh, Honest, Gorz | Neuer Trigger `fromHand` + UI-Prompt waehrend Gegner-Zug | UI-Erweiterung fuer gegnerische Zuege |
| **Turn-Counter** | Swords of Revealing Light (3 Turns skip battle), Nightmare Wheel | Persistenter Zaehler pro Karte ueber Zuege hinweg | `turnCounter` Feld in FieldSpellTrap + End-Phase-Dekrementierung |
| **onEndPhase / onStandbyPhase Trigger** | Toll of the Spirit, Nightmare Wheel, Gravekeeper's Servant | Neue Trigger-Typen in Engine-Phase-Flow | Engine-Phase-System erweitern |
| **Tribut-Beschwoerungs-Pflicht** | Monarch-Karten, Jinzo (Level 6+) | Opfere Monster fuer starke Beschwoenung | Summon-Flow erweitern, AI anpassen |
| **Equip-Steal** | Snatch Steal als Equipment | Equipment an gegnerisches Monster, uebernimmt Kontrolle | Kombination aus Equipment + stealMonster |
| **Ring of Destruction** | Ring of Destruction | Zerstoert Monster + Schaden an beide Spieler = ATK | Neue Action `destroyAndDamageBoth` |

## Hoher Aufwand (architektonische Aenderungen)

| Effekt | YGO-Referenz | Grund fuer Zurueckstellung | Aufwand |
|---|---|---|---|
| **Chain-System** | Generell (Spell Speed 1/2/3) | Widerspricht dem linearen FM-Design, massiver Refactor | Engine-Kern umschreiben |
| **Token-Generation** | Scapegoat, Sheep Token, Dandelion | Braucht virtuelle Karten ohne echte CardData-Eintraege | Neues Token-Subsystem |
| **Ritual-Beschwoenung** | Black Luster Soldier, Relinquished | Braucht Ritual-Spell + Level-Matching der Opfer | Neuer CardType + Summon-Flow |
| **Graveyard-Effekte** | Sinister Serpent, Treeborn Frog | Monster-Effekte die im Friedhof aktivieren | Neuer Trigger `inGraveyard` + Phase-Hooks |
| **Konter-Fallen (Counter Traps)** | Solemn Judgment, Magic Jammer, Seven Tools | Spell-Speed-3-Ketten, negieren andere Traps/Spells | Chain-System Voraussetzung |
| **Flip-Effekt mit Zielwahl** | Man-Eater Bug mit gezielter Zerstoerung | Aktuell kein Ziel-Prompt bei Flip-Effekten | UI-Prompt waehrend Flip-Resolution |

## Ausgeschlossen

| Effekt | Grund |
|---|---|
| **Alternative Win-Conditions** (Exodia, Final Countdown, Destiny Board) | Designentscheidung — nicht vorgesehen |
| **Banish-Zone** (Remove from Play) | Zu komplex, braucht neue Zone + UI |
| **Side Deck** | Aendert Match-Flow grundlegend |
