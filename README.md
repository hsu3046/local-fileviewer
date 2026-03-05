# 🎨 Gallery VR

## Summary-en

Browse your photos, videos, and files stored on your computer — right from any device on the same Wi-Fi. Open a browser on your phone, tablet, or **Meta Quest 3 VR headset**, and enjoy your personal gallery with smooth swipe navigation, one-tap fullscreen, and a favorites collection. No cloud. No uploads. Everything stays on your machine.

## Summary-ko

같은 Wi-Fi에 연결된 어떤 기기에서든, 컴퓨터에 저장된 사진·영상·파일을 바로 볼 수 있습니다. 스마트폰, 태블릿, 또는 **Meta Quest 3 VR 헤드셋**의 브라우저를 열면, 스와이프로 넘기고, 탭 한 번으로 전체화면으로 감상하고, 마음에 드는 파일을 즐겨찾기로 모아둘 수 있습니다. 클라우드 없이, 업로드 없이 — 모든 파일은 내 컴퓨터에 그대로 남습니다.

## Summary-ja

同じWi-Fiに接続された端末から、パソコンに保存された写真・動画・ファイルをそのまま閲覧できます。スマートフォン、タブレット、または**Meta Quest 3 VRヘッドセット**のブラウザを開くだけ。スワイプで切り替え、ワンタップでフルスクリーン表示、お気に入り登録もかんたん。クラウド不要、アップロード不要 — すべてのファイルはお使いのPCに保存されたままです。

---

## Features

- 🖼️ Image, video, and PDF preview with auto-generated thumbnails
- ⭐ Favorites with persistent server-side storage (synced across devices)
- 🎯 VR-optimized gestures (swipe, long-press, double-tap)
- 🌙 Dark / Light theme
- 🔒 Password protection
- 📡 mDNS (Bonjour) automatic discovery on local network

## Prerequisites

This app runs on your own computer. You need:

1. **Node.js** (v18 or later)  
   → Download from [https://nodejs.org](https://nodejs.org) and install (choose the LTS version)
2. **A terminal** — built-in on macOS (Terminal.app) and Windows (PowerShell)

> **Don't know what Node.js is?** It's a small program that lets your computer run this app. Just download, install, and you're done. You only need to do this once.

## Quick Start

### macOS (easiest)

1. Download this project → click the green **Code** button on GitHub → **Download ZIP**
2. Unzip the folder
3. Double-click **`start.command`** — the server starts automatically
4. Open `http://localhost:3005` in your browser

### Any platform (terminal)

```bash
# 1. Clone or download this project
git clone https://github.com/KnowAI/gallery-vr.git
cd gallery-vr

# 2. Install dependencies (first time only)
npm install

# 3. (Optional) Copy and edit environment config
cp .env.example .env.local

# 4. Start the server
npm start
```

### Accessing from other devices

Once running, open a browser on your phone/tablet/VR headset and enter the **IP address** shown in the terminal (e.g. `http://192.168.0.15:3005`).

> **Tip:** On macOS, other Apple devices can also use `http://gallery.local:3005`.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `GALLERY_ROOT` | `~/Pictures` | Root folder for the gallery |
| `GALLERY_PASSWORD` | `3319` | Access password |
| `PORT` | `3000` | Server port |
| `MDNS_NAME` | `gallery` | mDNS hostname (accessible as `http://<name>.local:<port>`) |

### First Run

On your first launch, the app will ask you to enter or drag-and-drop a folder path. This is saved to `config.json` and reused automatically on future launches.

### Changing the Gallery Folder

```bash
# Re-select the gallery folder
node server.js --reset
```

This ignores the saved path and prompts you again.

## How to Use

### Browsing

- **Tap a folder** to open it
- **Tap a photo or video** to view it in full screen
- Use the **⭐ button** in the header to show only your favorites

### Viewing (Lightbox)

| Action | How |
|--------|-----|
| **Next / Previous** | Swipe ← or → |
| **Close** | Swipe ↓ (downward) |
| **⭐ Add to favorites** | Swipe ↑ (upward) |
| **Zoom in** | Long-press (hold ~0.5s) |
| **Fullscreen** | Double-tap |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` `→` | Previous / Next |
| `Escape` | Close viewer |
| `F` | Toggle fullscreen |
| `Space` | Play / Pause video |

## Tech Stack

- **Backend:** Express.js, Sharp (thumbnails), Bonjour (mDNS)
- **Frontend:** Vanilla JS, CSS (no frameworks)
- **Storage:** JSON file-based favorites

## License

GNU General Public License v3.0 © KnowAI  
See [LICENSE](LICENSE) for details.
