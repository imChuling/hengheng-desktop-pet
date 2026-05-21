# Architecture

This app is a local-first Electron desktop pet. It has two browser windows, one preload bridge, and a small main-process backend that reads packaged assets and writes imported pets to Electron `userData`.

## Process Map

```mermaid
flowchart LR
  subgraph Main["Electron main process"]
    MainJs["src/main.js\napp lifecycle and service wiring"]
    Controller["app-controller.js\nstate, handlers, IPC registration"]
    WindowService["window-service.js\npet and manager windows"]
    CharacterService["character-service.js\ncharacter read/import/delete"]
    SettingsStore["settings-store.js\nsettings.json"]
    Importer["codex-pet-importer.js\nwrite imported frames"]
    Security["security.js\nCSP, navigation, permissions"]
  end

  subgraph Windows["Renderer windows"]
    Pet["src/renderer\ntransparent pet window"]
    Manager["src/manager\nlibrary, import, settings"]
  end

  Preload["src/preload.js\ncontextBridge desktopPet API"]
  BuiltIn["assets/characters\npackaged pets"]
  UserData["app.getPath('userData')\nsettings + imported pets"]

  Pet --> Preload
  Manager --> Preload
  Preload --> Controller
  MainJs --> Controller
  Controller --> WindowService
  Controller --> CharacterService
  Controller --> SettingsStore
  CharacterService --> BuiltIn
  CharacterService --> UserData
  Importer --> UserData
  Security --> MainJs
  MainJs --> SecurityConfig["configureSessionSecurity"]
```

## Data Flow

```mermaid
sequenceDiagram
  participant Manager as Manager window
  participant Preload as Preload API
  participant Main as Main process
  participant Store as userData
  participant Pet as Pet window

  Manager->>Preload: desktopPet.selectCharacter(id)
  Preload->>Main: ipcRenderer.invoke("pet:select-character")
  Main->>Store: persist selectedCharacterId
  Main->>Pet: webContents.send("pet:set-character")
  Main-->>Manager: selectedCharacterId
```

## Asset Flow

```mermaid
flowchart TD
  BuiltIn["Built-in character package\nassets/characters/<id>"] --> CharacterStore
  Spritesheet["Codex spritesheet.webp"] --> ManagerImport["Manager import UI"]
  ManagerImport --> Frames["Client-side frame extraction"]
  Frames --> Importer["saveCodexPetFrames"]
  Importer --> UserCharacters["userData/characters/<id>"]
  CharacterStore["character-store.js"] --> Config["Runtime config"]
  UserCharacters --> CharacterStore
  Config --> Renderer["Pet state machine"]
```

## Security Boundary

- Renderer windows run with `nodeIntegration: false` and `contextIsolation: true`.
- `src/preload.js` exposes a narrow `window.desktopPet` API.
- `src/main/app-controller.js` wraps all IPC handlers with trusted sender validation: the call must come from a known app window and an allowed local page URL.
- `src/main/security.js` installs session-level CSP, denies permission prompts, blocks navigation, and prevents new windows.
- Manager rich text localization is rendered through a whitelist that only allows `<code>` tags.

## Persistence

User data lives under Electron `app.getPath("userData")`:

```text
userData/
  settings.json
  characters/
    <imported-pet-id>/
      icon.png
      manifest.json
      frames/
```

Packaged builds include `src/**/*`, selected fonts, `assets/characters/**/*`, and app/tray icons. Temporary helper files and source-only assets are excluded by `package.json` build rules and checked by `npm run check:assets`.
