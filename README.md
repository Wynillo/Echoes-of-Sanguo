# @wynillo/tcg-format

TCG Format library for **Echoes of Sanguo** — load, validate, and pack `.tcg` archives.

This library defines the portable card data format used by the [Echoes of Sanguo](https://github.com/Wynillo/Echoes-of-Sanguo-TCG) game engine and card creator. It handles archive loading, structural validation, and packing without implementing game rules or rendering.

## Installation

This package is published to [GitHub Packages](https://docs.github.com/en/packages). Configure your `.npmrc` to use the GitHub registry for the `@wynillo` scope:

```
@wynillo:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @wynillo/tcg-format
```

**Requirements:** Node.js >= 18

## Quick Start

### Load a `.tcg` archive

```ts
import { loadTcgFile } from '@wynillo/tcg-format';

// From a URL
const result = await loadTcgFile('https://example.com/game.tcg');

// From a buffer
const buffer = fs.readFileSync('game.tcg');
const result = await loadTcgFile(buffer);

console.log(result.parsedCards);   // Cards merged with localized names/descriptions
console.log(result.rawImages);     // Map<cardId, ArrayBuffer>
console.log(result.meta);          // Fusion recipes, opponents, starter decks
console.log(result.campaignData);  // Story campaign structure
```

### Validate a `.tcg` source directory

```ts
import { validateTcgCards, validateTcgDefinitions } from '@wynillo/tcg-format';

const cardResult = validateTcgCards(cardsJson);
const defResult = validateTcgDefinitions(definitionsJson);

if (!cardResult.valid) {
  console.error(cardResult.errors);
}
```

### Pack a directory into a `.tcg` archive

```ts
import { packTcgArchiveToBuffer } from '@wynillo/tcg-format';

const buffer = await packTcgArchiveToBuffer('./my-cards');
fs.writeFileSync('my-cards.tcg', buffer);
```

## CLI Usage

The package includes a `tcg-format` CLI tool:

```bash
# Validate a .tcg source directory
tcg-format validate ./my-cards

# Pack a directory into a .tcg archive
tcg-format pack ./my-cards -o my-cards.tcg

# Inspect a .tcg archive
tcg-format inspect my-cards.tcg
tcg-format inspect my-cards.tcg --lang de
```

## Archive Structure

A `.tcg` file is a ZIP archive with the following structure:

| File | Required | Description |
|------|----------|-------------|
| `cards.json` | Yes | Array of card data objects |
| `cards_description.json` | Yes | Localized card names and descriptions |
| `img/` | Yes (folder) | Card artwork PNGs (named by card ID, e.g. `1.png`) |
| `manifest.json` | No | Format version, author, feature flags |
| `meta.json` | No | Fusion recipes, opponent configs, starter decks |
| `opponents/*.json` | No | Opponent deck configurations |
| `opponents_description.json` | No | Localized opponent names/titles/flavor |
| `campaign.json` | No | Story campaign chapters, nodes, and dialogue |
| `shop.json` | No | Booster pack shop definitions with drop rates |
| `fusion_formulas.json` | No | Fusion recipe definitions |
| `rules.json` | No | Game rules (opaque, engine-specific) |
| `locales/` | No | Locale override files for multi-language support |
| `races.json`, `attributes.json`, `card_types.json`, `rarities.json` | No | Metadata lookup tables |

## API Reference

### Loader

- **`loadTcgFile(source, options?)`** — Load a `.tcg` archive from a URL string or `ArrayBuffer`. Returns a `TcgLoadResult` containing parsed cards, images, metadata, campaign data, and more.

### Validators

- **`validateTcgCards(data)`** — Validate an array of card objects
- **`validateTcgDefinitions(data)`** — Validate card definition objects
- **`validateTcgOpponentDescriptions(data)`** — Validate opponent description objects
- **`validateTcgArchive(zip)`** — Validate a full archive structure (orchestrates all validators)
- **`validateShopJson(data)`** — Validate shop/pack configuration
- **`validateCampaignJson(data)`** — Validate campaign structure
- **`validateFusionFormulasJson(data)`** — Validate fusion recipe definitions
- **`validateOpponentDeck(data)`** — Validate an opponent deck configuration

Each validator returns a `ValidationResult` with `valid`, `errors`, and `warnings` fields.

### Packer (Node.js only)

- **`packTcgArchive(dir, outputPath)`** — Pack a directory into a `.tcg` file on disk
- **`packTcgArchiveToBuffer(dir)`** — Pack a directory into a `Buffer`

### Error Types

- **`TcgNetworkError`** — Thrown when fetching a remote archive fails
- **`TcgFormatError`** — Thrown when archive structure or content is invalid

### Types

All TypeScript interfaces and constants are exported from the package entry point. Key types include:

- `TcgCard`, `TcgParsedCard`, `TcgCardDefinition` — Card data
- `TcgManifest`, `TcgMeta`, `TcgLoadResult` — Archive metadata and load results
- `TcgOpponentDeck`, `TcgOpponentDescription` — Opponent system
- `TcgShopJson`, `TcgCampaignJson`, `TcgFusionFormula` — Game features
- `CampaignData`, `CampaignChapter`, `CampaignNode` — Campaign structure
- `TCG_TYPE_*`, `TCG_ATTR_*`, `TCG_RACE_*`, `TCG_RARITY_*` — Integer constants

## Card Types

| Value | Type | Key Fields |
|-------|------|------------|
| 1 | Monster | `level`, `atk`, `def`, `attribute`, `race` |
| 2 | Fusion | `level`, `atk`, `def`, `attribute`, `race` |
| 3 | Spell | `spellType`, `effect` |
| 4 | Trap | `trapTrigger`, `target` |
| 5 | Equipment | `atkBonus`, `defBonus`, `equipReqRace`, `equipReqAttr` |

## Development

```bash
npm ci                 # Install dependencies
npm run build          # Compile TypeScript to dist/
npm test               # Run tests
npm run test:watch     # Run tests in watch mode
```

### Project Structure

```
src/
├── index.ts              # Public API exports
├── types.ts              # Type definitions and constants
├── tcg-loader.ts         # Archive loader
├── tcg-packer.ts         # Archive packer (Node.js only)
├── tcg-validator.ts      # Archive structure validator
├── card-validator.ts     # Card schema validator
├── def-validator.ts      # Definition schema validator
├── opp-desc-validator.ts # Opponent description validator
└── cli.ts                # CLI entry point

tests/
├── *.test.ts                  # Unit tests
└── fixtures/base.tcg-src/     # Test fixture data
```

### CI/CD

- **CI** — builds and tests on Node.js 18, 20, and 22 for every push and pull request
- **Publish** — automatically publishes to GitHub Packages when a version tag is pushed

## License

[MIT](LICENSE)
