# Discord Server Setup

This directory contains a script that sets up the Stardew Companion Discord server
automatically via the Discord REST API.

## What the script does

- Removes the default General text/voice channels Discord creates
- Creates **#welcome** (read-only), **#chat**, **#feature-requests**, **#bug-reports**, **#feedback**
- Posts a welcome embed in **#welcome**
- Posts and pins the feature-request and bug-report templates in their channels
- Creates a **permanent invite** (never expires, unlimited uses) on **#welcome**
- Prints the invite URL and next steps for adding the Discord icon to the app

---

## One-time setup

### Step 1 — Create the Discord server

1. Open Discord and click the **+** button in the left sidebar ("Add a Server")
2. Choose **Create My Own** → **For me and my friends**
3. Name it **Stardew Companion** and click **Create**

### Step 2 — Enable Developer Mode (to copy the server ID)

1. Open Discord **Settings** (gear icon, bottom-left)
2. Go to **Advanced** → enable **Developer Mode**
3. Close settings
4. Right-click the **Stardew Companion** server icon in the left sidebar
5. Click **Copy Server ID** — save this value, you'll need it as `DISCORD_GUILD_ID`

### Step 3 — Create a Discord application and bot

1. Go to <https://discord.com/developers/applications>
2. Click **New Application** → name it **Stardew Companion** → **Create**
3. In the left sidebar, click **Bot**
4. Click **Reset Token**, confirm, then **Copy** the token — save it as `DISCORD_BOT_TOKEN`
   > ⚠️ Keep this token secret. It grants full control of the bot. Do not commit it.
5. Under **Privileged Gateway Intents**, nothing extra is needed — leave all off

### Step 4 — Add the bot to your server

1. In the left sidebar, click **OAuth2**
2. Under **Scopes**, tick **bot**
3. Under **Bot Permissions**, tick these:
   - **Manage Channels**
   - **Create Instant Invite**
   - **Send Messages**
   - **Manage Messages** (for pinning)
4. Copy the generated URL at the bottom and open it in your browser
5. Select **Stardew Companion** from the server dropdown → **Authorise**

### Step 5 — Run the setup script

```bash
DISCORD_BOT_TOKEN=<your-token> DISCORD_GUILD_ID=<your-server-id> node discord/setup.js
```

The script will print a permanent invite URL like `https://discord.gg/xxxxxxx` when it finishes.

### Step 6 — Add the invite URL to GitHub Actions

The invite URL is public-facing, so store it as a **variable** (not a secret):

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click the **Variables** tab → **New repository variable**
3. Name: `VITE_DISCORD_INVITE`  |  Value: `https://discord.gg/xxxxxxx`
4. Click **Add variable**

Then push any commit (or go to **Actions** → **Deploy to GitHub Pages** → **Run workflow**).
The Discord icon will appear in the top-right of the navbar once the deploy finishes.

---

## Re-running the script

If you need to re-run the script (e.g. after accidentally deleting a channel), it's safe to run
again — it will skip existing channels it doesn't own and create any that are missing.

Note: it will still try to delete the default "general" channel on each run, which Discord
will reject if it no longer exists. That error is harmless — the script will continue.
