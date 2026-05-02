# Aura ✦

> *Your system, luminous and clean.*

A fast, beautiful, cross-platform system cleaner built with **Rust + Tauri 2.0**.  
Works on **macOS**, **Windows**, and **Linux**.

---

## Features

| Feature | Description |
|---------|-------------|
| 🧹 **Smart Scan** | One-click scan across all categories |
| 🗑 **System Junk** | Caches, logs, temp files, language packs |
| 🪣 **Trash Bins** | Multi-volume trash management |
| 📁 **Large & Old Files** | Surface files you forgot about |
| 📑 **Duplicates** | SHA-256 content-hash duplicate detection |
| 📲 **App Uninstaller** | Full removal including leftover files |
| 🚀 **Startup Manager** | Control login items & launch agents |
| 🔒 **Privacy** | Browser history, cache, cookies |
| 💿 **Disk Space** | Visual disk usage treemap |
| 🔧 **Maintenance** | Flush DNS, rebuild indexes, run scripts |

---

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Rust (Tauri 2.0 commands)
- **State**: Zustand
- **Icons**: Lucide React
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Fonts**: Bricolage Grotesque + DM Sans + DM Mono

---

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- [Rust](https://rustup.rs/) stable
- Tauri CLI: `cargo install tauri-cli --version "^2.0"`

### Linux only

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

### Run development server

```bash
pnpm install
pnpm tauri dev
```

### Production build

```bash
pnpm tauri build
```

Artifacts are output to `src-tauri/target/release/bundle/`.

---

## Project Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full technical overview.  
See [DESIGN.md](DESIGN.md) for the design system.  
See [TODO.md](TODO.md) for the implementation roadmap.

---

## Safety

Aura never deletes files without:
1. Validating against a protected-path deny-list
2. Writing an undo log to `~/.aura/undo_log.json`
3. User confirmation via the Action Sheet

By default, items are **moved to Trash** (not permanently deleted).  
Permanent deletion can be enabled in Settings.

---

## License

MIT
