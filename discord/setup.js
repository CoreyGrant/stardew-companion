#!/usr/bin/env node
/**
 * discord/setup.js
 *
 * Configures the Stardew Companion Discord server:
 *   - Removes the default General text/voice channels Discord creates
 *   - Creates: #welcome (read-only), #chat, #feature-requests, #bug-reports, #feedback
 *   - Posts the welcome embed to #welcome
 *   - Posts and pins templates in #feature-requests and #bug-reports
 *   - Creates a permanent (never-expires) invite on #welcome
 *   - Prints the invite URL + GitHub Actions setup instructions
 *
 * Prerequisites: see discord/README.md
 *
 * Usage:
 *   DISCORD_BOT_TOKEN=<token> DISCORD_GUILD_ID=<guild-id> node discord/setup.js
 */

'use strict';

const token   = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !guildId) {
  console.error('Error: DISCORD_BOT_TOKEN and DISCORD_GUILD_ID must both be set.');
  console.error('  See discord/README.md for setup instructions.');
  process.exit(1);
}

// ── Discord REST helpers ────────────────────────────────────────────────────────

const BASE = 'https://discord.com/api/v10';

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 204) return null;

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`${method} ${path} → HTTP ${res.status}: ${JSON.stringify(data, null, 2)}`);
  }
  return data;
}

// ── Permission bits ─────────────────────────────────────────────────────────────

// Deny SEND_MESSAGES (1 << 11) for @everyone — makes the channel read-only.
// The @everyone role always has the same ID as the guild itself.
const SEND_MESSAGES_BIT = String(1 << 11);

// ── Channel helpers ─────────────────────────────────────────────────────────────

/**
 * Create a text channel.
 * @param {string}  name
 * @param {string}  topic
 * @param {number}  position
 * @param {boolean} readOnly  If true, deny @everyone from sending messages.
 */
async function createChannel(name, topic, position, readOnly = false) {
  const permissionOverwrites = readOnly
    ? [{ id: guildId, type: 0 /* role */, deny: SEND_MESSAGES_BIT }]
    : [];

  const ch = await api('POST', `/guilds/${guildId}/channels`, {
    name,
    type: 0, // GUILD_TEXT
    topic,
    position,
    permission_overwrites: permissionOverwrites,
  });

  console.log(`  ✓ #${ch.name}  (id: ${ch.id})`);
  return ch;
}

async function postMessage(channelId, content) {
  return api('POST', `/channels/${channelId}/messages`, { content });
}

async function postEmbed(channelId, embed) {
  return api('POST', `/channels/${channelId}/messages`, { embeds: [embed] });
}

async function pinMessage(channelId, messageId) {
  // Pinning uses PUT with no body → 204
  await api('PUT', `/channels/${channelId}/pins/${messageId}`);
}

async function createPermanentInvite(channelId) {
  return api('POST', `/channels/${channelId}/invites`, {
    max_age:  0, // never expires
    max_uses: 0, // unlimited
    unique:   false,
  });
}

// ── Content ─────────────────────────────────────────────────────────────────────

const APP_URL = 'https://coreygrant.github.io/stardew-companion/';

// Rich embed for #welcome
// color 0x6d9e4a is the "Stardew green" used throughout the app
const WELCOME_EMBED = {
  title: '🌱 Welcome to Stardew Companion',
  color: 0x6d9e4a,
  description: [
    'A free companion web app for Stardew Valley — plan your farm, track progress, and look up everything in the game.',
    '',
    '**What you can do:**',
    '• **Farm Planner** — place buildings, zones, sprinklers, paths, and trees on a live map',
    '• **Crop Tracker** — profit calculations, quality breakdowns, harvest calendars',
    '• **Fish Guide** — season, location, weather, difficulty, and fish pond rules',
    '• **Machines** — Keg, Preserves Jar, Furnace outputs and processing times',
    '• **Bundles & Museum** — track what you still need to donate',
    '• **Save Profiles** — import your save to tailor data to your current game',
    '',
    `**Open the app →** ${APP_URL}`,
    '',
    '**Channels:**',
    '💬 **#chat** — general chat about the app or Stardew Valley',
    '✨ **#feature-requests** — suggest new features (use the pinned template)',
    '🐛 **#bug-reports** — report bugs (use the pinned template)',
    '💡 **#feedback** — impressions, ratings, general thoughts',
  ].join('\n'),
};

const FEATURE_REQUEST_TEMPLATE = [
  '**✨ Feature Request Template**',
  'Use the format below when suggesting a new feature — it helps make sure nothing important is missed.',
  '',
  '```',
  '**What would you like added or changed?**',
  '[Describe the feature clearly — what it does and where in the app it would appear]',
  '',
  '**Why would this be useful?**',
  '[Explain the problem it solves or the use case it supports]',
  '',
  '**Any examples or references?**',
  '[Optional: links, screenshots, mockups, or references to how other apps handle it]',
  '```',
].join('\n');

const BUG_REPORT_TEMPLATE = [
  '**🐛 Bug Report Template**',
  'Use the format below when reporting a bug — the more detail you include, the faster it can be fixed.',
  '',
  '```',
  '**What went wrong?**',
  '[Describe what happened]',
  '',
  '**Steps to reproduce:**',
  '1. ',
  '2. ',
  '3. ',
  '',
  '**What did you expect to happen?**',
  '[Describe the expected behaviour]',
  '',
  '**Browser & OS:**',
  '[e.g. Chrome 124 / Windows 11  or  Safari / iOS 17]',
  '',
  '**Save profile / farm type (if relevant):**',
  '[e.g. Standard farm, Spring Year 2  or  N/A]',
  '```',
].join('\n');

// ── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Remove default channels Discord creates when a server is made
  console.log('Fetching existing channels…');
  const existing = await api('GET', `/guilds/${guildId}/channels`);

  const toRemove = existing.filter(
    (ch) => ch.type === 2 /* voice */ || (ch.type === 0 /* text */ && ch.name === 'general'),
  );

  if (toRemove.length > 0) {
    console.log(`Removing ${toRemove.length} default channel(s)…`);
    for (const ch of toRemove) {
      await api('DELETE', `/channels/${ch.id}`);
      console.log(`  ✓ Removed #${ch.name}`);
    }
  }

  // 2. Create channels in the desired display order
  console.log('\nCreating channels…');
  const welcome         = await createChannel('welcome',          'Welcome to Stardew Companion — read me first!',               0, true);
  const chat            = await createChannel('chat',             'Chat about the app or anything Stardew Valley related',       1);
  const featureRequests = await createChannel('feature-requests', 'Suggest new features — see the pinned template before posting', 2);
  const bugReports      = await createChannel('bug-reports',      'Report bugs — see the pinned template before posting',        3);
  /* feedback */          await createChannel('feedback',         'General impressions and thoughts about the app',              4);

  // 3. Post the welcome embed
  console.log('\nPosting messages…');
  await postEmbed(welcome.id, WELCOME_EMBED);
  console.log('  ✓ Welcome embed posted to #welcome');

  // 4. Post + pin the feature request template
  const frMsg = await postMessage(featureRequests.id, FEATURE_REQUEST_TEMPLATE);
  await pinMessage(featureRequests.id, frMsg.id);
  console.log('  ✓ Feature request template posted + pinned');

  // 5. Post + pin the bug report template
  const brMsg = await postMessage(bugReports.id, BUG_REPORT_TEMPLATE);
  await pinMessage(bugReports.id, brMsg.id);
  console.log('  ✓ Bug report template posted + pinned');

  // 6. Create the permanent invite
  console.log('\nCreating permanent invite…');
  const invite    = await createPermanentInvite(welcome.id);
  const inviteUrl = `https://discord.gg/${invite.code}`;

  // 7. Done — print results and next steps
  console.log('\n' + '─'.repeat(60));
  console.log('✅  Server setup complete!');
  console.log('─'.repeat(60));
  console.log(`\n  Permanent invite URL:\n\n    ${inviteUrl}\n`);
  console.log('Next steps to show the Discord icon in the app:');
  console.log('  1. Go to your GitHub repo:');
  console.log('     Settings → Secrets and variables → Actions → Variables tab');
  console.log('  2. Click "New repository variable" and add:');
  console.log(`       Name:  VITE_DISCORD_INVITE`);
  console.log(`       Value: ${inviteUrl}`);
  console.log('  3. Push any commit (or manually trigger the deploy workflow).');
  console.log('     The Discord icon will appear in the top-right of the navbar.');
  console.log('\n' + '─'.repeat(60));
}

main().catch((err) => {
  console.error('\n❌  Setup failed:', err.message);
  process.exit(1);
});
