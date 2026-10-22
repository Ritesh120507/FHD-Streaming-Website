# NovaStream — 4K & 1080p 60fps Ultra-Low-Latency WebRTC Streaming

A peer-to-peer (P2P) web application that enables you to stream **anything** from your device (full monitors, game windows, desktop applications, or browser tabs) directly to another person in **native 4K (3840x2160) or 1080p @ 60 FPS** with **system audio** and **near-zero latency (< 30ms)**.

Secured with **Google Sign-In (Firebase Authentication)** and powered by **Cloud Firestore** for real-time signaling.

---

## ⚡ Key Highlights

- **Ultra-Low Latency (< 30ms)**: Uses direct WebRTC UDP peer-to-peer streaming instead of RTMP/HLS (which adds 5–15 seconds of buffering delay).
- **Native 4K & 1080p @ 60 FPS**: Enforces locked 60 frames per second display capture and disables browser downscaling with `resizeMode: "none"` and `maintain-framerate` degradation preference.
- **Two-Way Voice Chat**: Viewers can speak directly to the streamer in real-time, with instant 1-click microphone mute/unmute.
- **End-to-End Encrypted (E2EE) Live Chat**: Messages are encrypted directly on devices with **256-bit AES-GCM** and unique 96-bit IVs using the Web Crypto API. Zero plaintext is stored in Firestore.
- **Hardware-Accelerated Codecs (VP9 / AV1 / H.264 High Profile)**: Prioritizes modern GPU video encoders (Nvidia NVENC, AMD AMF, Intel QuickSync, Apple Silicon) for butter-smooth 4K60 compression.
- **Ultra-High Bitrate Pipe (Up to 40 Mbps)**: Custom SDP munging removes browser WebRTC bandwidth caps and kicks off instant high-bandwidth ramp-up (`x-google-start-bitrate`).
- **Hi-Fi Stereo Sound (Opus 510 kbps @ 48 kHz)**: Crystal-clear game/system audio capture with optional microphone commentary mixing.
- **Firebase Google Authentication**: Streamers and viewers sign in securely using their Google accounts.
- **Real-Time Performance HUD**: Live on-screen telemetry showing rendered FPS, resolution, bitrate throughput, and round-trip ping.
- **Zero Complex Toolchains**: Built with standard modern ES Modules. Runs instantly in any Chromium browser with no `npm install` needed.
- **Secure GitHub Hosting**: Configured for GitHub Pages deployment using GitHub Actions and Repository Secrets — your `.env` credentials are never exposed in Git commits!

---

## 🚀 Quick Start (Running Locally)

### Option 1: Double-Click Launcher
Simply double-click **`start.bat`** in this folder. It starts the local server and automatically opens Microsoft Edge at `http://localhost:3000`.

### Option 2: PowerShell
Open PowerShell in this folder and run:
```powershell
.\start-server.ps1
```

---

## 🔒 Local `.env` Configuration

Your credentials are kept safely in your local **`.env`** file (which is ignored by Git in `.gitignore`):
```env
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef...
```

When you launch `start.bat` or `.\start-server.ps1`, it automatically loads these credentials into the local runtime without touching any Git-tracked files.

---

## 🌐 Deploying to GitHub Pages with Secrets

NovaStream includes a pre-configured GitHub Actions workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### Step 1: Create a GitHub Repository
1. Go to [GitHub](https://github.com/new) and create a new repository (e.g. `novastream`).

### Step 2: Push Your Code
Open PowerShell in `d:\Streaming` and run:
```powershell
git init
git add .
git commit -m "Initial commit of NovaStream 1080p60 WebRTC"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git
git push -u origin main
```
*(Notice: Your `.env` and `env-config.js` will NOT be committed because they are protected by `.gitignore`)*.

### Step 3: Add Your Firebase Secrets to GitHub
1. In your GitHub repository, click **Settings** > **Secrets and variables** > **Actions**.
2. Click **New repository secret** and add the following 6 secrets from your `.env`:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`

### Step 4: Enable GitHub Pages
1. In your GitHub repository, go to **Settings** > **Pages**.
2. Under **Build and deployment > Source**, select **GitHub Actions**.
3. Now go to the **Actions** tab. The **Deploy to GitHub Pages** workflow will run automatically.
4. Once completed, your site will be live at:
   ```
   https://<YOUR-USERNAME>.github.io/<YOUR-REPO-NAME>/
   ```

### Step 5: Authorize GitHub Domain in Firebase
To allow Google Sign-In to work on your new GitHub Pages site:
1. Go to [Firebase Console](https://console.firebase.google.com/) > Your Project.
2. Navigate to **Authentication** > **Settings** tab.
3. Under **Authorized domains**, click **Add domain**.
4. Add: `<YOUR-USERNAME>.github.io`
5. Click **Add**.

---

## 🎮 How to Stream Anything to Another Person

### For the Streamer:
1. Open the website and click **Sign in with Google**.
2. Under **Broadcast From This Device**, choose your settings:
   - Resolution: `1080p Full HD` (or `1440p` / `4K`)
   - Frame Rate: `60 FPS`
   - Bitrate: `10 Mbps` or `12 Mbps`
   - Check **Mix Microphone** if you want to speak.
3. Click **Start 1080p60 Stream**.
4. In the browser screen share dialog:
   - Select **Entire Screen** (to stream games or anything on your PC) or **Window**.
   - Ensure **"Share system audio"** is checked at the bottom of the dialog.
5. Copy the **Room Code** or click **Copy 1-Click Invite Link** and send it to your friend!

### For the Viewer:
1. Open the invite link (or website).
2. Click **Sign in with Google**, enter the room code, and click **Join Stream**.
3. The stream connects within milliseconds in full 1080p 60fps!
4. If your browser restricts audio autoplay, click the **Unmute Stream** prompt on the screen.

---

## 📂 Project Structure

```
d:\Streaming\
├── .env                  # Local Firebase credentials (NEVER committed to git)
├── .env.example          # Template for repository
├── .gitignore            # Protects .env and local generated files
├── .github\
│   └── workflows\
│       └── deploy.yml    # GitHub Actions workflow for automatic Pages deployment
├── index.html            # Main web application & responsive UI
├── style.css             # Liquid Glass UI, morphing living orbs & specular bevels
├── app.js                # UI coordinator, routing, telemetry HUD, modals
├── auth.js               # Firebase Google Authentication & user profile state
├── chat.js               # End-to-end encrypted (E2EE) live chat engine
├── firebase-config.js    # Firebase SDK initialization & environment resolver
├── streamer.js           # 4K/1080p60 screen capture & host WebRTC signaling
├── viewer.js             # Viewer WebRTC peer client & 2-way voice controller
├── webrtc.js             # Bitrate optimization, SDP munging, 60fps & audio tuning
├── start.bat             # 1-Click Windows execution launcher
├── start-server.ps1      # Native .NET HttpListener server & .env loader
├── README.md             # Documentation & setup guide
```
