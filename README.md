# Regnum: Chronicles of Crowns

A dynasty-driven medieval grand strategy game in the spirit of Crusader Kings — built with plain JavaScript and Canvas, no build step and no dependencies.

**The twist:** any ruler can be given a **Sovereign Mind**. That ruler is then run by a real large language model through [OpenRouter](https://openrouter.ai). It reads a briefing on its realm, keeps a diary, writes you letters, schemes, makes alliances and decides on war and peace for itself.

## Running

```bash
python3 serve.py
```

Then open http://localhost:8765. Any static file server works, but `serve.py` turns off caching so code edits always reload.

## Start dates

| Year | Bookmark | Featured rulers |
|---|---|---|
| 476 | The Fall of the West | Zeno, Odoacer, Theodoric, Julius Nepos, Gaiseric, Euric, Syagrius… |
| 769 | The Rise of Charlemagne | Charles & Carloman, Desiderius, Widukind, Offa, Abd al-Rahman I, al-Mansur… |
| 867 | The Great Heathen Army | Ivar the Boneless, Æthelred & Alfred, Rurik, Harald Fairhair, Álmos, Boris I… |
| 1066 | The Norman Conquest | Harold Godwinson, William, Harald Hardrada, Matilda of Canossa, Alp Arslan… |
| 1178 | The Age of Crusades | Henry II, Richard, Barbarossa, Baldwin IV, Saladin, Kilij Arslan II, Tamar… |
| 1241 | The Mongol Storm | Batu Khan (already in Hungary), Béla IV, Henry the Pious, Alexander Nevsky, Mindaugas… |
| 1337 | The Hundred Years' War | Edward III, Philip VI, Orhan, Stefan Dušan, Gediminas, Ivan Kalita… |
| 1453 | The Fall of Constantinople | Mehmed II (sieging the city), Constantine XI, Skanderbeg, Philip the Good… |
| ??? | The Shattered World | Alternate history: every duchy independent, cultures and faiths scrambled |

## Features

- **The map:** about 377 counties across Europe, North Africa and the Near East, generated from real coastlines with organic borders, hillshaded relief, sea lanes and seasonal winter snow.
- **Six map styles:** Royal Parchment, Illuminated Manuscript, Living Terrain, Stained Glass, Cartographer's Ink and Imperial Night (glowing borders and city lights).
- **Eight map modes:** realms, de jure, culture, faith, terrain, development, houses and diplomacy.
- **Characters:** procedural portraits that age, gray, wear crowns, turbans or mitres, and show wounds. Around 100 traits, 6 skills, stress and mental breaks, education, aging, illness and plague.
- **Dynasties:** marriage, births and inheritance under partition, primogeniture, elective, seniority or tanistry law. When you die, you play as your heir. House renown buys legacies, and there is a family tree view.
- **Realm:** feudal hierarchies of vassals, domain limits, crown authority, opinion with full breakdowns, factions and independence wars, tyranny and dread.
- **Warfare:**
  - Casus belli: claims, de jure conquest, holy wars, subjugation, independence and Great Holy Wars (crusades and jihads).
  - Levies, cultural men-at-arms with counters, knights and mercenaries.
  - Armies move on the map, including by sea, with battles, sieges, raiding and loot, and war score.
- **Intrigue:** schemes to befriend, sway, seduce or murder; hooks, secrets and spymaster tasks.
- **Council:** chancellor, marshal, steward, spymaster and chaplain, each with tasks such as fabricating claims, converting counties or developing land.
- **Royal Court:** grandeur, amenities, artifacts (including historical ones like the Holy Lance and Joyeuse), Hold Court petitions, and activities: feasts, hunts, tournaments with brackets, pilgrimages and weddings.
- **Lifestyles:** 5 lifestyles with perk trees that grant lifestyle traits.
- **Faith & culture:** heads of faith, holy sites, fervor, reforming pagan faiths, conversion, the Iberian Struggle, innovations across eras and culture hybridization.
- **Events:** a library of narrative events with illustrated, animated scenes and effect previews.
- **Chronicle:** an event log, an optional AI-written yearly chronicle, and a timelapse replay of the map's history.
- **Saves:** stored in IndexedDB, with export and import as JSON.
- **Epithets:** rulers earn names like "the Conqueror", "the Pious", "the Cruel" or "the Mad" from their deeds and personality.
- **Ambitions:** vow to pursue one personal goal at a time (expand the realm, forge a crown, master of war, a glittering court…) for rewards.
- **The Herald:** a scrolling ticker of world news at the top of the screen.
- **Battle reports:** an animated card after each of your battles, with casualties and a victory or defeat stamp.
- **Saga export:** bind every ruler of your line into an illuminated HTML book with portraits, epithets, deeds and chronicles (Chronicle window).
- **Intercepted letters:** with a spymaster on Find Secrets or Spy Network, read the letters Sovereign Minds send one another.
- **Procedural music:** a lute-and-drone soundtrack generated live, which turns darker with war drums when you are at war.

## Sovereign Minds (OpenRouter)

1. Get an API key at https://openrouter.ai/keys.
2. Open **Main Menu → Sovereign Minds** (or **Game Menu → Sovereign Minds**). Paste the key, pick a model from the live list, and click **Test connection**.
3. On the start screen, choose which rulers get a Mind: featured rulers, all kings and emperors, or your neighbors. In-game, you can also grant one from any ruler's character window (**Mind** tab).

Each Mind deliberates every N months (configurable). It receives its traits, finances, wars, neighbors with their available casus belli, recent letters and its own diary. It answers with JSON actions, which the engine checks and carries out: declare war, offer peace, propose alliances or marriages, write letters, gift gold, start schemes, build, recruit, raise armies, hold activities and change focus.

You can write to any ruler. When OpenRouter is configured, they reply in character and decide on any alliance, marriage, peace or vassalization proposal you attach. The **AI Chronicler** option writes an illuminated chronicle entry each year.

Your key is stored only in your browser's localStorage and is sent only to openrouter.ai.

## Controls

| Input | Action |
|---|---|
| Space | Pause / unpause |
| 1–5 | Game speed |
| Drag / WASD / arrows | Pan |
| Scroll | Zoom |
| Click | Select a county or army |
| Right-click | March the selected army / open the holder |
| R J C F T V H P | Map modes |
| Esc | Close / game menu |

## Code layout

```
index.html, css/main.css
js/main.js            boot, main loop, input routing
js/world.js           map rasterization, provinces, adjacency, pathfinding
js/data/              geography, cultures & faiths, traits/buildings/MAA, bookmarks
js/engine/            core model, setup, economy, life & succession, war, intrigue,
                      events & activities, decisions, classic AI, LLM minds, sim clock, saves
js/render/            map renderer (styles, labels, armies), procedural art
js/ui/                HUD & infrastructure, windows, dialogs, menus
```

Open the browser console and use `window.G` to inspect the live game state.
