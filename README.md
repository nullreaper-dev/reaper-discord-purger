# Reaper – Discord Message Purger

Bulk-delete your own Discord messages, or mass-leave servers, with style. A fork of [Undiscord](https://github.com/victornpb/undiscord) by victornpb, with a new UI, theme packs, animations, sounds, speed presets, hardening patches, and Android/Windows app wrappers.

**Only published here on GitHub and on [Greasy Fork](https://greasyfork.org/en/scripts/604030). Copies from anywhere else may have been modified.**

## What it does

- **Purge Messages** – the original Undiscord engine: search and bulk-delete your own messages across a channel, DM, or whole server, with filters (author, date range, content, attachments) and a dry-run preview mode.
- **Leave Servers** (new in v1.9.0) – a separate tool that mass-leaves servers you pick, using Discord's own official "leave guild" endpoint (the same action as clicking Leave Server yourself, just batched). It never touches a single message. Requires typing `LEAVE` to confirm before anything happens.

Both only ever act on your own account through Discord's normal web app - this is a userscript, not a bot, and it doesn't ask for or store your password.

## Install

Get it from [Greasy Fork](https://greasyfork.org/en/scripts/604030) with Tampermonkey (or any userscript manager). That page auto-updates from this repository.

## Bugs & ideas

Open an issue here or leave a comment on the Greasy Fork page.

## Found a security issue?

Please don't post it as a public issue first – email **nullreaperdev@gmail.com** so it can be fixed before it's public. Public issues are fine for anything else.

## Licence & credits

MIT. Core bulk-deletion engine from [Undiscord](https://github.com/victornpb/undiscord) by victornpb. See `LICENSE`.
