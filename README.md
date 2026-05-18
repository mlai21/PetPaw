# PetPaw

Private advisor and digital avatar MVP.

## Project Structure

- `apps/mobile`: Flutter mobile app
- `services/api`: Node/Express API service
- `docs/release`: release checklists

## Local Development

### Mobile

```bash
cd apps/mobile
flutter pub get
flutter test
```

### API

```bash
cd services/api
pnpm install
pnpm test
```

## Cleanup / Ignore Policy

- Debug artifacts are centrally ignored in root `.gitignore`, including:
  - `.cursor/debug-*.log`
  - `**/debug-*.{log,tmp,txt,json,sh}` (declared as separate rules in `.gitignore`)
  - `*.debug.log` and package-manager debug logs (`npm/yarn/pnpm`)
  - temporary patch residue (`*.orig`, `*.rej`, `*.stackdump`)
- If leftover debug files exist locally, you can clean the common ones with:

```bash
rm -f .cursor/debug-*.log ./*debug*.log ./*.orig ./*.rej
```
