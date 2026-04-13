# Chess Analysis Workstation

Local-first desktop chess analysis software for macOS Apple Silicon, with:

- Stockfish and Lc0 engine management
- MultiPV analysis
- Local Syzygy tablebase support
- FEN/PGN editing
- Board import from photos or camera capture

## Workspace

- `apps/desktop`: Electron + React + TypeScript desktop application
- `services/vision`: Python worker for board-photo recognition and Syzygy probing
- `assets/engines`: ignored runtime downloads for engines and neural nets

## Quick Start

1. Install desktop dependencies:
   - `npm install`
2. Bootstrap the Python service:
   - `npm run bootstrap:vision`
3. Start the app:
   - `npm run dev`

## Verification

- `npm run typecheck`
- `npm run test`
- `npm run test:vision`

## Notes

- Managed engine installers resolve current stable downloads at install time.
- Downloaded engines, Lc0 networks, and Syzygy data are stored outside git-tracked source files.
- The photo import flow always requires a review step before analysis begins.
