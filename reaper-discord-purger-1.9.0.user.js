// ==UserScript==
// @name            Reaper - Discord Message Purger
// @description     Bulk delete your Discord messages, or mass-leave servers, with style. Fork of Undiscord with a new UI, effects and hardening.
// @version         1.9.0
// @author          nullreaper
// @match           https://*.discord.com/app
// @match           https://*.discord.com/channels/*
// @match           https://*.discord.com/login
// @license         MIT
// @namespace       reaper-discord-purger
// @icon            data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 7 7' shape-rendering='crispEdges'><rect width='7' height='7' fill='%23120306'/><g fill='%23ff2a44'><rect x='1' y='0' width='5' height='1'/><rect x='0' y='1' width='7' height='1'/><rect x='0' y='2' width='1' height='2'/><rect x='3' y='2' width='1' height='2'/><rect x='6' y='2' width='1' height='2'/><rect x='0' y='4' width='7' height='1'/><rect x='1' y='5' width='2' height='1'/><rect x='4' y='5' width='2' height='1'/><rect x='1' y='6' width='1' height='1'/><rect x='3' y='6' width='1' height='1'/><rect x='5' y='6' width='1' height='1'/></g></svg>
// @compatible      firefox
// @compatible      chrome
// @compatible      edge
// @grant           none
// @attribution     Based on Undiscord by victornpb (https://github.com/victornpb/undiscord)
// @downloadURL https://update.greasyfork.org/scripts/604030/Reaper%20-%20Discord%20Message%20Purger.user.js
// @updateURL https://update.greasyfork.org/scripts/604030/Reaper%20-%20Discord%20Message%20Purger.meta.js
// ==/UserScript==
/*
 * Reaper - Discord Message Purger
 * A fork of Undiscord. Reaper adds a new UI, theme packs, animations, sounds,
 * dialogs, speed presets, hardening patches, and Android/Windows app wrappers.
 * The core bulk-deletion engine is from the original Undiscord project.
 *
 * v1.9.0: added a separate "Leave Servers" tool (mass-leave guilds via the
 * official DELETE /users/@me/guilds/{id} endpoint). It is its own code path,
 * entirely separate from the purge engine above, with its own confirm step
 * (type LEAVE) and rate-limit handling. It never touches messages.
 *
* Reaper modifications: Copyright (c) 2025 nullreaper
 *
 * Based on Undiscord - https://github.com/victornpb/undiscord
 *
 * ---------------------------------------------------------------------------
 * MIT License
 *
 * Copyright (c) 2019-2025 Victornpb and contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * Attribution: Original project (https://github.com/victornpb/undiscord)
 * Derivatives must keep attribution comments to the original project in the code readme and license.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * ---------------------------------------------------------------------------
 */
(function () {
	'use strict';
	if (window.__reaperLoaded) return;
	window.__reaperLoaded = true;

	/* rollup-plugin-baked-env */
	const VERSION = "1.9.0";
	const BRAND_NAME = 'Reaper';      // change the tool name here
	const AUTHOR_NAME = 'nullreaper';  // change your name/handle here

	// ===== Pixel skull (7x7 grid) used for icons + background pattern =====
	const SKULL_RECTS =
	  "<rect x='1' y='0' width='5' height='1'/>" +
	  "<rect x='0' y='1' width='7' height='1'/>" +
	  "<rect x='0' y='2' width='1' height='2'/>" +
	  "<rect x='3' y='2' width='1' height='2'/>" +
	  "<rect x='6' y='2' width='1' height='2'/>" +
	  "<rect x='0' y='4' width='7' height='1'/>" +
	  "<rect x='1' y='5' width='2' height='1'/>" +
	  "<rect x='4' y='5' width='2' height='1'/>" +
	  "<rect x='1' y='6' width='1' height='1'/>" +
	  "<rect x='3' y='6' width='1' height='1'/>" +
	  "<rect x='5' y='6' width='1' height='1'/>";

	const SKULL_TILE = "url(\"data:image/svg+xml;utf8," +
	  "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160' shape-rendering='crispEdges'>" +
	  "<g fill='%23ff2a44'>" +
	  "<g opacity='.07' transform='translate(20 22) scale(5)'>" + SKULL_RECTS + "</g>" +
	  "<g opacity='.04' transform='translate(100 96) scale(3)'>" + SKULL_RECTS + "</g>" +
	  "<g opacity='.03' transform='translate(118 14) scale(2)'>" + SKULL_RECTS + "</g>" +
	  "</g>" +
	  "<g font-family='monospace' font-size='9' fill='%23ff2a44'>" +
	  "<text x='8' y='150' opacity='.05'>01000100 DEL</text>" +
	  "<text x='70' y='70' opacity='.035'>0xDEAD</text>" +
	  "<text x='10' y='96' opacity='.03'>rm -rf /msg</text>" +
	  "</g></svg>\")";

	const SKULL_SVG_24 = `<svg aria-hidden="false" width="24" height="24" viewBox="-0.5 -0.5 8 8" shape-rendering="crispEdges"><g fill="currentColor">${SKULL_RECTS}</g></svg>`;

	var themeCss = (`
/* undiscord window */
#undiscord.browser { box-shadow: var(--shadow-border), var(--shadow-high); border: 1px solid var(--border-subtle); overflow: hidden; }
#undiscord.container,
#undiscord .container { background-color: var(--background-surface-high); border-radius: 8px; box-sizing: border-box; cursor: default; flex-direction: column; }
#undiscord .header { background-color: var(--background-tertiary); height: 48px; align-items: center; min-height: 48px; padding: 0 16px; display: flex; color: var(--header-secondary); cursor: grab; }
#undiscord .header .icon { color: var(--interactive-normal); margin-right: 8px; flex-shrink: 0; width: 24; height: 24; }
#undiscord .header .icon:hover { color: var(--interactive-hover); }
#undiscord .header h3 { font-size: 16px; line-height: 20px; font-weight: 500; font-family: var(--font-display); color: var(--header-primary); flex-shrink: 0; margin-right: 16px; }
#undiscord .spacer { flex-grow: 1; }
#undiscord .header .vert-divider { width: 1px; height: 24px; background-color: var(--background-modifier-accent); margin-right: 16px; flex-shrink: 0; }
#undiscord legend,
#undiscord label { color: var(--header-secondary); font-size: 12px; line-height: 16px; font-weight: 500; text-transform: uppercase; cursor: default; font-family: var(--font-display); margin-bottom: 8px; }
#undiscord .multiInput { display: flex; align-items: center; font-size: 16px; box-sizing: border-box; width: 100%; border-radius: 3px; color: var(--text-default); background-color: var(--input-background); border: none; transition: border-color 0.2s ease-in-out 0s; }
#undiscord .multiInput :first-child { flex-grow: 1; }
#undiscord .multiInput button:last-child { margin-right: 4px; }
#undiscord .input { font-size: 16px; width: 100%; transition: border-color 0.2s ease-in-out 0s; padding: 10px; height: 44px; background-color: var(--input-background); border: 1px solid var(--input-border); border-radius: 8px; box-sizing: border-box; color: var(--text-default); }
#undiscord fieldset { margin-top: 16px; }
#undiscord .input-wrapper { display: flex; align-items: center; font-size: 16px; box-sizing: border-box; width: 100%; border-radius: 3px; color: var(--text-default); background-color: var(--input-background); border: none; transition: border-color 0.2s ease-in-out 0s; }
#undiscord input[type="text"],
#undiscord input[type="search"],
#undiscord input[type="password"],
#undiscord input[type="datetime-local"],
#undiscord input[type="number"],
#undiscord input[type="range"] { background-color: var(--input-background); border: 1px solid var(--input-border); border-radius: 8px; box-sizing: border-box; color: var(--text-default); font-size: 16px; height: 44px; padding: 12px 10px; transition: border-color .2s ease-in-out; width: 100%; }
#undiscord .divider,
#undiscord hr { border: none; margin-bottom: 24px; padding-bottom: 4px; border-bottom: 1px solid var(--background-modifier-accent); }
#undiscord .sectionDescription { margin-bottom: 16px; color: var(--header-secondary); font-size: 14px; line-height: 20px; font-weight: 400; }
#undiscord a { color: var(--text-link); text-decoration: none; }
#undiscord .btn,
#undiscord button { position: relative; display: flex; -webkit-box-pack: center; justify-content: center; -webkit-box-align: center; align-items: center; box-sizing: border-box; background: none; border: none; border-radius: 3px; font-size: 14px; font-weight: 500; line-height: 16px; padding: 2px 16px; user-select: none; /* sizeSmall */     width: 60px; height: 32px; min-width: 60px; min-height: 32px; /* lookFilled colorPrimary */     color: rgb(255, 255, 255); background-color: var(--button-secondary-background); }
#undiscord .sizeMedium { width: 96px; height: 38px; min-width: 96px; min-height: 38px; }
#undiscord .sizeMedium.icon { width: 38px; min-width: 38px; }
#undiscord sup { vertical-align: top; }
/* lookFilled colorPrimary */
#undiscord .accent { background-color: var(--brand-experiment); }
#undiscord .danger { background-color: var(--button-danger-background); }
#undiscord .positive { background-color: var(--button-positive-background); }
#undiscord .info { font-size: 12px; line-height: 16px; padding: 8px 10px; color: var(--text-muted); }
/* Scrollbar */
#undiscord .scroll::-webkit-scrollbar { width: 8px; height: 8px; }
#undiscord .scroll::-webkit-scrollbar-corner { background-color: transparent; }
#undiscord .scroll::-webkit-scrollbar-thumb { background-clip: padding-box; border: 2px solid transparent; border-radius: 4px; background-color: var(--scrollbar-thin-thumb); min-height: 40px; }
#undiscord .scroll::-webkit-scrollbar-track { border-color: var(--scrollbar-thin-track); background-color: var(--scrollbar-thin-track); border: 2px solid var(--scrollbar-thin-track); }
/* fade scrollbar */
#undiscord .scroll::-webkit-scrollbar-thumb,
#undiscord .scroll::-webkit-scrollbar-track { visibility: hidden; }
#undiscord .scroll:hover::-webkit-scrollbar-thumb,
#undiscord .scroll:hover::-webkit-scrollbar-track { visibility: visible; }
/**** functional classes ****/
#undiscord.redact .priv { display: none !important; }
#undiscord.redact x:not(:active) { color: transparent !important; background-color: var(--primary-700) !important; cursor: default; user-select: none; }
#undiscord.redact x:hover { position: relative; }
#undiscord.redact x:hover::after { content: "Redacted information (Streamer mode: ON)"; position: absolute; display: inline-block; top: -32px; left: -20px; padding: 4px; width: 150px; font-size: 8pt; text-align: center; white-space: pre-wrap; background-color: var(--background-floating); -webkit-box-shadow: var(--elevation-high); box-shadow: var(--elevation-high); color: var(--text-default); border-radius: 5px; pointer-events: none; }
#undiscord.redact [priv] { -webkit-text-security: disc !important; }
#undiscord :disabled { opacity: 0.6; cursor: not-allowed; }
/**** layout and utility classes ****/
#undiscord,
#undiscord * { box-sizing: border-box; }
#undiscord .col { display: flex; flex-direction: column; }
#undiscord .row { display: flex; flex-direction: row; align-items: center; }
#undiscord .mb1 { margin-bottom: 8px; }
#undiscord .log { margin-bottom: 0.25em; }
#undiscord .log-debug { color: inherit; }
#undiscord .log-info { color: #00b0f4; }
#undiscord .log-verb { color: #72767d; }
#undiscord .log-warn { color: #faa61a; }
#undiscord .log-error { color: #f04747; }
#undiscord .log-success { color: #43b581; }
`);

	var mainCss = (`
/**** Undiscord Button ****/
#undicord-btn { position: relative; width: auto; height: 24px; margin: 0 8px; cursor: pointer; color: var(--interactive-normal); flex: 0 0 auto; transition: color .15s, filter .15s; }
#undicord-btn:hover { color: #ff2a44; filter: drop-shadow(0 0 4px rgba(255,42,68,.8)); }
#undicord-btn progress { position: absolute; top: 23px; left: -4px; width: 32px; height: 12px; display: none; }
#undicord-btn.running { color: #ff2a44 !important; filter: drop-shadow(0 0 5px rgba(255,42,68,.9)); }
#undicord-btn.running progress { display: block; }
/**** Undiscord Interface ****/
#undiscord { position: fixed; z-index: 100; top: 58px; right: 10px; display: flex; flex-direction: column; width: 940px; height: 80vh; min-width: 720px; max-width: 100vw; min-height: 448px; max-height: 100vh; color: var(--text-normal); border-radius: 4px; background-color: var(--background-secondary); box-shadow: var(--elevation-stroke), var(--elevation-high); will-change: top, left, width, height; }
#undiscord .header .icon { cursor: pointer; }
#undiscord .window-body { height: calc(100% - 48px); }
#undiscord .sidebar { overflow: hidden scroll; overflow-y: auto; width: 270px; min-width: 250px; height: 100%; max-height: 100%; padding: 8px; background: var(--bg-overlay-4, var(--background-base-lowest)); }
#undiscord .sidebar legend,
#undiscord .sidebar label { display: block; width: 100%; }
#undiscord .main { display: flex; max-width: calc(100% - 250px); background-color: var(--bg-overlay-chat, var(--background-base-lower)); flex-grow: 1; }
#undiscord.hide-sidebar .sidebar { display: none; }
#undiscord.hide-sidebar .main { max-width: 100%; }
#undiscord #logArea { font-family: Consolas, Liberation Mono, Menlo, Courier, monospace; font-size: 0.75rem; overflow: auto; padding: 10px; user-select: text; flex-grow: 1; flex-grow: 1; cursor: auto; }
#undiscord .tbar { padding: 8px; background-color: var(--bg-overlay-2, var(--__header-bar-background)); }
#undiscord .tbar button { margin-right: 4px; margin-bottom: 4px; }
#undiscord .tbar .preScanStatus {
  display: none;
  margin: 0 0 4px;
  font-size: 12px;
  line-height: 16px;
  color: var(--u-muted);
  text-align: center;
  width: 100%;
  align-self: center;
}
#undiscord .tbar .progressRow { gap: 8px; align-items: center; justify-content: flex-start; padding: 2px 0 0; width: 100%; }
#undiscord .tbar .progressRow #progressBar { flex: 1 1 auto; width: auto; min-width: 0; margin-top: 0; }
#undiscord #progressBarPercent {
  width: 56px;
  min-width: 56px;
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--u-text);
}
#undiscord .footer { cursor: se-resize; padding-right: 30px; }
#undiscord .footer #progressPercent { padding: 0 1em; font-size: small; color: var(--interactive-muted); flex-grow: 1; }
.resize-handle { position: absolute; bottom: -15px; right: -15px; width: 30px; height: 30px; transform: rotate(-45deg); background: repeating-linear-gradient(0, var(--background-modifier-accent), var(--background-modifier-accent) 1px, transparent 2px, transparent 4px); cursor: nwse-resize; }
/**** Elements ****/
#undiscord summary { font-size: 16px; font-weight: 500; line-height: 20px; position: relative; overflow: hidden; margin-bottom: 2px; padding: 6px 10px; cursor: pointer; white-space: nowrap; text-overflow: ellipsis; color: var(--interactive-normal); border-radius: 4px; flex-shrink: 0; }
#undiscord fieldset { padding-left: 8px; }
#undiscord legend a { float: right; text-transform: initial; }
#undiscord progress { height: 8px; margin-top: 4px; flex-grow: 1; }
#undiscord .importJson { display: flex; flex-direction: row; }
#undiscord .importJson button { margin-left: 5px; width: fit-content; }
`);
var undiscordUiCss = (`
/* ===== Undiscord: RED SKULL palette (does not depend on Discord theme) ===== */
#undiscord{
  --u-bg: #0d0204;
  --u-panel: #1a0508;
  --u-panel2: #120306;
  --u-border: rgba(255,60,75,.22);
  --u-text: rgba(255,236,236,.94);
  --u-muted: rgba(255,190,190,.66);
  --u-link: #ff7a85;
  --u-btn: #2e080e;
  --u-btn-hover: #4d0d17;
  --u-danger: #d10f28;
  --u-danger-hover: #ff2a44;
  --u-input: #090102;
  --u-focus: rgba(255,42,68,.35);
  --u-glow: rgba(255,30,50,.45);
  --u-skulls: ${SKULL_TILE};
  /* Compact deleted-log global scale (date, text, avatar, etc.) */
  --u-compact-scale: 1.05;

  background: var(--u-bg) !important;
  color: var(--u-text) !important;
  border: 1px solid rgba(255,42,68,.45) !important;
  border-radius: 10px !important;
  box-shadow: 0 0 0 1px rgba(0,0,0,.6), 0 0 40px rgba(255,20,40,.28), 0 16px 60px rgba(0,0,0,.65) !important;
}

/* CRT scanlines over the whole window (click-through) */
#undiscord::after{
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  z-index: 50;
  background: repeating-linear-gradient(0deg, rgba(255,255,255,.012) 0 1px, transparent 1px 3px);
}

/* Header */
#undiscord .header{
  background: linear-gradient(90deg, #22040a 0%, #5a0a15 55%, #22040a 100%) !important;
  color: var(--u-text) !important;
  border-bottom: 1px solid rgba(255,42,68,.55) !important;
  box-shadow: 0 2px 18px rgba(255,20,40,.25);
}
#undiscord .header h3{
  color: #fff !important;
  font-family: "JetBrains Mono", "Fira Code", Consolas, Menlo, monospace !important;
  font-weight: 800 !important;
  letter-spacing: .14em;
  text-transform: uppercase;
  text-shadow: 2px 0 rgba(255,0,60,.85), -2px 0 rgba(0,255,255,.25), 0 0 12px rgba(255,42,68,.6);
  animation: ud-glitch 5s infinite steps(1);
}
@keyframes ud-glitch{
  0%, 92%, 100% { transform: none; text-shadow: 2px 0 rgba(255,0,60,.85), -2px 0 rgba(0,255,255,.25), 0 0 12px rgba(255,42,68,.6); }
  93% { transform: translateX(2px) skewX(-8deg); text-shadow: -3px 0 rgba(255,0,60,.95), 3px 0 rgba(0,255,255,.45); }
  95% { transform: translateX(-2px); text-shadow: 3px 0 rgba(255,0,60,.95), -3px 0 rgba(0,255,255,.45); }
  97% { transform: none; }
}
@media (prefers-reduced-motion: reduce){
  #undiscord .header h3{ animation: none; }
}
#undiscord .header span{ color: var(--u-muted) !important; }
#undiscord .header .vert-divider{ background: rgba(255,42,68,.45) !important; }
#undiscord .header .icon{ color: var(--u-muted) !important; }
#undiscord .header .icon:hover{ color: var(--u-text) !important; }
#undiscord .header > svg.icon{
  color: #ff2a44 !important;
  filter: drop-shadow(0 0 5px rgba(255,42,68,.9));
}

/* Layout */
#undiscord .sidebar{
  background: linear-gradient(180deg, rgba(255,40,60,.06), rgba(255,40,60,.01)) , var(--u-panel2) !important;
  border-right: 1px solid var(--u-border) !important;
  padding: 12px 10px !important;
}
#undiscord .sidebar details{
  background: transparent;
  border: 1px solid rgba(255,60,75,.08);
  border-radius: 10px;
  padding: 6px 6px 4px;
  margin-bottom: 10px;
}
#undiscord .sidebar summary{
  color: var(--u-text) !important;
  background: rgba(255,40,60,.06);
  border: 1px solid rgba(255,60,75,.14);
  border-radius: 8px;
  padding: 6px 10px;
}
#undiscord .sidebar summary:hover{
  background: rgba(255,40,60,.12);
}
#undiscord .sidebar details[open] > summary{
  border-color: rgba(255,42,68,.45);
  box-shadow: inset 3px 0 0 #ff2a44;
}
#undiscord fieldset{ border: none; }
#undiscord .sidebar fieldset{
  padding-left: 6px;
  margin-top: 10px;
}
#undiscord .sidebar hr{
  margin: 10px 0;
  border-bottom: 1px solid rgba(255,60,75,.14);
}
#undiscord .sidebar .sectionDescription{
  font-size: 12px;
  line-height: 16px;
}
#undiscord .sidebar .input,
#undiscord .sidebar input[type="text"],
#undiscord .sidebar input[type="search"],
#undiscord .sidebar input[type="password"],
#undiscord .sidebar input[type="datetime-local"],
#undiscord .sidebar input[type="number"]{
  height: 38px !important;
  font-size: 14px !important;
  padding: 8px 10px !important;
}
#undiscord .sidebar input[type="checkbox"]{
  height: auto !important;
  width: auto !important;
  margin-right: 8px;
  padding: 0 !important;
}
#undiscord input[type="checkbox"], #undiscord input[type="range"]{ accent-color: #ff2a44; }
#undiscord .main{
  background:
    var(--u-skulls) repeat,
    radial-gradient(900px 500px at 85% -10%, rgba(255,30,50,.20), transparent 60%),
    radial-gradient(700px 400px at -10% 110%, rgba(140,0,20,.25), transparent 60%),
    var(--u-bg) !important;
}

/* Texts */
#undiscord summary{ color: var(--u-text) !important; }
#undiscord legend,
#undiscord label{ color: var(--u-muted) !important; }
#undiscord .sectionDescription{ color: var(--u-muted) !important; }
#undiscord .info{ color: var(--u-muted) !important; }
#undiscord a{ color: var(--u-link) !important; }

/* Inputs */
#undiscord input,
#undiscord .input,
#undiscord input[type="text"],
#undiscord input[type="search"],
#undiscord input[type="password"],
#undiscord input[type="datetime-local"],
#undiscord input[type="number"]{
  background: var(--u-input) !important;
  color: var(--u-text) !important;
  border: 1px solid var(--u-border) !important;
  border-radius: 10px !important;
}
#undiscord input:focus{
  outline: none !important;
  box-shadow: 0 0 0 3px var(--u-focus) !important;
  border-color: rgba(255,60,80,.7) !important;
}

/* Buttons */
#undiscord button{
  background: var(--u-btn) !important;
  color: var(--u-text) !important;
  border: 1px solid var(--u-border) !important;
  border-radius: 10px !important;
  transition: background .15s, box-shadow .15s;
}
#undiscord button:hover{
  background: var(--u-btn-hover) !important;
}
#undiscord button:focus-visible{
  outline: 2px solid #ff2a44 !important;
  outline-offset: 2px;
}
#undiscord button.danger{
  background: linear-gradient(180deg, #ff2a44, #a50a1e) !important;
  border-color: rgba(255,120,130,.45) !important;
  font-weight: 800 !important;
  letter-spacing: .06em;
  text-shadow: 0 1px 0 rgba(0,0,0,.4);
  box-shadow: 0 0 14px var(--u-glow), inset 0 1px 0 rgba(255,255,255,.2);
}
#undiscord button.danger:hover{
  background: linear-gradient(180deg, #ff4058, #c20d24) !important;
  box-shadow: 0 0 22px rgba(255,42,68,.75), inset 0 1px 0 rgba(255,255,255,.25);
}
#undiscord button.danger:disabled{ box-shadow: none; }

/* Toolbars */
#undiscord .tbar{
  background: rgba(26,5,8,.92) !important;
  border-bottom: 1px solid var(--u-border) !important;
}
#undiscord .tbar > .row:first-child{
  position: relative;
  padding-right: 112px;
  min-height: 38px;
}
#undiscord #stop{
  position: absolute;
  right: 0;
  top: 0;
  z-index: 4;
}
#undiscord .tbar.footer{
  border-top: 1px solid var(--u-border) !important;
  border-bottom: none !important;
}

/* Conversation badge */
#undiscord .channelBadge,
#undiscord .convBadge{
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  margin-right: 6px;
  margin-bottom: 4px;
  border-radius: 999px;
  background: rgba(255,40,60,.08);
  border: 1px solid rgba(255,60,75,.22);
  height: 38px;
  box-sizing: border-box;
  max-width: 280px;
  overflow: hidden;
}
#undiscord .channelBadge{
  max-width: 220px;
}
#undiscord .convBadge img{
  width: 28px;
  height: 28px;
  border-radius: 999px;
  flex: 0 0 auto;
  box-shadow: 0 0 0 1px rgba(255,60,75,.4);
}
#undiscord .channelBadge .channelHash{
  font-size: 14px;
  font-weight: 700;
  color: #ff2a44 !important;
}
#undiscord .channelBadge .channelName,
#undiscord .convBadge .convName{
  font-size: 14px;
  font-weight: 600;
  color: var(--u-text) !important;
  padding-right: 2px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
#undiscord .allChannelsToggle{
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 8px;
  margin-bottom: 4px;
  padding: 0 10px;
  height: 38px;
  border-radius: 999px;
  border: 1px solid rgba(255,60,75,.22);
  background: rgba(255,40,60,.05);
  color: var(--u-muted);
  font-size: 12px;
  text-transform: none;
  white-space: nowrap;
}
#undiscord .allChannelsToggle input{
  margin: 0;
}
#undiscord.verbose .convBadge{
  display: none !important;
}
#undiscord.verbose .channelBadge{
  display: none !important;
}
#undiscord.verbose .allChannelsToggle{
  display: none !important;
}

/* Log */
#undiscord #logArea{
  background: transparent !important;
  color: var(--u-text) !important;
}
#undiscord .log-warn{ color: #ffcc66 !important; }
#undiscord .log-error{ color: #ff6b6b !important; }
#undiscord .log-success{ color: #6bff95 !important; }
#undiscord .log-info{ color: #ff9aa3 !important; }
#undiscord .log-verb{ color: rgba(255,220,220,.55) !important; }

/* Progress */
#undiscord progress{
  appearance: none !important;
  -webkit-appearance: none !important;
  -moz-appearance: none !important;
  background: rgba(255,40,60,.08) !important;
  border: 1px solid rgba(255,60,75,.25) !important;
  border-radius: 999px !important;
  overflow: hidden !important;
  height: 10px !important;
}
#undiscord progress::-webkit-progress-bar{
  background: rgba(255,40,60,.08) !important;
  border-radius: 999px !important;
}
#undiscord progress::-webkit-progress-value{
  background: repeating-linear-gradient(90deg, #ff2a44 0 10px, #b80c22 10px 14px) !important;
  border-radius: 999px !important;
  box-shadow: 0 0 10px rgba(255,42,68,.8);
}
#undiscord progress::-moz-progress-bar{
  background: repeating-linear-gradient(90deg, #ff2a44 0 10px, #b80c22 10px 14px) !important;
}
#undiscord #progressBarPercent{
  color: #ff4d5e !important;
  background: none !important;
  border: none !important;
  text-shadow: 0 0 8px rgba(255,42,68,.6);
}
/* Hide authorID */
#undiscord.hide-author #authorId,
#undiscord.hide-author #authorId.priv {
  -webkit-text-security: disc !important;
  text-security: disc !important;
}

/* Hide message text (compact + verbose log UIs) */
#undiscord .msgHidden { display: none; color: var(--u-muted) !important; font-style: italic; }
#undiscord.hide-text .msgText { display: none; }
#undiscord.hide-text .msgHidden { display: inline; }

/* Hide author identity in logs (compact: avatar + display name; verbose: author id) */
#undiscord .authorHidden { display: none; color: var(--u-muted) !important; font-style: italic; }
#undiscord.hide-author .authorText { display: none; }
#undiscord.hide-author .authorHidden { display: inline; }
#undiscord.hide-author img.authorAvatar { display: none !important; }

/* Compact-mode polish when hiding */
#undiscord.hide-author:not(.verbose) .log-del{
  grid-template-columns: calc(88px * var(--u-compact-scale)) minmax(0, 1fr) auto;
  column-gap: calc(10px * var(--u-compact-scale));
}
#undiscord.hide-author:not(.verbose) .log-del img.authorAvatar{ display: none !important; }
#undiscord.hide-author:not(.verbose) .log-del .head{ display: none; }
#undiscord.hide-author:not(.verbose) .log-del .txt{ min-width: 0; }
#undiscord.hide-author:not(.verbose) .log-del .content{ margin-top: 2px; }
#undiscord.hide-text:not(.verbose) .log-del .msgHidden{
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255,60,75,.18);
  background: rgba(255,40,60,.05);
  white-space: nowrap;
  word-break: normal;
  overflow-wrap: normal;
}
/* ===== FINISHED STATE ===== */
#undiscord.finished #progressBar::-webkit-progress-value { background: #2ecc71 !important; box-shadow: 0 0 10px rgba(46,204,113,.7); }
#undiscord.finished #progressBar { border-radius: 999px !important; }

#undiscord.finished #undicord-btn progress::-webkit-progress-value { background: #2ecc71 !important; }

/* Firefox */
#undiscord.finished #progressBar::-moz-progress-bar { background: #2ecc71 !important; }
#undiscord.finished #undicord-btn progress::-moz-progress-bar { background: #2ecc71 !important; }

/* Success message */
#undiscord .doneBanner{
  display:none;
  margin-top: 6px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(46, 204, 113, .35);
  background: rgba(46, 204, 113, .10);
  color: rgba(255,255,255,.9);
  font-size: 13px;
}
#undiscord.finished .doneBanner{ display:block; }

/* Hide Author ID redaction (independent from Streamer mode) */
#undiscord.hide-author x.priv-author:not(:active) {
  color: transparent !important;
  background-color: var(--primary-700) !important;
  cursor: default;
  user-select: none;
}
#undiscord.hide-author x.priv-author:hover {
  position: relative;
}
#undiscord.hide-author x.priv-author:hover::after {
  content: "Redacted Author ID (Hide Author ID/Text: ON)";
  position: absolute;
  display: inline-block;
  top: -32px;
  left: -20px;
  padding: 4px;
  width: 150px;
  font-size: 8pt;
  text-align: center;
  white-space: pre-wrap;
  background-color: var(--background-floating);
  box-shadow: var(--elevation-high);
  color: var(--text-default);
  border-radius: 5px;
  pointer-events: none;
}

/* ===== VERBOSE LOG MODE (red terminal) ===== */
#undiscord.verbose{
  --v-bg: #080102;
  --v-panel: #120307;
  --v-panel-2: #1a050a;
  --v-border: rgba(255,60,80,.30);
  --v-text: rgba(255,232,232,.95);
  --v-muted: rgba(230,160,165,.75);
  --v-accent: #ff4d5e;
  --v-accent-2: #ff9aa3;
  background: radial-gradient(1200px 600px at 80% -10%, rgba(255,30,50,.22), transparent 60%), var(--v-bg) !important;
  border-color: var(--v-border) !important;
  color: var(--v-text) !important;
  box-shadow: 0 0 40px rgba(255,20,40,.3), 0 20px 70px rgba(0,0,0,.6) !important;
}
#undiscord.verbose .header{
  background: linear-gradient(135deg, rgba(255,42,68,.35), rgba(90,10,21,.6)) !important;
  border-bottom: 1px solid var(--v-border) !important;
}
#undiscord.verbose .header h3,
#undiscord.verbose .header,
#undiscord.verbose .header .icon{
  color: var(--v-text) !important;
}
#undiscord.verbose.hide-sidebar .main{
  max-width: 100% !important;
}
#undiscord.verbose .main{
  background: var(--u-skulls) repeat, var(--v-bg) !important;
}
#undiscord.verbose .tbar{
  background: var(--v-panel-2) !important;
  border-bottom: 1px solid var(--v-border) !important;
}
#undiscord.verbose #logArea{
  padding: 8px !important;
  background: rgba(8,1,2,.6) !important;
  border-top: 1px solid var(--v-border) !important;
  font-size: 11.5px !important;
  line-height: 1.3 !important;
  font-family: "JetBrains Mono", "IBM Plex Mono", "Fira Code", Menlo, Consolas, "Liberation Mono", monospace !important;
}
#undiscord.verbose .log{
  margin-bottom: 0 !important;
}
#undiscord.verbose .log-vrow{
  display: grid;
  grid-template-columns: max-content max-content 1fr;
  gap: 2px;
  align-items: center;
  padding: 1px 6px;
  margin: 0 0 1px;
  border-radius: 3px;
  background: rgba(255,40,60,.03);
  border: 1px solid rgba(255,60,75,.08);
}
#undiscord.verbose .log-vrow .vtime{
  grid-column: 1;
  white-space: nowrap;
  color: var(--v-muted);
  font-size: 10px;
  line-height: 1.2;
}
#undiscord.verbose .log-vrow .vbadge{
  grid-column: 2;
  justify-self: center;
  margin: 0 4px;
  text-transform: uppercase;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .04em;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(255,42,68,.12);
  color: var(--v-accent);
  border: 1px solid rgba(255,42,68,.3);
  line-height: 1.2;
}
#undiscord.verbose .log-vrow.log-info .vbadge{ color: #ff9aa3; border-color: rgba(255,154,163,.35); }
#undiscord.verbose .log-vrow.log-warn .vbadge{ color: #ffb454; border-color: rgba(255,180,84,.35); background: rgba(255,180,84,.12); }
#undiscord.verbose .log-vrow.log-error .vbadge{ color: #ff6b6b; border-color: rgba(255,107,107,.35); background: rgba(255,107,107,.12); }
#undiscord.verbose .log-vrow.log-success .vbadge{ color: #7ee7c6; border-color: rgba(126,231,198,.35); background: rgba(126,231,198,.12); }
#undiscord.verbose .log-vrow.log-verb .vbadge{ color: #d9b4b8; border-color: rgba(217,180,184,.35); background: rgba(217,180,184,.10); }
#undiscord.verbose .log-vrow .vmsg{
  grid-column: 3;
  color: var(--v-text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.3;
}

#undiscord:not(.verbose) .log-del{
  display: grid;
  grid-template-columns: calc(88px * var(--u-compact-scale)) calc(27px * var(--u-compact-scale)) minmax(0, 1fr) auto;
  gap: calc(8px * var(--u-compact-scale));
  padding: calc(8px * var(--u-compact-scale)) calc(12px * var(--u-compact-scale));
  margin: 0 0 2px;
  border-radius: 8px;
  background: rgba(16,3,6,.88);
  border: 1px solid rgba(255,60,75,.09);
  border-left: 3px solid #ff2a44;
  align-items: flex-start;
}
#undiscord:not(.verbose) .log-del:last-child{ margin-bottom: 0; }
#undiscord:not(.verbose) .log-del .stamp{
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0px;
  min-width: calc(88px * var(--u-compact-scale));
  white-space: nowrap;
  padding: calc(2px * var(--u-compact-scale)) 0;
  background: transparent;
  border: none;
}
#undiscord:not(.verbose) .log-del img{
  width: calc(27px * var(--u-compact-scale));
  height: calc(27px * var(--u-compact-scale));
  border-radius: 999px;
  flex: 0 0 auto;
  box-shadow: 0 0 0 1px rgba(255,60,75,.4);
  margin-top: 2px;
}
#undiscord:not(.verbose) .log-del .head{
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
#undiscord:not(.verbose) .log-del .lineChannel{
  display: inline-flex;
  align-items: center;
  max-width: 220px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255,60,75,.22);
  background: rgba(255,40,60,.08);
  color: rgba(255,220,220,.8);
  font-size: calc(11.5px * var(--u-compact-scale));
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
#undiscord:not(.verbose) .log-del .date{
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0;
  background: none;
  border: none;
  font-size: calc(11.75px * var(--u-compact-scale));
  color: rgba(255,225,225,.82);
  letter-spacing: .02em;
}
#undiscord:not(.verbose) .log-del .date .d{
  text-transform: uppercase;
  opacity: .9;
}
#undiscord:not(.verbose) .log-del .date .t{
  opacity: .7;
}
#undiscord:not(.verbose) .log-del .author{
  font-size: calc(13.75px * var(--u-compact-scale));
  color: rgba(255,240,240,.94);
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
#undiscord:not(.verbose) .log-del .meta{
  font-size: calc(11.75px * var(--u-compact-scale));
  color: #ff4d5e;
  font-family: "JetBrains Mono", Consolas, Menlo, monospace;
  letter-spacing: .02em;
  white-space: nowrap;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(255,40,60,.08);
  border: 1px solid rgba(255,60,75,.22);
  align-self: center;
  text-align: right;
}
#undiscord:not(.verbose) .log-del .content{
  font-size: calc(13px * var(--u-compact-scale));
  line-height: 1.35;
  color: rgba(255,240,240,.92);
}
#undiscord:not(.verbose) .log-del .content .msgText{
  font-size: calc(13px * var(--u-compact-scale));
}
#undiscord:not(.verbose) .log-del .txt{
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  min-width: 0;
}
#undiscord:not(.verbose) .log-del .attachments{
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
#undiscord:not(.verbose) .log-del .attachments img{
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid rgba(255,60,75,.22);
  margin-top: 0;
  box-shadow: none;
}
#undiscord:not(.verbose) .log-del .attachments video{
  width: 220px;
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid rgba(255,60,75,.22);
  background: #000;
}
#undiscord:not(.verbose) .log-del .attachments audio{
  width: 220px;
  max-width: 100%;
}
#undiscord:not(.verbose) .log-del .attachments .file{
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255,60,75,.22);
  background: rgba(255,40,60,.05);
  color: var(--u-link);
  text-decoration: none;
  max-width: 260px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

/* Scrollbars in red */
#undiscord .scroll::-webkit-scrollbar-thumb,
#undiscord #logArea::-webkit-scrollbar-thumb{ background-color: rgba(255,42,68,.45) !important; }
#undiscord .scroll::-webkit-scrollbar-track,
#undiscord #logArea::-webkit-scrollbar-track{ background-color: rgba(255,40,60,.05) !important; border-color: transparent !important; }

/* Kill counter */
#undiscord .killCount{
  font-family: "JetBrains Mono", Consolas, Menlo, monospace;
  font-size: 13px;
  color: #ff4d5e;
  padding: 3px 10px;
  margin-right: 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,42,68,.4);
  background: rgba(0,0,0,.35);
  text-shadow: 0 0 8px rgba(255,42,68,.7);
  font-variant-numeric: tabular-nums;
}
#undiscord .killCount b{ color: #fff; }
#undiscord .killCount.bump{ animation: ud-bump .25s ease-out; }
@keyframes ud-bump{ 0%{ transform: scale(1.25); box-shadow: 0 0 16px rgba(255,42,68,.9);} 100%{ transform: none; } }

/* Each deleted card gets a quick red "hit" flash when it appears */
#undiscord:not(.verbose) .log-del.fresh{ animation: ud-hit .6s ease-out; }
@keyframes ud-hit{
  0%{ background: rgba(255,42,68,.45); transform: translateX(-6px); }
  100%{ background: rgba(20,3,6,.78); transform: none; }
}
@media (prefers-reduced-motion: reduce){
  #undiscord .killCount.bump, #undiscord:not(.verbose) .log-del.fresh{ animation: none; }
}

/* ===== Reaper extras ===== */
#undiscord .hdrBtn{ width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; margin-right: 10px;
  border-radius: 8px; border: 1px solid rgba(255,42,68,.35); background: rgba(0,0,0,.35); font-size: 15px; cursor: pointer; user-select: none; }
#undiscord .hdrBtn:hover{ background: rgba(255,42,68,.18); }
#undiscord .hdrBtn:focus-visible{ outline: 2px solid #ff2a44; outline-offset: 2px; }
#undiscord .header h3{ text-transform: uppercase; }

#undiscord .presetRow, #undiscord .themeRow{ display: flex; gap: 6px; flex-wrap: wrap; }
#undiscord button.preset{ width: auto !important; min-width: 0 !important; flex: 1 1 0; height: 32px !important; min-height: 32px !important; padding: 0 8px !important; font-size: 13px !important; }
#undiscord button.preset.active{ background: linear-gradient(180deg, #ff2a44, #a50a1e) !important; border-color: rgba(255,120,130,.5) !important; box-shadow: 0 0 10px rgba(255,30,50,.45); }
#undiscord button.swatch{ width: 30px !important; min-width: 30px !important; height: 30px !important; min-height: 30px !important; padding: 0 !important;
  border-radius: 50% !important; background: var(--sw) !important; border: 2px solid rgba(0,0,0,.6) !important; box-shadow: 0 0 8px var(--sw); }
#undiscord button.swatch.active{ border-color: #fff !important; box-shadow: 0 0 0 2px var(--sw), 0 0 14px var(--sw); }

#undiscord .speedo{ flex: 0 0 auto; font: 12px "JetBrains Mono", Consolas, Menlo, monospace; color: rgba(255,190,190,.8); white-space: nowrap;
  padding: 3px 8px; border-radius: 999px; border: 1px solid rgba(255,42,68,.3); background: rgba(0,0,0,.35); font-variant-numeric: tabular-nums; }
#undiscord .speedo b{ color: #ff4d5e; }

/* Skull rain sits behind the log */
#undiscord .main{ position: relative; }
#undiscord .main > .tbar, #undiscord .main > #logArea{ position: relative; z-index: 1; }
#undiscord #skullRain{ position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; opacity: 0; transition: opacity .8s; }
#undiscord.raining #skullRain{ opacity: 1; }

/* ---- SIGNAL LOST (rate-limit cooldown) ---- */
#undiscord #signalLost{ position: absolute; left: 0; right: 0; top: 48px; bottom: 0; z-index: 40; display: none; align-items: center; justify-content: center; pointer-events: none; overflow: hidden; }
#undiscord.signal-lost #signalLost, #undiscord.signal-restored #signalLost{ display: flex; }
#undiscord.signal-lost .window-body{ filter: saturate(.15) contrast(1.15) brightness(.8); transition: filter .2s; }
#undiscord .sl-noise{ position: absolute; inset: -50%; opacity: .16; mix-blend-mode: screen;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  animation: ud-static .25s steps(4) infinite; }
#undiscord.signal-restored .sl-noise{ display: none; }
@keyframes ud-static{ 0%{ transform: translate(0,0);} 25%{ transform: translate(-12%,8%);} 50%{ transform: translate(9%,-11%);} 75%{ transform: translate(-6%,-5%);} 100%{ transform: translate(4%,10%);} }
#undiscord .sl-box{ position: relative; text-align: center; padding: 18px 28px; border-radius: 12px; background: rgba(5,0,1,.78);
  border: 1px solid rgba(255,42,68,.55); box-shadow: 0 0 40px rgba(255,20,40,.35); }
#undiscord .sl-title{ position: relative; font: 900 38px/1 "JetBrains Mono", Consolas, Menlo, monospace; letter-spacing: .12em; color: #fff; }
#undiscord .sl-title::before, #undiscord .sl-title::after{ content: attr(data-text); position: absolute; inset: 0; }
#undiscord .sl-title::before{ color: #ff0033; transform: translateX(-3px); clip-path: inset(10% 0 55% 0); animation: ud-slice1 1.1s steps(2) infinite; }
#undiscord .sl-title::after{ color: #00f0ff; transform: translateX(3px); clip-path: inset(60% 0 8% 0); animation: ud-slice2 .9s steps(2) infinite; }
@keyframes ud-slice1{ 0%{ clip-path: inset(10% 0 55% 0); transform: translateX(-4px);} 50%{ clip-path: inset(45% 0 30% 0); transform: translateX(3px);} 100%{ clip-path: inset(70% 0 5% 0); transform: translateX(-2px);} }
@keyframes ud-slice2{ 0%{ clip-path: inset(60% 0 8% 0); transform: translateX(4px);} 50%{ clip-path: inset(5% 0 75% 0); transform: translateX(-3px);} 100%{ clip-path: inset(35% 0 40% 0); transform: translateX(2px);} }
#undiscord .sl-sub{ margin-top: 10px; font: 12px "JetBrains Mono", Consolas, monospace; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,190,190,.8); }
#undiscord .sl-sub b{ color: #ff4d5e; font-size: 14px; display: inline-block; min-width: 2ch; }
#undiscord.signal-restored .sl-title{ color: #ff4d5e; text-shadow: 0 0 18px rgba(255,42,68,.9); }
#undiscord.signal-restored .sl-title::before, #undiscord.signal-restored .sl-title::after{ display: none; }
#undiscord.signal-restored .sl-sub{ display: none; }
@media (prefers-reduced-motion: reduce){
  #undiscord .sl-noise, #undiscord .sl-title::before, #undiscord .sl-title::after{ animation: none; }
}

/* ---- AWAKENING intro ---- */
#undiscord .ud-intro{ position: absolute; inset: 0; z-index: 60; background: #050001; border-radius: inherit; overflow: hidden; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center; transition: opacity .3s; }
#undiscord .ud-intro.out{ opacity: 0; pointer-events: none; }
#undiscord .ud-crt{ position: absolute; inset: 0; background: radial-gradient(ellipse at center, #ff5566 0%, #ff2a44 30%, rgba(120,0,15,.6) 60%, transparent 80%);
  transform: scale(0, .004); animation: ud-crt .5s cubic-bezier(.6,0,.4,1) forwards; }
@keyframes ud-crt{ 0%{ transform: scale(0,.004); opacity: 1; } 45%{ transform: scale(1,.004); opacity: 1; } 100%{ transform: scale(1,1); opacity: 0; } }
#undiscord .ud-skullbox{ position: relative; width: 98px; height: 98px; }
#undiscord .ud-px{ position: absolute; width: 14px; height: 14px; background: #ffd9dc; opacity: 0; box-shadow: 0 0 6px rgba(255,42,68,.8);
  transition: transform .45s cubic-bezier(.2,1.3,.4,1), opacity .25s; }
#undiscord .ud-skullbox.assemble .ud-px{ transform: none !important; opacity: 1; }
#undiscord .ud-eye{ position: absolute; width: 14px; height: 14px; background: #ff2a44; opacity: 0; transition: opacity .15s;
  box-shadow: 0 0 10px #ff2a44, 0 0 24px #ff2a44, 0 0 48px rgba(255,42,68,.8); }
#undiscord .ud-skullbox.ignite .ud-eye{ opacity: 1; }
#undiscord .ud-brand{ margin-top: 18px; font: 900 22px/1 "JetBrains Mono", Consolas, Menlo, monospace; letter-spacing: .4em; padding-left: .4em; color: #fff;
  text-shadow: 2px 0 rgba(255,0,60,.85), -2px 0 rgba(0,255,255,.25), 0 0 14px rgba(255,42,68,.6); opacity: 0; transition: opacity .3s, letter-spacing .5s; }
#undiscord .ud-intro.ignite .ud-brand{ opacity: 1; letter-spacing: .22em; }
#undiscord .ud-skip{ position: absolute; bottom: 14px; font: 11px "JetBrains Mono", monospace; color: rgba(255,190,190,.45); }

/* ---- Finish screen (uses the #ud-modal shell) ---- */
#ud-modal .ud-big{ text-align: center; padding: 6px 22px 14px; }
#ud-modal .ud-big b{ display: block; font: 900 64px/1 "JetBrains Mono", Consolas, Menlo, monospace; color: #fff; text-shadow: 3px 0 rgba(255,0,60,.85), -3px 0 rgba(0,255,255,.25), 0 0 26px rgba(255,42,68,.7); font-variant-numeric: tabular-nums; }
#ud-modal .ud-big span{ font-size: 12px; letter-spacing: .25em; text-transform: uppercase; color: rgba(255,190,190,.7); }
#ud-modal .ud-grid{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 0 22px; }
#ud-modal .ud-grid .ud-stat{ min-width: 0; }


/* ---- Running skullman on the progress bar ---- */
#undiscord .tbar > .row:first-child{ flex-wrap: wrap; }
#undiscord .runTrack{ position: relative; flex: 1 1 auto; min-width: 0; display: flex; align-items: flex-end; }
#undiscord .runTrack #progressBar{ width: 100%; }
#undiscord.is-running .runTrack{ padding-top: 34px; }
#undiscord .runner{ display: none; position: absolute; bottom: 9px; width: 24px; height: 38px; --p: 0;
  left: calc(var(--p) * (100% - 24px)); transition: left .45s linear;
  filter: drop-shadow(0 0 3px rgba(255,42,68,.9)) drop-shadow(0 0 8px rgba(255,42,68,.4)); }
#undiscord.is-running .runner{ display: block; }
#undiscord .runner svg{ display: block; overflow: visible; }
#undiscord .runner .sk-f{ opacity: 0; animation: ud-skframe .4s steps(1) infinite; }
@keyframes ud-skframe{ 0%{ opacity: 1; } 25%{ opacity: 0; } 100%{ opacity: 0; } }
/* little red dust kicked up behind him */
#undiscord .runner::before{ content: ""; position: absolute; left: -6px; bottom: 0; width: 3px; height: 3px; background: #ff2a44; opacity: 0;
  box-shadow: -5px -2px 0 rgba(255,42,68,.6), -9px 1px 0 rgba(255,42,68,.35); animation: ud-dust .4s steps(2) infinite; }
@keyframes ud-dust{ 0%{ opacity: .9; transform: translate(0,0); } 100%{ opacity: 0; transform: translate(-6px,-3px); } }
#undiscord.signal-lost .runner .sk-f{ animation-play-state: paused; }
#undiscord.signal-lost .runner::before{ display: none; }
#undiscord.signal-lost .runner::after{ content: "?"; position: absolute; top: -16px; left: 16px; font: 900 14px "JetBrains Mono", monospace; color: #ff4d5e; text-shadow: 0 0 6px #ff2a44; }
@media (prefers-reduced-motion: reduce){
  #undiscord .runner .sk-f{ animation: none; }
  #undiscord .runner .sk-f:first-child{ opacity: 1; }
  #undiscord .runner::before{ display: none; }
}
#undiscord.is-running .runTrack{ padding-top: 40px; }

/* ---- Targets ---- */
#undiscord button.targetsBtn{ width: auto !important; min-width: 0 !important; height: 38px !important; min-height: 38px !important; padding: 0 12px !important; margin-right: 6px; white-space: nowrap; }
#undiscord.has-targets button.targetsBtn{ background: linear-gradient(180deg, #5a0a15, #2e080e) !important; border-color: #ff2a44 !important; box-shadow: 0 0 12px rgba(255,30,50,.45); }
#undiscord.has-targets .convBadge, #undiscord.has-targets .channelBadge, #undiscord.has-targets .allChannelsToggle{ display: none !important; }
#undiscord .convBadge{ cursor: pointer; }
#undiscord .convBadge:hover{ border-color: rgba(255,42,68,.6); }

#ud-modal.ud-picker{ width: min(620px, calc(100vw - 32px)); }
#ud-modal .ud-tabs{ display: flex; gap: 6px; padding: 0 22px 10px; }
#ud-modal .ud-tabs button{ flex: 1 1 0; height: 34px; }
#ud-modal .ud-tabs button.on{ background: linear-gradient(180deg, #ff2a44, #a50a1e); border-color: rgba(255,120,130,.5); }
#ud-modal .ud-search{ padding: 0 22px 10px; display: flex; gap: 8px; }
#ud-modal .ud-search input{ flex: 1 1 auto; height: 36px; padding: 0 12px; border-radius: 10px; background: #050001; color: #fff; border: 1px solid rgba(255,60,75,.35); outline: none; font-size: 14px; }
#ud-modal .ud-search input:focus{ border-color: #ff2a44; box-shadow: 0 0 0 3px rgba(255,42,68,.3); }
#ud-modal .ud-search button{ height: 36px; padding: 0 12px; white-space: nowrap; }
#ud-modal .ud-targets{ margin: 0 22px; overflow: auto; height: 46vh; min-height: 160px; border-radius: 10px; background: rgba(0,0,0,.5); border: 1px solid rgba(255,60,75,.2); }
#ud-modal .ud-trow{ display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-bottom: 1px solid rgba(255,60,75,.08); cursor: pointer; }
#ud-modal .ud-trow:hover{ background: rgba(255,42,68,.08); }
#ud-modal .ud-trow.sel{ background: rgba(255,42,68,.16); box-shadow: inset 3px 0 0 #ff2a44; }
#ud-modal .ud-trow input{ accent-color: #ff2a44; width: 16px; height: 16px; flex: 0 0 auto; }
#ud-modal .ud-trow img{ width: 30px; height: 30px; border-radius: 50%; flex: 0 0 auto; box-shadow: 0 0 0 1px rgba(255,60,75,.35); background: #1a0508; }
#ud-modal .ud-trow .nm{ flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; }
#ud-modal .ud-trow .kd{ font: 11px "JetBrains Mono", monospace; color: rgba(255,190,190,.55); flex: 0 0 auto; }
#ud-modal .ud-empty{ padding: 24px; text-align: center; color: rgba(255,190,190,.6); font-size: 13px; }
#ud-modal .ud-count{ margin-right: auto; align-self: center; font: 13px "JetBrains Mono", monospace; color: rgba(255,190,190,.8); }
#ud-modal .ud-count b{ color: #ff4d5e; }
body[data-ud-theme] #ud-modal img{ filter: hue-rotate(calc(-1 * var(--ud-hue))); }

/* ---- Icon glitch: blinks off and back on screen now and then ---- */
#undicord-btn svg, #undiscord .header > svg.icon{ transform-origin: center; }
#undicord-btn.ud-glitch svg, #undiscord .header > svg.icon.ud-glitch{ animation: ud-icon-glitch .7s steps(1) 1; }
@keyframes ud-icon-glitch{
  0%   { transform: none; opacity: 1; clip-path: inset(0 0 0 0); filter: none; }
  8%   { transform: translateX(-3px) skewX(-18deg); clip-path: inset(15% 0 45% 0); filter: drop-shadow(3px 0 #ff0033) drop-shadow(-3px 0 #00f0ff); }
  16%  { transform: translateX(4px); clip-path: inset(55% 0 8% 0); filter: drop-shadow(-3px 0 #ff0033) drop-shadow(3px 0 #00f0ff); }
  24%  { opacity: 0; }
  50%  { opacity: 0; }
  56%  { opacity: 1; transform: translateX(5px) scaleY(.2); clip-path: inset(40% 0 40% 0); filter: drop-shadow(2px 0 #00f0ff); }
  64%  { transform: translateX(-2px) skewX(12deg); clip-path: inset(0 0 60% 0); filter: drop-shadow(-2px 0 #ff0033) drop-shadow(2px 0 #00f0ff); }
  72%  { opacity: .35; transform: none; clip-path: inset(0 0 0 0); }
  80%  { opacity: 1; transform: translateX(1px); filter: drop-shadow(1px 0 #ff0033) drop-shadow(-1px 0 #00f0ff); }
  100% { transform: none; opacity: 1; clip-path: inset(0 0 0 0); filter: none; }
}

/* ---- Finish decay: window corrupts, then reboots ---- */
#undiscord::before{ content: ""; position: absolute; inset: 0; z-index: 45; pointer-events: none; opacity: 0; border-radius: inherit; }
#undiscord.decaying::before{ opacity: 1; mix-blend-mode: screen;
  background:
    repeating-linear-gradient(0deg, transparent 0 7px, rgba(255,0,51,.22) 7px 9px, transparent 9px 23px, rgba(0,240,255,.12) 23px 24px),
    linear-gradient(transparent 0 40%, rgba(255,42,68,.25) 40% 44%, transparent 44% 71%, rgba(255,255,255,.12) 71% 72%, transparent 72%);
  animation: ud-decay-bars .12s steps(3) infinite; }
@keyframes ud-decay-bars{ 0%{ background-position: 0 0, 0 0; } 33%{ background-position: 0 37px, 0 -120px; } 66%{ background-position: 0 -61px, 0 90px; } 100%{ background-position: 0 13px, 0 -40px; } }
#undiscord.decaying .window-body{ animation: ud-decay-body 1.1s steps(1) 1; }
@keyframes ud-decay-body{
  0%  { transform: none; filter: none; }
  6%  { transform: translateX(-6px) skewX(-3deg); filter: saturate(2) hue-rotate(-20deg); }
  12% { transform: translateX(8px); filter: invert(.85) hue-rotate(160deg); }
  18% { transform: translate(-3px, 2px); filter: contrast(2.2) saturate(0); }
  26% { transform: translateX(10px) skewX(6deg); filter: brightness(1.8) saturate(1.5); }
  34% { transform: translateX(-12px); filter: saturate(0) contrast(1.6); opacity: .6; }
  42% { transform: none; filter: invert(1); opacity: 1; }
  50% { transform: translateX(4px) scaleY(.96); filter: saturate(0) brightness(.5); }
  60% { transform: translateX(-5px); filter: hue-rotate(90deg) contrast(1.8); }
  70% { transform: none; filter: brightness(.15); }
  80% { transform: scaleY(.02); filter: brightness(3); }
  88% { transform: scaleY(1); filter: brightness(.1); }
  100%{ transform: none; filter: none; }
}
@media (prefers-reduced-motion: reduce){
  #undicord-btn.ud-glitch svg, #undiscord .header > svg.icon.ud-glitch, #undiscord.decaying .window-body, #undiscord.decaying::before{ animation: none; }
}
/* ---- Digital bug eating deleted messages ---- */
#undiscord:not(.verbose) .log-del .content{ position: relative; }
#undiscord .ud-bug{ position: absolute; left: 0; top: 0; width: 28px; height: 18px; z-index: 3; pointer-events: none;
  filter: drop-shadow(0 0 3px rgba(255,42,68,.9)); transition: transform 45ms linear, opacity .25s; }
#undiscord .ud-bug svg{ display: block; }
#undiscord .ud-bug .bug-b{ display: none; }
#undiscord .ud-bug.chomp .bug-a{ display: none; }
#undiscord .ud-bug.chomp .bug-b{ display: inline; }
#undiscord .ud-bug.leaving{ opacity: 0; transition: transform .26s ease-in, opacity .26s; transform: translateX(40px) !important; }
#undiscord .bug-ch.crumb{ color: #ff2a44; text-shadow: 0 0 4px rgba(255,42,68,.8); }
#undiscord .bug-ch.gone{ opacity: 0; }
#undiscord .ud-crumb{ position: absolute; width: 3px; height: 3px; background: #ff4d5e; box-shadow: 0 0 4px #ff2a44; pointer-events: none; z-index: 2;
  animation: ud-crumb .42s ease-out forwards; }
@keyframes ud-crumb{ from{ transform: translate(0,0); opacity: 1; } to{ transform: translate(var(--dx), var(--dy)); opacity: 0; } }
#undiscord .msgText.remains{ opacity: .5; text-decoration: line-through; text-decoration-color: rgba(255,42,68,.85); text-decoration-thickness: 2px;
  animation: ud-remains .35s ease-out; }
@keyframes ud-remains{ from{ opacity: 0; filter: blur(2px); } to{ opacity: .5; filter: none; } }

/* ===================== Full console re-skin for art packs ===================== */
body[data-ud-art="ink"]{
  --k-bg: #0a0918; --k-panel: #11102a; --k-panel2: #0c0b21; --k-border: rgba(232,182,76,.20); --k-text: #f1ece4; --k-muted: rgba(241,236,228,.58);
  --k-accent: #d1173a; --k-accent2: #e8b64c; --k-btn: #17153a; --k-btnh: #221f4f; --k-card: rgba(12,11,32,.86); --k-input: #07061a;
  --k-radius: 2px; --k-display: "Yu Mincho","Hiragino Mincho ProN","Noto Serif JP","Songti SC",Georgia,"Times New Roman",serif; --k-mono: "Courier New",Courier,monospace;
  --k-glow: rgba(209,23,58,.32);
}
body[data-ud-art="surge"]{
  --k-bg: #120501; --k-panel: #1f0b03; --k-panel2: #170802; --k-border: rgba(255,140,0,.32); --k-text: #fff4e6; --k-muted: rgba(255,220,180,.62);
  --k-accent: #ff6a00; --k-accent2: #ffe14d; --k-btn: #2b1206; --k-btnh: #3f1b09; --k-card: rgba(28,10,3,.88); --k-input: #0d0401;
  --k-radius: 3px; --k-display: Impact,"Haettenschweiler","Arial Narrow Bold","Arial Black",sans-serif; --k-mono: Consolas,"Lucida Console",monospace;
  --k-glow: rgba(255,120,0,.42);
}
body[data-ud-art="cosmic"]{
  --k-bg: #0a0820; --k-panel: #130f36; --k-panel2: #0e0b2a; --k-border: rgba(125,249,255,.22); --k-text: #eefcff; --k-muted: rgba(200,235,255,.62);
  --k-accent: #b44dff; --k-accent2: #7df9ff; --k-btn: #1c1747; --k-btnh: #2a2268; --k-card: rgba(17,14,48,.84); --k-input: #07061a;
  --k-radius: 14px; --k-display: "Trebuchet MS","Avenir Next Rounded","Varela Round",Verdana,sans-serif; --k-mono: "Courier New",Courier,monospace;
  --k-glow: rgba(125,249,255,.30);
}
body[data-ud-art] #undiscord{ background: var(--k-bg) !important; color: var(--k-text) !important; border: 1px solid var(--k-border) !important;
  box-shadow: 0 0 0 1px rgba(0,0,0,.6), 0 0 36px var(--k-glow), 0 16px 60px rgba(0,0,0,.6) !important; }
body[data-ud-art] #undiscord::after{ display: none; }
body[data-ud-art] #undiscord .header{ background: var(--k-panel) !important; border-bottom: 1px solid var(--k-border) !important; box-shadow: none !important; }
body[data-ud-art] #undiscord .header h3{ font-family: var(--k-display) !important; color: var(--k-text) !important; animation: none !important; text-shadow: none; }
body[data-ud-art] #undiscord .header span, body[data-ud-art] #undiscord .header .icon{ color: var(--k-muted) !important; }
body[data-ud-art] #undiscord .header .vert-divider{ background: var(--k-border) !important; }
body[data-ud-art] #undiscord .sidebar{ background: var(--k-panel2) !important; border-right: 1px solid var(--k-border) !important; }
body[data-ud-art] #undiscord .sidebar details{ background: transparent !important; border: 1px solid var(--k-border) !important; border-radius: var(--k-radius) !important; }
body[data-ud-art] #undiscord summary{ background: var(--k-btn) !important; border: 1px solid var(--k-border) !important; border-radius: var(--k-radius) !important; color: var(--k-text) !important; font-family: var(--k-display); }
body[data-ud-art] #undiscord .sidebar details[open] > summary{ box-shadow: inset 3px 0 0 var(--k-accent) !important; border-color: var(--k-border) !important; }
body[data-ud-art] #undiscord legend, body[data-ud-art] #undiscord label, body[data-ud-art] #undiscord .sectionDescription, body[data-ud-art] #undiscord .info{ color: var(--k-muted) !important; }
body[data-ud-art] #undiscord a{ color: var(--k-accent2) !important; }
body[data-ud-art] #undiscord input, body[data-ud-art] #undiscord .input{ background: var(--k-input) !important; color: var(--k-text) !important; border: 1px solid var(--k-border) !important; border-radius: var(--k-radius) !important; }
body[data-ud-art] #undiscord input:focus{ border-color: var(--k-accent) !important; box-shadow: 0 0 0 3px var(--k-glow) !important; }
body[data-ud-art] #undiscord input[type="checkbox"], body[data-ud-art] #undiscord input[type="range"]{ accent-color: var(--k-accent); }
body[data-ud-art] #undiscord button{ background: var(--k-btn) !important; color: var(--k-text) !important; border: 1px solid var(--k-border) !important; border-radius: var(--k-radius) !important; box-shadow: none; }
body[data-ud-art] #undiscord button:hover{ background: var(--k-btnh) !important; }
body[data-ud-art] #undiscord button.danger, body[data-ud-art] #undiscord button.preset.active{
  background: var(--k-accent) linear-gradient(180deg, rgba(255,255,255,.16), rgba(0,0,0,.22)) !important; border-color: transparent !important;
  box-shadow: 0 0 14px var(--k-glow) !important; font-family: var(--k-display); letter-spacing: .06em; }
body[data-ud-art] #undiscord.has-targets button.targetsBtn{ background: var(--k-btnh) !important; border-color: var(--k-accent) !important; box-shadow: 0 0 10px var(--k-glow) !important; }
body[data-ud-art] #undiscord button.packTile.active{ border-color: var(--k-accent2) !important; box-shadow: 0 0 10px var(--k-glow) !important; }
body[data-ud-art] #undiscord .tbar{ background: var(--k-panel) !important; border-color: var(--k-border) !important; }
body[data-ud-art] #undiscord:not(.verbose) .log-del{ background: var(--k-card) !important; border: 1px solid var(--k-border) !important; border-left: 3px solid var(--k-accent) !important; border-radius: var(--k-radius) !important; }
body[data-ud-art] #undiscord:not(.verbose) .log-del .date{ color: var(--k-muted) !important; }
body[data-ud-art] #undiscord:not(.verbose) .log-del .author, body[data-ud-art] #undiscord:not(.verbose) .log-del .content{ color: var(--k-text) !important; }
body[data-ud-art] #undiscord:not(.verbose) .log-del .meta{ color: var(--k-accent2) !important; background: transparent !important; border: 1px solid var(--k-border) !important; font-family: var(--k-mono) !important; border-radius: var(--k-radius) !important; }
body[data-ud-art] #undiscord:not(.verbose) .log-del .lineChannel{ border-color: var(--k-border) !important; background: transparent !important; color: var(--k-muted) !important; }
body[data-ud-art] #undiscord .msgText.remains{ text-decoration-color: var(--k-accent) !important; }
body[data-ud-art] #undiscord progress{ background: rgba(255,255,255,.06) !important; border-color: var(--k-border) !important; }
body[data-ud-art] #undiscord progress::-webkit-progress-bar{ background: rgba(255,255,255,.06) !important; }
body[data-ud-art] #undiscord progress::-webkit-progress-value{ background: linear-gradient(90deg, var(--k-accent), var(--k-accent2)) !important; box-shadow: 0 0 10px var(--k-glow) !important; }
body[data-ud-art] #undiscord progress::-moz-progress-bar{ background: linear-gradient(90deg, var(--k-accent), var(--k-accent2)) !important; }
body[data-ud-art] #undiscord #progressBarPercent{ color: var(--k-accent2) !important; text-shadow: none !important; }
body[data-ud-art] #undiscord .speedo, body[data-ud-art] #undiscord .killCount, body[data-ud-art] #undiscord .hdrBtn,
body[data-ud-art] #undiscord .convBadge, body[data-ud-art] #undiscord .channelBadge, body[data-ud-art] #undiscord .allChannelsToggle{
  border-color: var(--k-border) !important; background: rgba(0,0,0,.28) !important; color: var(--k-muted) !important; text-shadow: none !important; border-radius: var(--k-radius) !important; }
body[data-ud-art] #undiscord .speedo b, body[data-ud-art] #undiscord .killCount, body[data-ud-art] #undiscord .channelHash{ color: var(--k-accent2) !important; }
body[data-ud-art] #undiscord .log-info{ color: var(--k-accent2) !important; }
body[data-ud-art] #undiscord .log-verb{ color: var(--k-muted) !important; }
body[data-ud-art] #undiscord .scroll::-webkit-scrollbar-thumb, body[data-ud-art] #undiscord #logArea::-webkit-scrollbar-thumb{ background-color: var(--k-border) !important; }
body[data-ud-art] #undiscord .sl-box{ border-color: var(--k-accent) !important; box-shadow: 0 0 40px var(--k-glow) !important; border-radius: var(--k-radius) !important; }
body[data-ud-art] #undiscord .ud-crt{ background: radial-gradient(ellipse at center, #fff 0%, var(--k-accent2) 18%, var(--k-accent) 40%, transparent 80%) !important; }
body[data-ud-art] #undiscord .ud-brand{ font-family: var(--k-display) !important; text-shadow: 0 0 14px var(--k-glow) !important; }
/* dialogs + toasts follow the pack */
body[data-ud-art] #ud-modal{ background: radial-gradient(600px 300px at 50% -20%, var(--k-glow), transparent 70%), var(--k-bg) !important; border-color: var(--k-border) !important;
  box-shadow: 0 0 0 1px #000, 0 0 50px var(--k-glow), 0 30px 80px rgba(0,0,0,.7) !important; color: var(--k-text) !important; border-radius: calc(var(--k-radius) + 4px) !important; }
body[data-ud-art] #ud-modal::after{ display: none; }
body[data-ud-art] #ud-modal h2{ font-family: var(--k-display) !important; text-shadow: none !important; color: var(--k-text) !important; }
body[data-ud-art] #ud-modal .ud-sub, body[data-ud-art] #ud-modal .ud-more, body[data-ud-art] #ud-modal .ud-stat span, body[data-ud-art] #ud-modal .ud-big span{ color: var(--k-muted) !important; }
body[data-ud-art] #ud-modal .ud-stat, body[data-ud-art] #ud-modal .ud-list, body[data-ud-art] #ud-modal .ud-targets{ background: rgba(0,0,0,.3) !important; border-color: var(--k-border) !important; border-radius: var(--k-radius) !important; }
body[data-ud-art] #ud-modal .ud-stat b{ color: var(--k-accent2) !important; }
body[data-ud-art] #ud-modal .ud-big b{ font-family: var(--k-display) !important; text-shadow: 0 0 24px var(--k-glow) !important; }
body[data-ud-art] #ud-modal .ud-list i{ color: var(--k-accent2) !important; }
body[data-ud-art] #ud-modal button{ background: var(--k-btn) !important; border-color: var(--k-border) !important; color: var(--k-text) !important; border-radius: var(--k-radius) !important; }
body[data-ud-art] #ud-modal button:hover{ background: var(--k-btnh) !important; }
body[data-ud-art] #ud-modal button.ud-go, body[data-ud-art] #ud-modal .ud-tabs button.on{ background: var(--k-accent) linear-gradient(180deg, rgba(255,255,255,.16), rgba(0,0,0,.22)) !important; border-color: transparent !important; box-shadow: 0 0 16px var(--k-glow) !important; font-family: var(--k-display); }
body[data-ud-art] #ud-modal input{ background: var(--k-input) !important; border-color: var(--k-border) !important; border-radius: var(--k-radius) !important; }
body[data-ud-art] #ud-modal .ud-trow.sel{ background: rgba(255,255,255,.05) !important; box-shadow: inset 3px 0 0 var(--k-accent) !important; }
body[data-ud-art] .ud-toast{ background: var(--k-panel) !important; border-color: var(--k-border) !important; border-left-color: var(--k-accent) !important; color: var(--k-text) !important; box-shadow: 0 0 24px var(--k-glow), 0 10px 30px rgba(0,0,0,.6) !important; border-radius: var(--k-radius) !important; }
body[data-ud-art] .ud-toast b{ color: var(--k-accent2) !important; }
/* per-pack title flavor */
body[data-ud-art="ink"] #undiscord .header h3{ letter-spacing: .32em !important; font-weight: 700 !important; border-bottom: 2px solid var(--k-accent); padding-bottom: 2px; }
body[data-ud-art="surge"] #undiscord .header h3, body[data-ud-art="surge"] #ud-modal h2, body[data-ud-art="surge"] #ud-modal .ud-big b{ font-style: italic; letter-spacing: .06em !important;
  background: linear-gradient(180deg, #fff6c8, #ffe14d 40%, #ff6a00) !important; -webkit-background-clip: text !important; background-clip: text !important; color: transparent !important; }
body[data-ud-art="surge"] #undiscord .header h3{ font-size: 20px !important; }
body[data-ud-art="cosmic"] #undiscord .header h3, body[data-ud-art="cosmic"] #ud-modal h2{ color: var(--k-accent2) !important; text-shadow: 0 0 10px var(--k-glow) !important; letter-spacing: .1em !important; }

/* ===================== Kill animations ===================== */
#undiscord .k-ch{ display: inline-block; white-space: pre; }
#undiscord .k-part{ position: absolute; width: 4px; height: 4px; pointer-events: none; z-index: 4; animation: k-part .5s ease-out forwards; }
@keyframes k-part{ from{ transform: translate(0,0) rotate(0); opacity: 1; } to{ transform: translate(var(--dx), var(--dy)) rotate(200deg); opacity: 0; } }
#undiscord .k-part.petal{ width: 6px; height: 4px; border-radius: 60% 0 60% 0; background: #ffb7c9; box-shadow: 0 0 4px rgba(255,140,170,.7); }
#undiscord .k-part.spark{ width: 3px; height: 3px; background: #fff3a0; box-shadow: 0 0 6px #ffb000, 0 0 2px #fff; }
/* slice */
#undiscord .k-slice{ position: absolute; left: 0; top: 0; right: 0; pointer-events: none; z-index: 3; }
#undiscord .k-half{ position: absolute; left: 0; top: 0; right: 0; white-space: normal; overflow-wrap: anywhere; word-break: break-word; transition: transform .45s cubic-bezier(.2,.8,.3,1), opacity .45s; }
#undiscord .k-top{ clip-path: inset(0 0 52% 0); }
#undiscord .k-bot{ clip-path: inset(48% 0 0 0); }
#undiscord .k-slice.split .k-top{ transform: translate(16px, -7px) rotate(-2.5deg); opacity: 0; }
#undiscord .k-slice.split .k-bot{ transform: translate(-12px, 8px) rotate(2deg); opacity: 0; }
#undiscord .k-slash{ position: absolute; left: -8px; right: -8px; top: 0.62em; height: 2px; background: linear-gradient(90deg, transparent, #fff 15%, #fff 85%, transparent);
  box-shadow: 0 0 6px #fff, 0 0 14px #ff2a44, 0 0 26px rgba(209,23,58,.8); transform: scaleX(0) rotate(-3deg); transform-origin: left center; opacity: 1; }
#undiscord .k-slice.go .k-slash{ animation: k-slash .3s cubic-bezier(.1,.9,.2,1) forwards; }
@keyframes k-slash{ 0%{ transform: scaleX(0) rotate(-3deg); opacity: 1; } 40%{ transform: scaleX(1) rotate(-3deg); opacity: 1; } 100%{ transform: scaleX(1) rotate(-3deg); opacity: 0; } }
/* strike */
#undiscord .k-bolt{ position: absolute; z-index: 4; pointer-events: none; filter: drop-shadow(0 0 3px #fff) drop-shadow(0 0 8px #ffb000) drop-shadow(0 0 16px #ff6a00); animation: k-bolt .26s steps(1) forwards; }
@keyframes k-bolt{ 0%{ opacity: 1; } 20%{ opacity: 0; } 35%{ opacity: 1; } 60%{ opacity: .2; } 75%{ opacity: 1; } 100%{ opacity: 0; } }
#undiscord .log-del.k-struck{ animation: k-flash .35s ease-out; }
@keyframes k-flash{ 0%{ background: rgba(255,240,180,.55); } 100%{ } }
#undiscord .k-ch.charged{ color: #ffe14d; text-shadow: 0 0 6px #ff8a00; animation: k-jitter .06s steps(2) infinite; }
@keyframes k-jitter{ 0%{ transform: translate(0,0); } 50%{ transform: translate(1px,-1px); } }
#undiscord .k-ch.blown{ animation: none; transition: transform .5s cubic-bezier(.15,.8,.3,1), opacity .5s ease-in; opacity: 0; }
/* abduct */
#undiscord .k-ufo{ position: absolute; left: 0; top: 0; width: 30px; height: 24px; z-index: 4; pointer-events: none; transition: transform 70ms linear;
  filter: drop-shadow(0 0 5px rgba(125,249,255,.9)); }
#undiscord .k-ufo svg{ position: relative; display: block; animation: k-ufo-bob .5s ease-in-out infinite alternate; }
@keyframes k-ufo-bob{ from{ translate: 0 0; } to{ translate: 0 -2px; } }
#undiscord .k-beam{ position: absolute; left: 6px; top: 16px; width: 18px; height: 26px; clip-path: polygon(30% 0, 70% 0, 100% 100%, 0 100%);
  background: linear-gradient(180deg, rgba(255,225,77,.75), rgba(255,225,77,.08)); animation: k-beam .12s steps(2) infinite; }
@keyframes k-beam{ 0%{ opacity: .9; } 100%{ opacity: .6; } }
#undiscord .k-ufo.away{ transition: transform .38s cubic-bezier(.5,0,.9,.4), opacity .38s; opacity: 0; transform: translate(260px, -60px) !important; }
#undiscord .k-ch.lifted{ transition: transform .32s cubic-bezier(.4,0,.8,.6), opacity .32s ease-in, color .1s; opacity: 0; color: #ffe14d; text-shadow: 0 0 6px #ffe14d; }
@media (prefers-reduced-motion: reduce){ #undiscord .k-slice, #undiscord .k-bolt, #undiscord .k-ufo{ display: none; } }

/* ===================== Living icons ===================== */
.udic-eyeL{ animation: udic-eyeL 5.3s infinite; }
.udic-eyeR{ animation: udic-eyeR 5.3s infinite; }
@keyframes udic-eyeL{ 0%,40%,44%,86%,100%{ opacity: 1; } 41%,43%{ opacity: .15; } 88%,92%{ opacity: 0; } }
@keyframes udic-eyeR{ 0%,40%,44%,70%,76%,100%{ opacity: 1; } 41%,43%{ opacity: .15; } 72%,74%{ opacity: 0; } }
.udic-gleam{ animation: udic-gleam 3.4s infinite; animation-delay: calc(var(--i, 0) * 45ms); }
@keyframes udic-gleam{ 0%,70%,100%{ fill: #c9d2de; } 76%{ fill: #ffffff; } 82%{ fill: #c9d2de; } }
.udic-moon{ animation: udic-moon 2.8s ease-in-out infinite alternate; }
@keyframes udic-moon{ from{ fill: #c01334; } to{ fill: #ff3558; } }
.udic-bolt{ animation: udic-bolt 1.7s steps(1) infinite; }
@keyframes udic-bolt{ 0%,58%,64%,100%{ fill: #ffe14d; } 60%,62%{ fill: #ffffff; } 80%{ fill: #fff3a0; } 82%{ fill: #ffe14d; } }
.udic-bob{ animation: udic-bob 1.6s ease-in-out infinite alternate; }
@keyframes udic-bob{ from{ transform: translateY(0.4px); } to{ transform: translateY(-0.6px); } }
.udic-light{ animation: udic-light 1.2s steps(1) infinite; animation-delay: calc(var(--i, 0) * 300ms); }
@keyframes udic-light{ 0%,24%{ fill: #ffffff; } 25%,100%{ fill: #ffe14d; } }
.udic-beam{ animation: udic-beam .9s steps(2) infinite; }
@keyframes udic-beam{ 0%{ opacity: .9; } 100%{ opacity: .35; } }
#undicord-btn.ud-twitch svg, #undiscord .header > svg.icon.ud-twitch{ animation: ud-twitch .32s steps(1) 1; }
@keyframes ud-twitch{ 0%{ transform: translate(1px,0); } 25%{ transform: translate(-2px,1px) scale(1.08); } 50%{ transform: translate(2px,-1px) rotate(-6deg); } 75%{ transform: translate(-1px,0) rotate(4deg); } 100%{ transform: none; } }
#undicord-btn:hover svg{ animation: ud-twitch .32s steps(1) 1; }
@media (prefers-reduced-motion: reduce){ .udic-eyeL, .udic-eyeR, .udic-gleam, .udic-moon, .udic-bolt, .udic-bob, .udic-light, .udic-beam, #undicord-btn:hover svg{ animation: none; } }

#undiscord .header > svg.icon, #ud-modal .ud-skull{ --udic-eye: #ffffff; }
#undicord-btn.running{ --udic-eye: #ffffff; }
/* ===================== Mobile mode (phones / narrow windows) ===================== */
#reaper-fab{ position: fixed; z-index: 99; right: 16px; bottom: 96px; width: 56px; height: 56px; border-radius: 18px; display: none;
  align-items: center; justify-content: center; background: #120306; color: #ff2a44; border: 1px solid rgba(255,42,68,.6);
  box-shadow: 0 0 0 1px #000, 0 0 22px rgba(255,20,40,.5), 0 8px 24px rgba(0,0,0,.6); touch-action: none; user-select: none; cursor: pointer; --udic-eye: #ffffff; }
#reaper-fab.show{ display: flex; }
#reaper-fab:active{ transform: scale(.94); }
#reaper-fab svg{ pointer-events: none; }
body[data-ud-art] #reaper-fab{ background: var(--k-panel); border-color: var(--k-border); box-shadow: 0 0 0 1px #000, 0 0 22px var(--k-glow), 0 8px 24px rgba(0,0,0,.6); }
body.reaper-mobile #undiscord{ position: fixed !important; inset: 0 !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; height: 100dvh !important;
  min-width: 0 !important; min-height: 0 !important; max-width: none !important; max-height: none !important; border-radius: 0 !important; border: none !important; }
body.reaper-mobile #undiscord [name^="grab-"], body.reaper-mobile #undiscord .resize-handle{ display: none !important; }
body.reaper-mobile #undiscord .header{ height: auto !important; min-height: 52px; padding: env(safe-area-inset-top, 0) 12px 0 !important; cursor: default; }
body.reaper-mobile #undiscord .header > span, body.reaper-mobile #undiscord .header .vert-divider{ display: none; }
body.reaper-mobile #undiscord .header #hide{ width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; }
body.reaper-mobile #undiscord .window-body{ position: relative; height: calc(100% - 52px - env(safe-area-inset-top, 0px)) !important; }
body.reaper-mobile #undiscord .main{ max-width: 100% !important; }
body.reaper-mobile #undiscord .sidebar{ position: absolute; z-index: 30; left: 0; top: 0; bottom: 0; width: min(86vw, 340px) !important; min-width: 0 !important;
  box-shadow: 10px 0 40px rgba(0,0,0,.7); animation: ud-drawer .22s ease-out; }
@keyframes ud-drawer{ from{ transform: translateX(-100%); } to{ transform: none; } }
body.reaper-mobile #undiscord .tbar > .row:first-child{ padding-right: 0 !important; gap: 6px; min-height: 0; }
body.reaper-mobile #undiscord .tbar button{ height: 44px !important; min-height: 44px !important; margin: 0 !important; }
body.reaper-mobile #undiscord #stop{ position: static !important; }
body.reaper-mobile #undiscord button#start{ order: 10; flex: 1 1 auto; width: auto !important; }
body.reaper-mobile #undiscord button#stop{ order: 11; }
body.reaper-mobile #undiscord button#clear{ order: 12; }
body.reaper-mobile #undiscord .convBadge{ max-width: 52vw; height: 44px; }
body.reaper-mobile #undiscord .allChannelsToggle{ height: 44px; }
body.reaper-mobile #undiscord .tbar .row{ flex-wrap: wrap; }
body.reaper-mobile #undiscord #logArea{ -webkit-overflow-scrolling: touch; }
body.reaper-mobile #undiscord:not(.verbose) .log-del{ grid-template-columns: calc(27px * var(--u-compact-scale)) minmax(0, 1fr) auto !important; }
body.reaper-mobile #undiscord:not(.verbose) .log-del .stamp{ display: none; }
body.reaper-mobile #undiscord.hide-author:not(.verbose) .log-del{ grid-template-columns: minmax(0, 1fr) auto !important; }
body.reaper-mobile #undiscord .tbar.footer{ padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px)) !important; cursor: default; }
body.reaper-mobile #undiscord .sidebar input, body.reaper-mobile #undiscord .sidebar .input{ font-size: 16px !important; height: 44px !important; }
body.reaper-mobile #undiscord .sidebar summary{ padding: 12px 12px !important; }
body.reaper-mobile #ud-overlay{ align-items: flex-end; }
body.reaper-mobile #ud-modal{ width: 100vw !important; max-height: 92dvh; border-radius: 18px 18px 0 0 !important; padding-bottom: env(safe-area-inset-bottom, 0); animation: ud-sheet .25s ease-out; }
@keyframes ud-sheet{ from{ transform: translateY(100%); } to{ transform: none; } }
body.reaper-mobile #ud-modal .ud-grid{ grid-template-columns: repeat(2, 1fr); }
body.reaper-mobile #ud-modal .ud-actions{ flex-wrap: wrap; }
body.reaper-mobile #ud-modal .ud-actions button{ flex: 1 1 0; height: 48px; }
body.reaper-mobile #ud-modal .ud-actions .ud-count{ flex: 1 1 100%; text-align: center; margin: 0 0 4px; }
body.reaper-mobile #ud-modal .ud-trow{ padding: 11px 12px; }
body.reaper-mobile #ud-modal .ud-targets{ height: 50dvh; }
body.reaper-mobile #ud-modal kbd{ display: none; }
body.reaper-mobile #ud-modal .ud-search{ flex-wrap: wrap; }
body.reaper-mobile #ud-modal .ud-search input{ flex: 1 1 100%; font-size: 16px; height: 44px; }
body.reaper-mobile #ud-modal .ud-search button{ flex: 1 1 0; height: 40px; }
body.reaper-mobile .ud-toast{ max-width: calc(100vw - 24px); }
body.reaper-mobile #ud-toasts{ top: calc(12px + env(safe-area-inset-top, 0px)); }

/* ---- Quick controls: header vibration button + floating mini menu ---- */
#undiscord #vibBtn{ display: none; }
body.reaper-app #undiscord #vibBtn{ display: flex; }
#undiscord .hdrBtn.off{ opacity: .55; }
#reaper-fab{ z-index: 103; }
body.reaper-open #reaper-fab{ bottom: 150px; }
#reaper-fabmenu{ position: fixed; z-index: 104; display: none; flex-direction: column; gap: 10px; pointer-events: none; }
#reaper-fabmenu.show{ display: flex; pointer-events: auto; }
#reaper-fabmenu button{ width: 46px; height: 46px; border-radius: 50%; font-size: 20px; line-height: 1; display: flex; align-items: center; justify-content: center;
  background: #120306; color: #fff; border: 1px solid rgba(255,42,68,.55); box-shadow: 0 0 14px rgba(255,20,40,.45), 0 6px 16px rgba(0,0,0,.6);
  animation: ud-pop .18s cubic-bezier(.2,1.5,.4,1) both; cursor: pointer; padding: 0; }
#reaper-fabmenu button:nth-child(2){ animation-delay: .03s; }
#reaper-fabmenu button:nth-child(3){ animation-delay: .06s; }
#reaper-fabmenu button:nth-child(4){ animation-delay: .09s; }
#reaper-fabmenu button.off{ opacity: .6; }
#reaper-fabmenu button.danger{ border-color: #ff2a44; background: #3a0610; }
#reaper-fabmenu button.armed{ background: #ff2a44; animation: ud-armed .4s steps(2) infinite; }
@keyframes ud-pop{ from{ transform: scale(.2) translateY(20px); opacity: 0; } to{ transform: none; opacity: 1; } }
@keyframes ud-armed{ 0%{ box-shadow: 0 0 6px #ff2a44; } 100%{ box-shadow: 0 0 22px #ff2a44; } }
body[data-ud-art] #reaper-fabmenu button{ background: var(--k-panel); border-color: var(--k-border); box-shadow: 0 0 14px var(--k-glow), 0 6px 16px rgba(0,0,0,.6); }
body[data-ud-art] #reaper-fabmenu button.danger{ border-color: var(--k-accent); }
body[data-ud-art] #reaper-fabmenu button.armed{ background: var(--k-accent); }
@media (prefers-reduced-motion: reduce){ #reaper-fabmenu button, #reaper-fabmenu button.armed{ animation: none; } }

/* ---- Updates section ---- */

/* ---- Theme pack picker ---- */
#undiscord .packGrid{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
#undiscord button.packTile{ width: auto !important; min-width: 0 !important; height: 36px !important; min-height: 36px !important; padding: 0 8px !important;
  justify-content: flex-start !important; gap: 8px; font-size: 12px !important; text-transform: none; white-space: nowrap; overflow: hidden; }
#undiscord button.packTile svg{ flex: 0 0 auto; }
#undiscord button.packTile.active{ border-color: #fff !important; box-shadow: 0 0 10px rgba(255,255,255,.25); }
body[data-ud-theme] #undiscord button.packTile svg{ filter: hue-rotate(calc(-1 * var(--ud-hue))); }

/* ---- Pack background layer ---- */
#undiscord #packBg{ position: absolute; inset: 0; z-index: 0; pointer-events: none; display: none; }
body[data-ud-art] #undiscord #packBg{ display: block; }
body[data-ud-art] #undiscord .main{ background: #000 !important; }

/* art packs keep true colors: counter-rotate their art against the UI tint */
body[data-ud-art] #undiscord #packBg,
body[data-ud-art] #undiscord #skullRain,
body[data-ud-art] #undiscord .ud-intro .ud-skullbox,
body[data-ud-art] #undiscord .header > svg.icon,
body[data-ud-art] #ud-modal .ud-skull{ filter: hue-rotate(calc(-1 * var(--ud-hue, 0deg))); }
body[data-ud-art] #undiscord .header > svg.icon{ filter: hue-rotate(calc(-1 * var(--ud-hue, 0deg))) drop-shadow(0 0 5px var(--pack-glow)); }
body[data-ud-art] #undiscord .runner{ filter: hue-rotate(calc(-1 * var(--ud-hue, 0deg))) drop-shadow(0 0 3px var(--pack-glow)); }
body[data-ud-art] #ud-modal .ud-skull{ filter: hue-rotate(calc(-1 * var(--ud-hue, 0deg))) drop-shadow(0 0 10px var(--pack-glow)); }
body[data-ud-art] #undicord-btn{ filter: none; }
body[data-ud-art] #undicord-btn:hover{ filter: drop-shadow(0 0 4px var(--pack-glow)); }
body[data-ud-art] #undicord-btn.running{ filter: drop-shadow(0 0 6px var(--pack-glow)); }
body[data-ud-art] #ud-modal{ background: radial-gradient(600px 300px at 50% -20%, rgba(255,30,50,.35), transparent 70%), #0d0204 !important; }

/* Power Surge: flickering flame aura around the runner */
body[data-ud-art] #undiscord.aura .runner{ animation: ud-aura .18s steps(2) infinite; }
@keyframes ud-aura{
  0%{ filter: hue-rotate(calc(-1 * var(--ud-hue, 0deg))) drop-shadow(0 0 3px #ffe14d) drop-shadow(0 -3px 6px #ff6a00) drop-shadow(0 0 12px rgba(255,106,0,.7)); }
  100%{ filter: hue-rotate(calc(-1 * var(--ud-hue, 0deg))) drop-shadow(0 0 4px #fff3a0) drop-shadow(0 -5px 8px #ff8a00) drop-shadow(0 0 16px rgba(255,140,0,.8)); }
}
@media (prefers-reduced-motion: reduce){ body[data-ud-art] #undiscord.aura .runner{ animation: none; } }

/* ---- Themes: hue-rotate the whole UI, counter-rotate real media ---- */
body[data-ud-theme] #undiscord{ filter: hue-rotate(var(--ud-hue)); }
body[data-ud-theme] #undiscord img, body[data-ud-theme] #undiscord video,
body[data-ud-theme] #undiscord button.swatch, body[data-ud-theme] #undiscord .doneBanner{ filter: hue-rotate(calc(-1 * var(--ud-hue))); }
body[data-ud-theme] #ud-modal, body[data-ud-theme] .ud-toast{ filter: hue-rotate(var(--ud-hue)); }
body[data-ud-theme] #undicord-btn{ filter: hue-rotate(var(--ud-hue)); }
body[data-ud-theme] #undicord-btn:hover{ filter: hue-rotate(var(--ud-hue)) drop-shadow(0 0 4px rgba(255,42,68,.8)); }
body[data-ud-theme] #undicord-btn.running{ filter: hue-rotate(var(--ud-hue)) drop-shadow(0 0 5px rgba(255,42,68,.9)); }
`);

	var dragCss = (`
[name^="grab-"] { position: absolute; --size: 6px; --corner-size: 16px; --offset: -1px; z-index: 9; }
[name^="grab-"]:hover{ background: rgba(255,42,68,0.15); }
[name="grab-t"] { top: 0px; left: var(--corner-size); right: var(--corner-size); height: var(--size); margin-top: var(--offset); cursor: ns-resize; }
[name="grab-r"] { top: var(--corner-size); bottom: var(--corner-size); right: 0px; width: var(--size); margin-right: var(--offset);
  cursor: ew-resize; }
[name="grab-b"] { bottom: 0px; left: var(--corner-size); right: var(--corner-size); height: var(--size); margin-bottom: var(--offset); cursor: ns-resize; }
[name="grab-l"] { top: var(--corner-size); bottom: var(--corner-size); left: 0px; width: var(--size); margin-left: var(--offset); cursor: ew-resize; }
[name="grab-tl"] { top: 0px; left: 0px; width: var(--corner-size); height: var(--corner-size); margin-top: var(--offset); margin-left: var(--offset); cursor: nwse-resize; }
[name="grab-tr"] { top: 0px; right: 0px; width: var(--corner-size); height: var(--corner-size); margin-top: var(--offset); margin-right: var(--offset); cursor: nesw-resize; }
[name="grab-br"] { bottom: 0px; right: 0px; width: var(--corner-size); height: var(--corner-size); margin-bottom: var(--offset); margin-right: var(--offset); cursor: nwse-resize; }
[name="grab-bl"] { bottom: 0px; left: 0px; width: var(--corner-size); height: var(--corner-size); margin-bottom: var(--offset); margin-left: var(--offset); cursor: nesw-resize; }
`);

	var buttonHtml = (`
<div id="undicord-btn" tabindex="0" role="button" aria-label="Delete Messages" title="Delete Messages with Reaper (Ctrl+Shift+X)">
    ${SKULL_SVG_24}
    <progress></progress>
</div>
`);

	var undiscordTemplate = (`
<div id="undiscord" class="browser container hide-sidebar" style="display:none;">

    <div class="header">
        <svg class="icon" aria-hidden="false" width="24" height="24" viewBox="-0.5 -0.5 8 8" shape-rendering="crispEdges"><g fill="currentColor">${SKULL_RECTS}</g></svg>
        <h3>{{BRAND}}</h3>
        <div class="vert-divider"></div>
        <span> Bulk delete messages</span>
        <div class="spacer"></div>
        <div id="killCount" class="killCount" title="Messages deleted this run">☠ <b>0</b></div>
        <div id="muteBtn" class="icon hdrBtn" role="button" tabindex="0" title="Sound on/off" aria-label="Toggle sound">🔊</div>
        <div id="vibBtn" class="icon hdrBtn" role="button" tabindex="0" title="Vibration on/off" aria-label="Toggle vibration">📳</div>
        <div id="hide" class="icon" aria-label="Close" role="button" tabindex="0">
            <svg aria-hidden="false" width="24" height="24" viewBox="0 0 24 24">
                <path fill="currentColor"
                    d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z">
                </path>
            </svg>
        </div>
    </div>
    <div id="signalLost" aria-live="polite">
        <div class="sl-noise"></div>
        <div class="sl-box">
            <div class="sl-title" data-text="SIGNAL LOST">SIGNAL LOST</div>
            <div class="sl-sub">rate limited by discord, reconnecting in <b id="slCount">0</b>s</div>
        </div>
    </div>
    <div class="window-body" style="display: flex; flex-direction: row;">
        <div class="sidebar scroll">
            <details>
                <summary>General</summary>
                <fieldset>
                    <legend>
                        Author ID
                        <a href="{{WIKI}}/authorId" title="Help" target="_blank" rel="noopener noreferrer">help</a>
                    </legend>
                    <div class="multiInput">
                        <div class="input-wrapper">
                            <input class="input" id="authorId" type="text" priv>
                        </div>
                        <button id="getAuthor">me</button>
                    </div>
                </fieldset>
                <hr>
                <fieldset>
                    <legend>
                        Server ID
                        <a href="{{WIKI}}/guildId" title="Help" target="_blank" rel="noopener noreferrer">help</a>
                    </legend>
                    <div class="multiInput">
                        <div class="input-wrapper">
                            <input class="input" id="guildId" type="text" priv>
                        </div>
                        <button id="getGuild">current</button>
                    </div>
                </fieldset>
                <fieldset>
                    <legend>
                        Channel ID
                        <a href="{{WIKI}}/channelId" title="Help" target="_blank" rel="noopener noreferrer">help</a>
                    </legend>
                    <div class="multiInput mb1">
                        <div class="input-wrapper">
                            <input class="input" id="channelId" type="text" priv>
                        </div>
                        <button id="getChannel">current</button>
                    </div>
                    <div class="sectionDescription">
                        <label class="row"><input id="includeNsfw" type="checkbox">This is a NSFW channel</label>
                    </div>
                </fieldset>
            </details>
            <details>
                <summary>Wipe Archive</summary>
                <fieldset>
                    <legend>
                        Import index.json
                        <a href="{{WIKI}}/importJson" title="Help" target="_blank" rel="noopener noreferrer">help</a>
                    </legend>
                    <div class="input-wrapper">
                        <input type="file" id="importJsonInput" accept="application/json,.json" style="width:100%";>
                    </div>
                    <div class="sectionDescription">
                        <br>
                        After requesting your data from discord, you can import it here.<br>
                        Select the "messages/index.json" file from the discord archive.
                    </div>
                </fieldset>
            </details>
            <hr>
            <details>
                <summary>Filter</summary>
                <fieldset>
                    <legend>
                        Search
                        <a href="{{WIKI}}/filters" title="Help" target="_blank" rel="noopener noreferrer">help</a>
                    </legend>
                    <div class="input-wrapper">
                        <input id="search" type="text" placeholder="Containing text" priv>
                    </div>
                    <div class="sectionDescription">
                        Only delete messages that contain the text
                    </div>
                    <div class="sectionDescription">
                        <label><input id="hasLink" type="checkbox">has: link</label>
                    </div>
                    <div class="sectionDescription">
                        <label><input id="hasFile" type="checkbox">has: file</label>
                    </div>
                    <div class="sectionDescription">
                        <label><input id="includePinned" type="checkbox" checked>Include pinned</label>
                    </div>
                </fieldset>
                <hr>
                <fieldset>
                    <legend>
                        Pattern
                        <a href="{{WIKI}}/pattern" title="Help" target="_blank" rel="noopener noreferrer">help</a>
                    </legend>
                    <div class="sectionDescription">
                        Delete messages that match the regular expression
                    </div>
                    <div class="input-wrapper">
                        <span class="info">/</span>
                        <input id="pattern" type="text" placeholder="regular expression" priv>
                        <span class="info">/</span>
                    </div>
                </fieldset>
            </details>
            <details>
                <summary>Messages interval</summary>
                <fieldset>
                    <legend>
                        Interval of messages
                        <a href="{{WIKI}}/messageId" title="Help" target="_blank" rel="noopener noreferrer">help</a>
                    </legend>
                    <div class="multiInput mb1">
                        <div class="input-wrapper">
                            <input id="minId" type="text" placeholder="After a message" priv>
                        </div>
                        <button id="pickMessageAfter">Pick</button>
                    </div>
                    <div class="multiInput">
                        <div class="input-wrapper">
                            <input id="maxId" type="text" placeholder="Before a message" priv>
                        </div>
                        <button id="pickMessageBefore">Pick</button>
                    </div>
                    <div class="sectionDescription">
                        Specify an interval to delete messages.
                    </div>
                </fieldset>
            </details>
            <details>
                <summary>Date interval</summary>
                <fieldset>
                    <legend>
                        After date
                        <a href="{{WIKI}}/dateRange" title="Help" target="_blank" rel="noopener noreferrer">help</a>
                    </legend>
                    <div class="input-wrapper mb1">
                        <input id="minDate" type="datetime-local" title="Messages posted AFTER this date">
                    </div>
                    <legend>
                        Before date
                        <a href="{{WIKI}}/dateRange" title="Help" target="_blank" rel="noopener noreferrer">help</a>
                    </legend>
                    <div class="input-wrapper">
                        <input id="maxDate" type="datetime-local" title="Messages posted BEFORE this date">
                    </div>
                    <div class="sectionDescription">
                        Delete messages that were posted between the two dates.
                    </div>
                    <div class="sectionDescription">
                        * Filtering by date doesn't work if you use the "Messages interval".
                    </div>
                </fieldset>
            </details>
            <hr>
            <details>
                <summary>Advanced settings</summary>
                <fieldset>
                    <legend>Speed preset</legend>
                    <div class="presetRow">
                        <button class="preset" data-preset="safe" title="Slow and steady, fewest rate limits">Safe</button>
                        <button class="preset active" data-preset="normal" title="Default delays">Normal</button>
                        <button class="preset" data-preset="fast" title="Faster, expect more cooldowns">Fast</button>
                    </div>
                </fieldset>
                <fieldset>
                    <legend>
                        Search delay
                        <a href="{{WIKI}}/delay" title="Help" target="_blank" rel="noopener noreferrer">help</a>
                    </legend>
                    <div class="input-wrapper">
                        <input id="searchDelay" type="range" value="30000" step="100" min="100" max="60000">
                        <div id="searchDelayValue"></div>
                    </div>
                </fieldset>
                <fieldset>
                    <legend>
                        Delete delay
                        <a href="{{WIKI}}/delay" title="Help" target="_blank" rel="noopener noreferrer">help</a>
                    </legend>
                    <div class="input-wrapper">
                        <input id="deleteDelay" type="range" value="1000" step="50" min="50" max="10000">
                        <div id="deleteDelayValue"></div>
                    </div>
                    <br>
                    <div class="sectionDescription">
                        This will affect the speed in which the messages are deleted.
                        Use the help link for more information.
                    </div>
                </fieldset>
                <hr>
                <fieldset>
                    <legend>
                        Authorization Token
                        <a href="{{WIKI}}/authToken" title="Help" target="_blank" rel="noopener noreferrer">help</a>
                    </legend>
                    <div class="multiInput">
                        <div class="input-wrapper">
                            <input class="input" id="token" type="text" autocomplete="dont" priv>
                        </div>
                        <button id="getToken">fill</button>
                    </div>
                </fieldset>
            </details>
            <hr>
            <details>
                <summary>Display options</summary>
                <fieldset>
                    <div class="sectionDescription">
                        <label class="row"><input id="redact" type="checkbox"> Streamer mode</label>
                    </div>
                    <div class="sectionDescription">
                        <label class="row"><input id="hideAuthorText" type="checkbox"> Hide Author ID/Text</label>
                    </div>
                    <div class="sectionDescription">
                        <label class="row"><input id="hideMessageText" type="checkbox"> Hide message text</label>
                    </div>
                    <div class="sectionDescription">
                        <label class="row"><input id="verboseMode" type="checkbox"> Verbose console</label>
                    </div>
                    <div class="sectionDescription">
                        <label class="row"><input id="previewMode" type="checkbox"> Preview mode (no delete)</label>
                    </div>
                    <div class="sectionDescription">
                        <label class="row"><input id="fxMode" type="checkbox" checked> Effects (intro, skull rain, text decay)</label>
                    </div>
                    <div class="sectionDescription">
                        <label class="row"><input id="notifyDone" type="checkbox"> Notify me when done</label>
                    </div>
                    <div class="sectionDescription">
                        <label>Theme pack</label>
                        <div class="packGrid" id="packGrid"></div>
                    </div>
                </fieldset>
            </details>
            <hr>
            <div></div>
            <div class="info">
                {{BRAND}} v{{VERSION}} by {{AUTHOR}}
                <br> Based on <a href="{{HOME}}" target="_blank" rel="noopener noreferrer">Undiscord</a> by victornpb (MIT)
                <br> Toggle window: Ctrl+Shift+X
            </div>
        </div>
        <div class="main col">
          <div id="packBg" aria-hidden="true"></div>
          <canvas id="skullRain" aria-hidden="true"></canvas>
          <div class="tbar col">
            <div class="row">
              <button id="toggleSidebar" class="sizeMedium icon">☰</button>
              <button id="targetsBtn" class="targetsBtn" title="Pick several DMs and servers to purge in one run">🎯 Targets</button>
              <button id="leaveServersBtn" class="targetsBtn" title="Pick servers to leave for good. Separate tool, doesn't touch messages.">🚪 Leave</button>
              <div id="convBadge" class="convBadge" style="display:none;">
                  <img id="convAvatar" class="convAvatar" alt="">
                  <span id="convName" class="convName"></span>
              </div>
              <div id="channelBadge" class="channelBadge" style="display:none;">
                  <span class="channelHash">#</span>
                  <span id="channelName" class="channelName"></span>
              </div>
              <label class="allChannelsToggle" style="display:none;">
                <input id="deleteAllChannels" type="checkbox"> Delete from all channels
              </label>
              <button id="start" class="sizeMedium danger" style="width: 150px;" title="Start the deletion process">☠ DELETE</button>
              <button id="stop" class="sizeMedium" title="Stop the deletion process" disabled>🛑 Stop</button>
              <button id="clear" class="sizeMedium">Clear log</button>
            </div>

            <div id="preScanStatus" class="preScanStatus"></div>
            <div class="row progressRow">
              <div class="runTrack"><div id="runner" class="runner" aria-hidden="true"></div><progress id="progressBar" style="display:none;"></progress></div>
              <span id="progressBarPercent" style="display:none;">0%</span>
              <span id="speedo" class="speedo" style="display:none;" title="Messages deleted per minute">⚡ <b>0</b>/min</span>
            </div>

            <div class="doneBanner" id="doneBanner">Done: deletion completed successfully.</div>
          </div>

            <pre id="logArea" class="logarea scroll">
              <div class="log log-static" style="background: rgba(255,42,68,.10); border-left: 3px solid #ff2a44; padding: .5em;">☠ {{BRAND}} v{{VERSION}} ready. Run once in Preview mode before deleting for real.</div>
              <center class="log log-static"><div>Based on <a href="{{HOME}}" target="_blank" rel="noopener noreferrer">Undiscord</a> by victornpb</div></center>
            </pre>

            <div class="tbar footer row">
                <div id="progressPercent"></div>
                <span class="spacer"></span>
                <label>
                    <input id="autoScroll" type="checkbox" checked> Auto scroll
                </label>
                <div class="resize-handle"></div>
            </div>
        </div>
    </div>
</div>

`);

  const log = {
    debug() { return logFn ? logFn('debug', arguments) : console.debug.apply(console, arguments); },
    info() { return logFn ? logFn('info', arguments) : console.info.apply(console, arguments); },
    verb() { return logFn ? logFn('verb', arguments) : console.log.apply(console, arguments); },
    warn() { return logFn ? logFn('warn', arguments) : console.warn.apply(console, arguments); },
    error() { return logFn ? logFn('error', arguments) : console.error.apply(console, arguments); },
    success() { return logFn ? logFn('success', arguments) : console.info.apply(console, arguments); },

    // dedicated delete line for compact mode
    del() { return logFn ? logFn('del', arguments) : console.log.apply(console, arguments); },
  };


	var logFn; // custom console.log function
	const setLogFn = (fn) => logFn = fn;
  const logStore = {
    compact: [],
    verbose: [],
  };

	// Helpers
	const wait = async ms => new Promise(done => setTimeout(done, ms));
	const msToHMS = s => `${s / 3.6e6 | 0}h ${(s % 3.6e6) / 6e4 | 0}m ${(s % 6e4) / 1000 | 0}s`;
  // PATCH: also escape '>'
  const escapeHTML = html => String(html).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#039;' })[m]);
  const redact = str => `<x>${escapeHTML(str)}</x>`;
  const redactAuthor = str => `<x class="priv-author">${escapeHTML(str)}</x>`;
	const queryString = params => params.filter(p => p[1] !== undefined).map(p => p[0] + '=' + encodeURIComponent(p[1])).join('&');
	const ask = async msg => new Promise(resolve => setTimeout(() => resolve(window.confirm(msg)), 10));
	const toSnowflake = (date) => /:/.test(date) ? ((new Date(date).getTime() - 1420070400000) * Math.pow(2, 22)) : date;
	const replaceInterpolations = (str, obj, removeMissing = false) => str.replace(/\{\{([\w_]+)\}\}/g, (m, key) => obj[key] || (removeMissing ? '' : m));


	// ===================== Themed modal + toasts (replaces window.confirm / alert) =====================
	const udModalCss = `
#ud-overlay{ position: fixed; inset: 0; z-index: 100000; display: flex; align-items: center; justify-content: center;
  background: rgba(5,0,1,.72); backdrop-filter: blur(3px); font-family: var(--font-primary, "gg sans", system-ui, sans-serif); }
#ud-overlay *{ box-sizing: border-box; }
#ud-modal{ width: min(560px, calc(100vw - 32px)); max-height: calc(100vh - 48px); display: flex; flex-direction: column;
  color: rgba(255,236,236,.95); border-radius: 14px; overflow: hidden; position: relative;
  background: ${SKULL_TILE} repeat, radial-gradient(600px 300px at 50% -20%, rgba(255,30,50,.35), transparent 70%), #0d0204;
  border: 1px solid rgba(255,42,68,.55);
  box-shadow: 0 0 0 1px #000, 0 0 60px rgba(255,20,40,.45), 0 30px 80px rgba(0,0,0,.7);
  animation: ud-modal-in .22s cubic-bezier(.2,1.4,.4,1); }
#ud-modal::after{ content: ""; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0 1px, transparent 1px 3px); }
@keyframes ud-modal-in{ from{ transform: scale(.92); opacity: 0; } to{ transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce){ #ud-modal{ animation: none; } }
#ud-modal .ud-head{ display: flex; align-items: center; gap: 14px; padding: 20px 22px 12px; }
#ud-modal .ud-skull{ width: 46px; height: 46px; flex: 0 0 auto; color: #ff2a44; filter: drop-shadow(0 0 10px rgba(255,42,68,.9)); }
#ud-modal .ud-skull svg{ width: 100%; height: 100%; }
#ud-modal h2{ margin: 0; font: 800 20px/1.2 "JetBrains Mono", Consolas, Menlo, monospace; letter-spacing: .04em; color: #fff;
  text-shadow: 2px 0 rgba(255,0,60,.8), -2px 0 rgba(0,255,255,.2); }
#ud-modal .ud-sub{ margin: 4px 0 0; font-size: 13px; color: rgba(255,190,190,.75); }
#ud-modal .ud-stats{ display: flex; gap: 8px; padding: 4px 22px 12px; flex-wrap: wrap; }
#ud-modal .ud-stat{ flex: 1 1 0; min-width: 110px; padding: 8px 10px; border-radius: 10px; background: rgba(0,0,0,.4); border: 1px solid rgba(255,60,75,.25); }
#ud-modal .ud-stat b{ display: block; font: 700 18px/1.2 "JetBrains Mono", Consolas, monospace; color: #ff4d5e; font-variant-numeric: tabular-nums; }
#ud-modal .ud-stat span{ font-size: 11px; color: rgba(255,190,190,.65); }
#ud-modal .ud-flag{ margin: 0 22px 10px; padding: 8px 10px; border-radius: 10px; font-size: 13px; background: rgba(255,200,80,.1); border: 1px solid rgba(255,200,80,.35); color: #ffd27a; }
#ud-modal .ud-body{ padding: 0 22px; font-size: 14px; line-height: 1.45; }
#ud-modal .ud-list{ margin: 0 22px; overflow: auto; max-height: 38vh; min-height: 60px; border-radius: 10px; background: rgba(0,0,0,.5); border: 1px solid rgba(255,60,75,.2); }
#ud-modal .ud-list div{ display: flex; gap: 8px; padding: 6px 10px; border-bottom: 1px solid rgba(255,60,75,.08);
  font: 12px/1.35 "JetBrains Mono", Consolas, Menlo, monospace; }
#ud-modal .ud-list div:last-child{ border-bottom: none; }
#ud-modal .ud-list i{ font-style: normal; color: #ff6b78; flex: 0 0 auto; max-width: 35%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#ud-modal .ud-list em{ font-style: normal; color: rgba(255,236,236,.9); overflow-wrap: anywhere; }
#ud-modal .ud-more{ padding: 6px 22px 0; font-size: 12px; color: rgba(255,190,190,.6); }
#ud-modal .ud-type{ padding: 12px 22px 0; font-size: 13px; color: rgba(255,190,190,.8); }
#ud-modal .ud-type input{ display: block; width: 100%; margin-top: 6px; height: 38px; padding: 0 12px; border-radius: 10px;
  background: #050001; color: #fff; border: 1px solid rgba(255,60,75,.35); font: 600 14px "JetBrains Mono", Consolas, monospace; letter-spacing: .12em; outline: none; }
#ud-modal .ud-type input:focus{ border-color: #ff2a44; box-shadow: 0 0 0 3px rgba(255,42,68,.3); }
#ud-modal .ud-actions{ display: flex; justify-content: flex-end; gap: 10px; padding: 16px 22px 20px; }
#ud-modal button{ height: 40px; padding: 0 18px; border-radius: 10px; cursor: pointer; font: 700 14px var(--font-primary, system-ui, sans-serif);
  color: rgba(255,236,236,.95); background: #2e080e; border: 1px solid rgba(255,60,75,.3); }
#ud-modal button:hover{ background: #4d0d17; }
#ud-modal button:focus-visible{ outline: 2px solid #ff2a44; outline-offset: 2px; }
#ud-modal button.ud-go{ background: linear-gradient(180deg, #ff2a44, #a50a1e); border-color: rgba(255,120,130,.5); letter-spacing: .06em;
  box-shadow: 0 0 18px rgba(255,30,50,.55), inset 0 1px 0 rgba(255,255,255,.2); }
#ud-modal button.ud-go:hover{ background: linear-gradient(180deg, #ff4058, #c20d24); box-shadow: 0 0 26px rgba(255,42,68,.8); }
#ud-modal button.ud-go:disabled{ opacity: .4; cursor: not-allowed; box-shadow: none; }
#ud-modal kbd{ font: 11px "JetBrains Mono", monospace; padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(255,60,75,.35); color: rgba(255,190,190,.8); margin-left: 6px; }

#ud-toasts{ position: fixed; z-index: 100001; left: 50%; top: 18px; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
.ud-toast{ pointer-events: auto; max-width: min(480px, calc(100vw - 32px)); padding: 10px 14px 10px 12px; border-radius: 10px; display: flex; gap: 10px; align-items: flex-start;
  font: 14px/1.4 var(--font-primary, "gg sans", system-ui, sans-serif); color: rgba(255,236,236,.95); white-space: pre-line;
  background: #14030a; border: 1px solid rgba(255,42,68,.5); border-left: 4px solid #ff2a44; box-shadow: 0 0 24px rgba(255,20,40,.35), 0 10px 30px rgba(0,0,0,.6);
  animation: ud-toast-in .2s ease-out; }
.ud-toast.warn{ border-left-color: #ffb454; }
.ud-toast b{ color: #ff4d5e; font-family: "JetBrains Mono", monospace; }
@keyframes ud-toast-in{ from{ transform: translateY(-8px); opacity: 0; } to{ transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce){ .ud-toast{ animation: none; } }
`;
	let udModalCssInjected = false;
	function ensureModalCss() {
	  if (udModalCssInjected) return;
	  udModalCssInjected = true;
	  insertCss(udModalCss);
	}

	/** Non-blocking themed replacement for alert() */
	function udToast(message, { type = 'info', ms = 4500 } = {}) {
	  ensureModalCss();
	  let host = document.getElementById('ud-toasts');
	  if (!host) {
	    host = document.createElement('div');
	    host.id = 'ud-toasts';
	    document.body.appendChild(host);
	  }
	  const t = document.createElement('div');
	  t.className = 'ud-toast' + (type === 'warn' ? ' warn' : '');
	  t.setAttribute('role', 'status');
	  t.innerHTML = `<b>☠</b><div>${escapeHTML(message)}</div>`;
	  t.onclick = () => t.remove();
	  host.appendChild(t);
	  setTimeout(() => t.remove(), ms);
	}

	/**
	 * Themed confirm dialog for deletions. Resolves true (delete) or false (cancel).
	 * Big runs require typing DELETE so a stray Enter can't nuke everything.
	 */
	function udConfirmDelete({ total, etrText, previewMode, lines, scopeText }) {
	  ensureModalCss();
	  const TYPE_GUARD_THRESHOLD = 100;
	  const needsTyping = false; // removed: one click / Enter is enough
	  const MAX_SHOWN = 150;
	  const shown = (lines || []).slice(0, MAX_SHOWN);

	  const rows = shown.map((l) => {
	    const str = String(l || '');
	    const idx = str.indexOf(': ');
	    const who = idx > 0 ? str.slice(0, idx) : '';
	    const what = idx > 0 ? str.slice(idx + 2) : str;
	    return `<div>${who ? `<i>${escapeHTML(who)}</i>` : ''}<em>${escapeHTML(what)}</em></div>`;
	  }).join('') || '<div><em>(no preview available)</em></div>';
	  const moreCount = (lines || []).length - shown.length;

	  return new Promise((resolve) => {
	    const overlay = document.createElement('div');
	    overlay.id = 'ud-overlay';
	    overlay.innerHTML = `
<div id="ud-modal" role="dialog" aria-modal="true" aria-labelledby="ud-title">
  <div class="ud-head">
    <div class="ud-skull">${packIconSvg(46)}</div>
    <div>
      <h2 id="ud-title">${previewMode ? 'Dry run' : 'Delete'} ~${escapeHTML(String(total))} messages?</h2>
      <p class="ud-sub">${previewMode ? 'Preview mode is ON: nothing will actually be deleted.' : 'This can\'t be undone. Here\'s what\'s on the chopping block.'}</p>
    </div>
  </div>
  <div class="ud-stats">
    <div class="ud-stat"><b>~${escapeHTML(String(total))}</b><span>messages</span></div>
    <div class="ud-stat"><b>${escapeHTML(etrText)}</b><span>estimated time</span></div>
    <div class="ud-stat"><b>${escapeHTML(scopeText)}</b><span>scope</span></div>
  </div>
  ${previewMode ? '<div class="ud-flag">Preview mode: this is a simulation.</div>' : ''}
  <div class="ud-list">${rows}</div>
  ${moreCount > 0 ? `<div class="ud-more">…and ${moreCount} more not shown.</div>` : ''}
  <div class="ud-more">Filters may skip some, so the real number can be lower.</div>
  ${needsTyping ? '<label class="ud-type">Type <b>DELETE</b> to confirm<input id="ud-type-input" autocomplete="off" spellcheck="false" placeholder="DELETE"></label>' : ''}
  <div class="ud-actions">
    <button id="ud-cancel">Cancel<kbd>Esc</kbd></button>
    <button id="ud-go" class="ud-go" ${needsTyping ? 'disabled' : ''}>☠ ${previewMode ? 'RUN PREVIEW' : 'DELETE'}</button>
  </div>
</div>`;
	    document.body.appendChild(overlay);

	    const goBtn = overlay.querySelector('#ud-go');
	    const cancelBtn = overlay.querySelector('#ud-cancel');
	    const typeInput = overlay.querySelector('#ud-type-input');
	    const prevFocus = document.activeElement;

	    const finish = (val) => {
	      document.removeEventListener('keydown', onKey, true);
	      overlay.remove();
	      try { prevFocus?.focus?.(); } catch {}
	      resolve(val);
	    };
	    // Capture keys so Discord doesn't react to them while the dialog is open.
	    const onKey = (e) => {
	      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); return; }
	      if (e.key === 'Enter' && document.activeElement === typeInput) {
	        e.preventDefault(); e.stopPropagation();
	        if (!goBtn.disabled) finish(true);
	        return;
	      }
	      e.stopPropagation();
	    };
	    document.addEventListener('keydown', onKey, true);

	    if (typeInput) {
	      typeInput.addEventListener('input', () => {
	        goBtn.disabled = typeInput.value.trim().toUpperCase() !== 'DELETE';
	      });
	    }
	    goBtn.onclick = () => finish(true);
	    cancelBtn.onclick = () => finish(false);
	    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) finish(false); });

	    // Safe default focus: the type box for big runs, otherwise Cancel (never the delete button).
	    setTimeout(() => goBtn.focus(), 30); // Enter = go
	  });
	}

	const PREFIX$1 = '[UNDISCORD]';

	/**
	 * Delete all messages in a Discord channel or DM
	 * @author Victornpb <https://www.github.com/victornpb>
	 * @see https://github.com/victornpb/undiscord
	 */
	class UndiscordCore {

	  options = {
	    authToken: null, // Your authorization token
	    authorId: null, // Author of the messages you want to delete
	    guildId: null, // Server were the messages are located
	    channelId: null, // Channel were the messages are located
	    minId: null, // Only delete messages after this, leave blank do delete all
	    maxId: null, // Only delete messages before this, leave blank do delete all
	    content: null, // Filter messages that contains this text content
	    hasLink: null, // Filter messages that contains link
	    hasFile: null, // Filter messages that contains file
	    includeNsfw: null, // Search in NSFW channels
	    includePinned: true, // Delete messages that are pinned
	    pattern: null, // Only delete messages that match the regex (insensitive)
	    searchDelay: null, // Delay each time we fetch for more messages
	    deleteDelay: null, // Delay between each delete operation
      previewMode: false, // Simulate deletions without calling DELETE
	    maxAttempt: 2, // Attempts to delete a single message if it fails
	    askForConfirmation: true,
      retryOnNetworkError: true,
      maxNetworkRetries: 8,
      networkRetryBaseDelay: 1000,
      batchExpectedTotal: 0,
      batchPreviewLines: null,
      batchChannelPlan: null,
	  };

	  state = {
	    running: false,
	    delCount: 0,
	    failCount: 0,
	    grandTotal: 0,
	    offset: 0,
	    iterations: 0,
      endReason: null, // 'DONE' | 'STOPPED' | 'ERROR'
      _emptyPageStreak: 0,
	    _seachResponse: null,
	    _messagesToDelete: [],
	    _skippedMessages: [],
      _skippedIds: new Set(),
      _skippedUniqueCount: 0,
      _avgDeletePerPage: 25,
      _deletePageSamples: 0,
      _rawDiscoveredCount: 0,
      _forcedChannelFilterActive: false,
      _historyScanActive: false,
      _historyBeforeId: null,
      _historyExhausted: false,
      _historyFetchedPages: 0,
      _batchActive: false,
      _batchDelCount: 0,
      _batchFailCount: 0,
      _batchGrandTotal: 0,

	  };

	  stats = {
	    startTime: new Date(), // start time
	    throttledCount: 0, // how many times you have been throttled
	    throttledTotalTime: 0, // the total amount of time you spent being throttled
	    lastPing: null, // the most recent ping
	    avgPing: null, // average ping used to calculate the estimated remaining time
	    etr: 0,
      pendingWaitUntilTs: 0,
      _etrLastUpdateTs: 0,
	  };

	  // events
	  onStart = undefined;
	  onProgress = undefined;
	  onStop = undefined;
    _channelMetaCache = new Map();
    _guildChannelMapCache = new Map();
    _activeRequestController = null;
    _pendingWait = null;

	  resetState() {
	    this.state = {
	      running: false,
	      delCount: 0,
	      failCount: 0,
	      grandTotal: 0,
	      offset: 0,
	      iterations: 0,
        endReason: null,
        _emptyPageStreak: 0,

	      _seachResponse: null,
	      _messagesToDelete: [],
	      _skippedMessages: [],
        _skippedIds: new Set(),
        _skippedUniqueCount: 0,
        _avgDeletePerPage: 25,
        _deletePageSamples: 0,
        _rawDiscoveredCount: 0,
        _forcedChannelFilterActive: false,
        _historyScanActive: false,
        _historyBeforeId: null,
        _historyExhausted: false,
        _historyFetchedPages: 0,
        _batchActive: false,
        _batchDelCount: 0,
        _batchFailCount: 0,
        _batchGrandTotal: 0,
	    };

	    this.options.askForConfirmation = true;
      this._channelMetaCache = new Map();
      this._guildChannelMapCache = new Map();
      this._activeRequestController = null;
      this._pendingWait = null;
	  }

    cancelInFlightRequest() {
      try {
        this._activeRequestController?.abort();
      } catch {}
      this._activeRequestController = null;
    }

    beginAbortableRequest() {
      this.cancelInFlightRequest();
      const controller = new AbortController();
      this._activeRequestController = controller;
      return controller;
    }

    endAbortableRequest(controller) {
      if (this._activeRequestController === controller) {
        this._activeRequestController = null;
      }
    }

    cancelPendingWait() {
      if (!this._pendingWait) return;
      const { timer, resolve } = this._pendingWait;
      this._pendingWait = null;
      try {
        clearTimeout(timer);
      } catch {}
      this.stats.pendingWaitUntilTs = 0;
      try {
        resolve();
      } catch {}
    }

    messageMatchesLocalHistoryFilters(message) {
      if (!message) return false;
      if (this.options.authorId && String(message?.author?.id || '') !== String(this.options.authorId)) return false;

      if (this.options.minId) {
        const minSnow = String(toSnowflake(this.options.minId));
        if (BigInt(message.id) <= BigInt(minSnow)) return false;
      }
      if (this.options.maxId) {
        const maxSnow = String(toSnowflake(this.options.maxId));
        if (BigInt(message.id) >= BigInt(maxSnow)) return false;
      }

      const content = String(message.content || '');
      if (this.options.content && !content.toLowerCase().includes(String(this.options.content).toLowerCase())) return false;

      if (this.options.hasFile && !(Array.isArray(message.attachments) && message.attachments.length > 0)) return false;
      if (this.options.hasLink) {
        const hasLink = /(https?:\/\/[^\s]+)/i.test(content);
        if (!hasLink) return false;
      }
      return true;
    }

    async searchByHistoryScan() {
      const channelId = String(this.options.channelId || '').trim();
      if (!channelId) {
        this.state._seachResponse = {
          messages: [],
          total_results: 0,
          doing_deep_historical_index: false,
        };
        return this.state._seachResponse;
      }

      const params = [['limit', '100']];
      if (this.state._historyBeforeId) params.push(['before', this.state._historyBeforeId]);
      const url = `https://discord.com/api/v10/channels/${channelId}/messages?${queryString(params)}`;

      let resp;
      let networkAttempt = 0;
      while (true) {
        try {
          const reqCtl = this.beginAbortableRequest();
          this.beforeRequest();
          resp = await fetch(url, {
            headers: {
              Authorization: this.options.authToken,
            },
            signal: reqCtl.signal,
          });
          this.endAbortableRequest(reqCtl);
          this.afterRequest();
          break;
        } catch (err) {
          if (err?.name === 'AbortError' && !this.state.running) throw err;
          const msg = String(err && (err.message || err));

          if (!this.state.running) {
            log.error('History scan aborted (not running).', err);
            throw err;
          }

          if (!this.options.retryOnNetworkError) {
            this.state.endReason = 'ERROR';
            this.state.running = false;
            log.error('History scan request threw an error:', err);
            throw err;
          }

          networkAttempt++;
          const max = this.options.maxNetworkRetries ?? 8;
          if (networkAttempt > max) {
            this.state.endReason = 'ERROR';
            this.state.running = false;
            log.error(`History scan failed after ${max} network retries.`, err);
            throw err;
          }

          const base = this.options.networkRetryBaseDelay ?? 1000;
          const delay = Math.min(30000, base * Math.pow(1.6, networkAttempt - 1)) + Math.floor(Math.random() * 250);
          log.warn(`NetworkError on history scan (attempt ${networkAttempt}/${max}). Retrying in ${Math.round(delay)}ms...`, msg);
          await this.waitWithTracking(delay);
        }
      }

      if (!resp.ok) {
        if (resp.status === 429) {
          let w = (await resp.json()).retry_after * 1000;
          w = w || this.options.searchDelay;
          this.stats.throttledCount++;
          this.stats.throttledTotalTime += w;
          log.warn(`History scan rate-limited for ${w}ms. Retrying...`);
          if (this.onThrottle) this.onThrottle(w, 'history');
          await this.waitWithTracking(w);
          return await this.searchByHistoryScan();
        }
        this.state.running = false;
        log.error(`History scan failed with status ${resp.status}`, await resp.text());
        throw resp;
      }

      const batch = await resp.json();
      const list = Array.isArray(batch) ? batch : [];
      this.state._historyFetchedPages = (this.state._historyFetchedPages || 0) + 1;
      if (list.length > 0) {
        this.state._historyBeforeId = String(list[list.length - 1].id);
      } else {
        this.state._historyExhausted = true;
      }

      const matched = list.filter((m) => this.messageMatchesLocalHistoryFilters(m));
      const groups = matched.map((m) => [{ ...m, hit: true }]);

      // Keep displayed totals exact; do not add a synthetic +1 "sentinel".
      const pseudoTotal = this.state.grandTotal + matched.length;
      const data = {
        analytics_id: 'history_scan',
        messages: groups,
        doing_deep_historical_index: false,
        total_results: pseudoTotal,
        __undiscord_history_scan: true,
      };
      this.state._seachResponse = data;
      log.verb(
        `history:scan fetched=${list.length} matched=${matched.length}`,
        `before=${this.state._historyBeforeId || '<none>'}`,
        `exhausted=${this.state._historyExhausted ? 'yes' : 'no'}`
      );
      return data;
    }

    async getGuildChannelMap(guildId) {
      const gid = String(guildId || '').trim();
      if (!gid || gid === '@me') return null;
      if (this._guildChannelMapCache.has(gid)) return this._guildChannelMapCache.get(gid);

      let map = null;
      if (!this.options.authToken) {
        this._guildChannelMapCache.set(gid, map);
        return map;
      }

      try {
        const resp = await fetch(`https://discord.com/api/v10/guilds/${gid}/channels`, {
          headers: { Authorization: this.options.authToken }
        });
        if (!resp.ok) {
          this._guildChannelMapCache.set(gid, map);
          return map;
        }
        const channels = await resp.json();
        if (!Array.isArray(channels)) {
          this._guildChannelMapCache.set(gid, map);
          return map;
        }

        map = new Map();
        for (const ch of channels) {
          if (!ch?.id) continue;
          map.set(String(ch.id), {
            id: String(ch.id),
            parent_id: ch.parent_id ? String(ch.parent_id) : '',
            type: Number(ch.type),
            guild_id: ch.guild_id ? String(ch.guild_id) : gid,
            name: String(ch.name || ''),
          });
        }
        this._guildChannelMapCache.set(gid, map);
        return map;
      } catch {
        this._guildChannelMapCache.set(gid, map);
        return map;
      }
    }

    async getChannelMeta(channelId) {
      const id = String(channelId || '').trim();
      if (!id) return null;
      if (this._channelMetaCache.has(id)) return this._channelMetaCache.get(id);

      const empty = null;
      if (!this.options.authToken) {
        this._channelMetaCache.set(id, empty);
        return empty;
      }

      try {
        const resp = await fetch(`https://discord.com/api/v10/channels/${id}`, {
          headers: { Authorization: this.options.authToken }
        });
        if (!resp.ok) {
          this._channelMetaCache.set(id, empty);
          return empty;
        }
        const data = await resp.json();
        const meta = data && data.id ? {
          id: String(data.id),
          parent_id: data.parent_id ? String(data.parent_id) : '',
          type: Number(data.type),
          guild_id: data.guild_id ? String(data.guild_id) : '',
          name: String(data.name || ''),
        } : empty;
        this._channelMetaCache.set(id, meta);
        return meta;
      } catch {
        this._channelMetaCache.set(id, empty);
        return empty;
      }
    }

    async channelInScope(channelId, targetChannelId) {
      const cid = String(channelId || '').trim();
      const target = String(targetChannelId || '').trim();
      if (!cid || !target) return false;
      if (cid === target) return true;

      const guildMap = await this.getGuildChannelMap(this.options.guildId);
      if (guildMap instanceof Map && guildMap.size) {
        let current = cid;
        const seen = new Set();
        for (let depth = 0; depth < 10; depth++) {
          if (!current || seen.has(current)) break;
          seen.add(current);
          const meta = guildMap.get(current);
          const parent = String(meta?.parent_id || '').trim();
          if (!parent) break;
          if (parent === target) return true;
          current = parent;
        }
      }

      // Walk parent chain to support:
      // - forum/media parent channel -> thread messages
      // - category parent -> child text channels/threads
      let current = cid;
      const seen = new Set();
      for (let depth = 0; depth < 6; depth++) {
        if (!current || seen.has(current)) break;
        seen.add(current);
        const meta = await this.getChannelMeta(current);
        const parent = String(meta?.parent_id || '').trim();
        if (!parent) break;
        if (parent === target) return true;
        current = parent;
      }
      return false;
    }

    async waitWithTracking(ms) {
      const waitMs = Math.max(0, Number(ms) || 0);
      if (waitMs <= 0) return;
      if (!this.state.running) return;
      this.stats.pendingWaitUntilTs = Date.now() + waitMs;
      try {
        await new Promise((resolve) => {
          const timer = setTimeout(() => {
            if (this._pendingWait?.timer === timer) this._pendingWait = null;
            resolve();
          }, waitMs);
          this._pendingWait = { timer, resolve };
        });
      } finally {
        this.stats.pendingWaitUntilTs = 0;
      }
    }

    /** Re-check immediately after deletion to detect completion without waiting searchDelay */
    async quickCheckIfDone() {
      const oldOffset = this.state.offset;

      try {
        // Important: always re-check from the beginning
        this.state.offset = 0;

        await this.search();
        await this.filterResponse();

        const total = this.state._seachResponse?.total_results ?? 0;
        const hasMore = (this.state._messagesToDelete.length > 0) || (this.state._skippedMessages.length > 0);
        const processed = this.state.delCount + this.state.failCount + (this.state._skippedUniqueCount || 0);
        const target = this.state.grandTotal || 0;

        // Quick-check can return an empty page while index is still lagging.
        // Never end early if we still know there should be items to process.
        if (total === 0 || !hasMore) {
          if (target > 0 && processed < target) {
            log.warn(`Quick check looked empty but only processed ${processed}/${target}. Continuing normal loop.`);
            return false;
          }
          log.verb('Quick check: no more messages returned. Ending now.');
          this.state.endReason = 'DONE';
          this.state.running = false;
          return true;
        }

        // Not done, keep going
        return false;
      } catch (e) {
        // Restore offset and continue normally if quick check fails
        this.state.offset = oldOffset;
        log.warn('Quick check failed, continuing normally...', e);
        return false;
      } finally {
        // Restore offset to avoid side effects on the normal loop
        this.state.offset = oldOffset;
      }
    }


	  /** Automate the deletion process of multiple channels */
	  async runBatch(queue) {
	    if (this.state.running) return log.error('Already running!');

	    log.info(`Runnning batch with queue of ${queue.length} jobs`);
      this.state.running = true;
      this.state._batchActive = true;
      this.state._batchDelCount = 0;
      this.state._batchFailCount = 0;
      this.state._batchGrandTotal = Math.max(0, Number(this.options.batchExpectedTotal || 0));
      this.state.grandTotal = this.state._batchGrandTotal;
      this.state.delCount = 0;
      this.state.failCount = 0;
      this.state._skippedUniqueCount = 0;
      this.stats.startTime = new Date();
      this.stats.etr = 0;
      this.stats.pendingWaitUntilTs = 0;
      this.stats._etrLastUpdateTs = Date.now();
      if (this.onStart) this.onStart(this.state, this.stats);
	    for (let i = 0; i < queue.length; i++) {
	      const job = queue[i];
        const ch = String(job?.channelId || '');
        const plan = this.options.batchChannelPlan && ch ? this.options.batchChannelPlan[ch] : null;
        const expectedForChannel = Math.max(0, Number(plan?.count || 0));
        // Use per-channel expected total for channel-local loop guards
        // (prevents long "processed x/y" waits using global batch total).
        // If no plan is available, reset to 0 so this job starts clean.
        this.state.grandTotal = expectedForChannel;
	      log.info(
          'Starting job...',
          `(${i + 1}/${queue.length})`,
          `channel=${ch || '<none>'}`,
          plan ? `expected=${expectedForChannel} type=${plan.type ?? 'unknown'} source=${plan.source || 'unknown'}` : 'expected=<unknown>'
        );

	      // set options
	      this.options = {
	        ...this.options, // keep current options
	        ...job, // override with options for that job
	      };

        try {
	        await this.run(true);
        } catch (err) {
          // Keep batch going even if one channel fails.
          log.error(`Job failed for channel ${ch || '<none>'}. Continuing with next channel...`, err);
          this.state.endReason = this.state.endReason === 'STOPPED' ? 'STOPPED' : 'ERROR';
        }
	      if (!this.state.running) break;
        const effective = Math.max(0, this.state.grandTotal - (this.state._skippedUniqueCount || 0));
        log.info(
          `Job summary (${i + 1}/${queue.length}):`,
          `channel=${ch || '<none>'}`,
          `deleted=${this.state.delCount}`,
          `failed=${this.state.failCount}`,
          `total=${effective}`
        );

	      log.info('Job ended.', `(${i + 1}/${queue.length})`);
        const batchSnapshot = {
          active: this.state._batchActive,
          delCount: this.state._batchDelCount,
          failCount: this.state._batchFailCount,
          grandTotal: this.state._batchGrandTotal,
        };
	      this.resetState();
        this.state._batchActive = batchSnapshot.active;
        this.state._batchDelCount = batchSnapshot.delCount;
        this.state._batchFailCount = batchSnapshot.failCount;
        this.state._batchGrandTotal = batchSnapshot.grandTotal;
	      this.options.askForConfirmation = false;
	      this.state.running = true; // continue running
	    }

      const batchTotal = Math.max(
        this.state._batchGrandTotal,
        this.state._batchDelCount + this.state._batchFailCount
      );
	    log.info(
        'Batch finished.',
        `deleted=${this.state._batchDelCount}`,
        `failed=${this.state._batchFailCount}`,
        `total=${batchTotal}`
      );
      this.state.delCount = this.state._batchDelCount;
      this.state.failCount = this.state._batchFailCount;
      this.state.grandTotal = batchTotal;
      this.state._skippedUniqueCount = 0;
      this.state.endReason = this.state.endReason || 'DONE';
      this.state._batchActive = false;
	    this.state.running = false;
      this.stats.endTime = new Date();
      if (this.onStop) this.onStop(this.state, this.stats);
	  }

	  /** Start the deletion process */
	  async run(isJob = false) {
	    if (this.state.running && !isJob) return log.error('Already running!');

	    this.state.running = true;
      if (!isJob) {
	      this.stats.startTime = new Date();
        this.stats.etr = 0;
        this.stats.pendingWaitUntilTs = 0;
        this.stats._etrLastUpdateTs = Date.now();
      }

	    log.success(`Started at ${this.stats.startTime.toLocaleString()}`);
      log.debug(
        `authorId = "${this.options.authorId || ''}"`,
        `guildId = "${this.options.guildId || ''}"`,
        `channelId = "${this.options.channelId || ''}"`,
	      `minId = "${this.options.minId || ''}"`,
	      `maxId = "${this.options.maxId || ''}"`,
	    );

	    if (!isJob && this.onStart) this.onStart(this.state, this.stats);
      let skipWaitOnce = false;
	    do {
	      this.state.iterations++;

	      log.verb('Fetching messages...');
	      // Search messages
	      await this.search();

	      // Process results and find which messages should be deleted
	      await this.filterResponse();
        if (this.state._messagesToDelete.length > 0 || this.state._skippedMessages.length > 0) {
          this.state._emptyPageStreak = 0;
        }

	      log.verb(
	        `Grand total: ${this.state.grandTotal}`,
	        `(Messages in current page: ${this.state._seachResponse.messages.length}`,
	        `To be deleted: ${this.state._messagesToDelete.length}`,
	        `Skipped: ${this.state._skippedMessages.length})`,
	        `offset: ${this.state.offset}`
	      );
	      this.printStats();

	      // Calculate estimated time
	      this.calcEtr();
	      log.verb(`Estimated time remaining: ${msToHMS(this.stats.etr)}`);

	      // if there are messages to delete, delete them
	      if (this.state._messagesToDelete.length > 0) {

	        if (await this.confirm() === false) {
	          this.state.running = false; // break out of a job
	          break; // immmediately stop this iteration
	        }

	        await this.deleteMessagesFromList();

          // After real deletions, perform an immediate re-check to finish without
          // waiting for the next full search cycle/searchDelay.
          if (!this.options.previewMode) {
            const doneNow = await this.quickCheckIfDone();
            if (doneNow) {
              // FIX: quickCheckIfDone() clears state.running; inside a batch that would
              // abort the remaining jobs, so keep the batch alive when this job is simply done.
              if (isJob) { if (this.state.endReason === 'DONE') this.state.running = true; break; }
              this.state.running = false;
              break;
            }
          }

          if (this.options.previewMode) {
            // In preview mode nothing is removed server-side, so we must move offset forward.
            this.state.offset += this.state._messagesToDelete.length + this.state._skippedMessages.length;
          }
          // Discord search index can lag; wait searchDelay so next search isn't empty/stale.
          skipWaitOnce = false;
	      }
	      else if (this.state._skippedMessages.length > 0) {
	        // There are stuff, but nothing to delete (example a page full of system messages)
	        // check next page until we see a page with nothing in it (end of results).
	        const oldOffset = this.state.offset;
	        this.state.offset += this.state._skippedMessages.length;
	        log.verb('There\'s nothing we can delete on this page, checking next page...');
	        log.verb(`Skipped ${this.state._skippedMessages.length} out of ${this.state._seachResponse.messages.length} in this page.`, `(Offset was ${oldOffset}, ajusted to ${this.state.offset})`);
	        skipWaitOnce = true;
          continue;
        }
        else {
          // In guild fallback mode (without channel_id), this page may contain only
          // results from other channels. Advance offset to keep scanning.
          const rawCount = Number(this.state._rawDiscoveredCount || 0);
          const pageCount = Number(this.state._seachResponse?.messages?.length || 0);
          if (this.state._historyScanActive && this.state._historyExhausted && rawCount === 0 && pageCount === 0) {
            const processed = this.state.delCount + this.state.failCount + (this.state._skippedUniqueCount || 0);
            const target = this.state.grandTotal || 0;
            if (target > processed) {
              log.warn(
                `History scan exhausted for this channel (${processed}/${target} processed).`,
                'Ending this job now to avoid repeated empty-page waits.'
              );
            } else {
              log.verb('History scan exhausted for this channel. Ending this job.');
            }
            this.state.endReason = 'DONE';
            if (isJob) break;
            this.state.running = false;
            continue;
          }

          if (this.state._forcedChannelFilterActive && rawCount > 0 && pageCount > 0) {
            const oldOffset = this.state.offset;
            this.state.offset += pageCount;
            log.verb(`No hits for target channel in this guild page; scanning next page... (offset ${oldOffset} -> ${this.state.offset})`);
            skipWaitOnce = true;
            continue;
          }

          // Discord search may temporarily return an empty page right after deletions (index lag).
          const processed = this.state.delCount + this.state.failCount + (this.state._skippedUniqueCount || 0);
          const target = this.state.grandTotal || 0;
          this.state._emptyPageStreak = (this.state._emptyPageStreak || 0) + 1;

          if (target > 0 && processed < target && this.state._emptyPageStreak <= 5) {
            const waitMs = Math.max(250, Number(this.options.searchDelay) || 0);
            log.warn(`Search returned an empty page but only processed ${processed}/${target}. Waiting ${Math.round(waitMs)}ms and retrying...`);
            await this.waitWithTracking(waitMs);
            continue;
          }

          log.verb('Ended because API returned an empty page.');
          log.verb('[End state]', this.state);
          this.state.endReason = 'DONE';
          if (isJob) break;
          this.state.running = false;
        }


	      // wait before next page (fix search page not updating fast enough)
        if (this.state.running) {
          if (skipWaitOnce) {
            skipWaitOnce = false;
            log.verb('Skipping wait (page had only skipped / non-deletable messages).');
          } else {
            log.verb(`Waiting ${(this.options.searchDelay / 1000).toFixed(2)}s before next page...`);
            await this.waitWithTracking(this.options.searchDelay);
          }
        }

	    } while (this.state.running);

	    this.stats.endTime = new Date();
	    log.success(`Ended at ${this.stats.endTime.toLocaleString()}! Total time: ${msToHMS(this.stats.endTime.getTime() - this.stats.startTime.getTime())}`);
	    this.printStats();
	    log.debug(`Deleted ${this.state.delCount} messages, ${this.state.failCount} failed.\n`);

	    if (!isJob && this.onStop) this.onStop(this.state, this.stats);
	  }

    stop() {
      this.state.endReason = 'STOPPED';
      this.state.running = false;
      this.cancelPendingWait();
      this.cancelInFlightRequest();
      if (!this.state._batchActive && this.onStop) this.onStop(this.state, this.stats);
    }


	  /** Calculate the estimated time remaining based on the current stats */
	  calcEtr() {
      const now = Date.now();
      const dtMs = Math.max(16, now - (this.stats._etrLastUpdateTs || now));
      this.stats._etrLastUpdateTs = now;

      const usingBatch = !!this.state._batchActive;
      const processed = usingBatch
        ? (this.state._batchDelCount + this.state._batchFailCount)
        : (this.state.delCount + this.state.failCount);
      const effectiveTotal = usingBatch
        ? Math.max(0, this.state._batchGrandTotal)
        : Math.max(0, this.state.grandTotal - (this.state._skippedUniqueCount || 0));
      const remainingMessages = Math.max(0, effectiveTotal - processed);

      const deleteDelay = Math.max(0, Number(this.options.deleteDelay) || 0);
      const searchDelay = Math.max(0, Number(this.options.searchDelay) || 0);
      const avgPing = Math.max(0, Number(this.stats.avgPing) || 0);
      const elapsedMs = Math.max(0, Date.now() - this.stats.startTime.getTime());
      const pendingWaitMs = Math.max(0, Number(this.stats.pendingWaitUntilTs || 0) - Date.now());

      // Model-based ETA: account for algorithm-imposed waits.
      const deletePhaseMs = remainingMessages * (deleteDelay + avgPing);
      const avgDeletePerPage = Math.max(1, Math.min(25, Number(this.state._avgDeletePerPage) || 25));
      const remainingSearchPages = remainingMessages > 0 ? Math.ceil(remainingMessages / avgDeletePerPage) : 0;
      const searchPhaseMs = remainingSearchPages * searchDelay;
      const throttledRatio = elapsedMs > 0
        ? Math.max(0, Math.min(0.8, this.stats.throttledTotalTime / elapsedMs))
        : 0;
      const modeledMs = (deletePhaseMs + searchPhaseMs) * (1 + throttledRatio);

      // Observed ETA: uses real throughput so pauses/rate-limits are naturally reflected.
      let observedMs = modeledMs;
      if (processed > 0 && elapsedMs > 0) {
        const observedMsPerMsg = elapsedMs / processed;
        observedMs = observedMsPerMsg * remainingMessages;
      }

      // Hybrid ETA:
      // - early run: trust model (not enough data)
      // - later run: trust observed throughput more
      const confidenceObserved = Math.max(0, Math.min(1, processed / 50));
      const hybridMs = (modeledMs * (1 - confidenceObserved)) + (observedMs * confidenceObserved);

      // Inertial ETA:
      // 1) target floor by known pending wait
      // 2) cap how fast ETA can move (up/down) per second
      // 3) EWMA smoothing with ~3s time constant
      let targetMs = Math.max(0, Math.max(pendingWaitMs, hybridMs));
      const currentMs = Math.max(0, Number(this.stats.etr) || 0);

      if (currentMs > 0) {
        const dtSec = dtMs / 1000;
        const maxRise = Math.max(1200 * dtSec, currentMs * 0.30 * dtSec); // +30%/s max
        const maxDrop = Math.max(900 * dtSec, currentMs * 0.18 * dtSec);  // -18%/s max
        if (targetMs > currentMs) {
          targetMs = Math.min(targetMs, currentMs + maxRise);
        } else {
          targetMs = Math.max(targetMs, currentMs - maxDrop);
        }
      }

      if (currentMs > 0) {
        const alpha = 1 - Math.exp(-(dtMs / 3000)); // more inertia
        this.stats.etr = currentMs + ((targetMs - currentMs) * alpha);
      } else {
        this.stats.etr = targetMs;
      }
	  }

	  /** As for confirmation in the beggining process */
	  async confirm() {
	    if (!this.options.askForConfirmation) return true;

	    log.verb('Waiting for your confirmation...');
      const batchPreviewLines = this.state._batchActive && Array.isArray(this.options.batchPreviewLines)
        ? this.options.batchPreviewLines
        : null;
	    const previewLines = batchPreviewLines?.length
        ? batchPreviewLines
        : this.state._messagesToDelete
          .map(m => `${m.author?.global_name || m.author?.username || 'Unknown'}: ${m.attachments?.length ? '[ATTACHMENTS] ' : ''}${(m.content || '').replace(/\s+/g, ' ').trim()}`);

      const confirmTotal = this.state._batchActive
        ? (
          this.state._batchGrandTotal > 0
            ? Math.max(
              this.state._batchGrandTotal,
              this.state._batchDelCount + this.state._batchFailCount
            )
            : this.state.grandTotal
        )
        : this.state.grandTotal;
      const scopeText = this.state._batchActive
        ? 'multi-channel'
        : (this.options.guildId === '@me' ? 'DM' : 'channel');
	    const answer = await udConfirmDelete({
        total: confirmTotal,
        etrText: msToHMS(this.stats.etr),
        previewMode: !!this.options.previewMode,
        lines: previewLines,
        scopeText,
      });

	    if (!answer) {
	      return false;
	    }
	    else {
	      log.verb('OK');
	      this.options.askForConfirmation = false; // do not ask for confirmation again on the next request
	      return true;
	    }
	  }

	  async search() {
      if (this.state._historyScanActive) {
        return await this.searchByHistoryScan();
      }

	    // Prefer channel scope whenever we have a channel id.
	    // This is more reliable in servers (threads/forum posts/etc).
      const hasChannelScope = !!this.options.channelId;
      const canFallbackToGuildScope = hasChannelScope && this.options.guildId !== '@me';
      let scope = hasChannelScope ? 'channel' : 'guild';
      let allowGuildChannelFilter = true;
      let triedGuildAfterEmptyChannel = false;
      let triedGuildWithoutChannelFilterAfterZero = false;

	    let resp;
      // Retry on network errors (no HTTP response)
      let networkAttempt = 0;

      while (true) {
        try {
          const useGuildScope = scope === 'guild';
          const API_SEARCH_URL = useGuildScope
            ? `https://discord.com/api/v10/guilds/${this.options.guildId}/messages/`
            : `https://discord.com/api/v10/channels/${this.options.channelId}/messages/`;
          const queryChannelId = (useGuildScope && allowGuildChannelFilter)
            ? this.options.channelId
            : undefined;
          const endpointLabel = useGuildScope
            ? `guild:${this.options.guildId}`
            : `channel:${this.options.channelId}`;
          const channelFilterLabel = queryChannelId ? `channel_id=${queryChannelId}` : 'channel_id=<none>';
          log.verb(
            `search:req scope=${scope} endpoint=${endpointLabel} offset=${this.state.offset}`,
            `author=${this.options.authorId || '<any>'}`,
            channelFilterLabel
          );
          const reqCtl = this.beginAbortableRequest();
          this.beforeRequest();
          resp = await fetch(API_SEARCH_URL + 'search?' + queryString([
            ['author_id', this.options.authorId || undefined],
            ['channel_id', queryChannelId],
            ['min_id', this.options.minId ? toSnowflake(this.options.minId) : undefined],
            ['max_id', this.options.maxId ? toSnowflake(this.options.maxId) : undefined],
            ['sort_by', 'timestamp'],
            ['sort_order', 'desc'],
            ['offset', this.state.offset],
            ['has', this.options.hasLink ? 'link' : undefined],
            ['has', this.options.hasFile ? 'file' : undefined],
            ['content', this.options.content || undefined],
            ['include_nsfw', this.options.includeNsfw ? true : undefined],
          ]), {
            headers: {
              'Authorization': this.options.authToken,
            },
            signal: reqCtl.signal,
          });
          this.endAbortableRequest(reqCtl);
          this.afterRequest();
          log.verb(`search:resp status=${resp.status} scope=${scope} offset=${this.state.offset} ping=${this.stats.lastPing}ms`);

          // Some channel types reject channel-scoped search (code 50024).
          // Retry immediately using guild-scoped search + channel_id filter.
          if (resp.status === 400 && canFallbackToGuildScope && scope === 'channel') {
            const body = await resp.clone().json().catch(() => null);
            if (body?.code === 50024) {
              log.warn('Channel-scoped search not allowed for this channel type. Switching to direct channel history scan...');
              this.state._historyScanActive = true;
              return await this.searchByHistoryScan();
            }
          }

          // Some channel types also reject guild search when channel_id is passed.
          if (resp.status === 400 && canFallbackToGuildScope && scope === 'guild' && allowGuildChannelFilter) {
            const body = await resp.clone().json().catch(() => null);
            if (body?.code === 50024) {
              log.warn('Guild-scoped search rejected channel filter for this channel type. Retrying without channel filter (local filter ON)...');
              allowGuildChannelFilter = false;
              continue;
            }
          }

          // Channel endpoint may return 0 even when messages exist; probe guild scope once.
          if (resp.ok && canFallbackToGuildScope && scope === 'channel' && !triedGuildAfterEmptyChannel) {
            const body = await resp.clone().json().catch(() => null);
            const total = Number(body?.total_results ?? -1);
            if (total === 0) {
              triedGuildAfterEmptyChannel = true;
              scope = 'guild';
              allowGuildChannelFilter = true;
              log.warn('Channel-scoped search returned 0 results. Probing guild-scoped search for this channel...');
              continue;
            }
          }

          // Some channel types return 200 + 0 with guild+channel_id even though data exists.
          // Probe once without channel_id and apply local channel filter afterwards.
          if (resp.ok && canFallbackToGuildScope && scope === 'guild' && allowGuildChannelFilter && !triedGuildWithoutChannelFilterAfterZero) {
            const body = await resp.clone().json().catch(() => null);
            const total = Number(body?.total_results ?? -1);
            if (total === 0) {
              triedGuildWithoutChannelFilterAfterZero = true;
              allowGuildChannelFilter = false;
              log.warn('Guild-scoped search with channel filter returned 0. Probing without channel filter (local channel filter ON)...');
              continue;
            }
          }

          break; // fetch OK -> exit retry loop
        } catch (err) {
          if (err?.name === 'AbortError' && !this.state.running) throw err;
          const msg = String(err && (err.message || err));

          // If no longer running, exit cleanly
          if (!this.state.running) {
            log.error('Search aborted (not running).', err);
            throw err;
          }

          // Retry only if enabled
          if (!this.options.retryOnNetworkError) {
            this.state.endReason = 'ERROR';
            this.state.running = false;
            log.error('Search request threw an error:', err);
            throw err;
          }

          networkAttempt++;
          const max = this.options.maxNetworkRetries ?? 8;

          if (networkAttempt > max) {
            this.state.running = false;
            log.error(`Search failed after ${max} network retries.`, err);
            throw err;
          }

          // Progressive backoff + small jitter
          const base = this.options.networkRetryBaseDelay ?? 1000;
          const delay = Math.min(30000, base * Math.pow(1.6, networkAttempt - 1)) + Math.floor(Math.random() * 250);

          log.warn(`NetworkError on search (attempt ${networkAttempt}/${max}). Retrying in ${Math.round(delay)}ms...`, msg);
          await this.waitWithTracking(delay);
          continue;
        }
      }


	    // not indexed yet
	    if (resp.status === 202) {
	      let w = (await resp.json()).retry_after * 1000;
	      w = w || this.options.searchDelay; // Fix retry_after 0
	      this.stats.throttledCount++;
	      this.stats.throttledTotalTime += w;
	      log.warn(`This channel isn't indexed yet. Waiting ${w}ms for discord to index it...`);
	      await this.waitWithTracking(w);
	      return await this.search();
	    }

	    if (!resp.ok) {
	      // searching messages too fast
	      if (resp.status === 429) {
	        let w = (await resp.json()).retry_after * 1000;
	        w = w || this.options.searchDelay; // Fix retry_after 0

	        this.stats.throttledCount++;
	        this.stats.throttledTotalTime += w;
	        this.options.searchDelay += w; // increase delay
	        w = this.options.searchDelay;
	        log.warn(`Being rate limited by the API for ${w}ms! Increasing search delay...`);
	        this.printStats();
	        log.verb(`Cooling down for ${w * 2}ms before retrying...`);

	        if (this.onThrottle) this.onThrottle(w * 2, 'search');
	        await this.waitWithTracking(w * 2);
	        return await this.search();
	      }
	      else {
	        this.state.running = false;
	        log.error(`Error searching messages, API responded with status ${resp.status}!\n`, await resp.json());
	        throw resp;
	      }
	    }
	    const data = await resp.json();
      if (scope === 'guild' && !allowGuildChannelFilter && this.options.channelId) {
        data.__undiscord_forceChannelId = String(this.options.channelId);
      }
      const pageCount = Array.isArray(data?.messages) ? data.messages.length : 0;
      log.verb(
        `search:ok total_results=${Number(data?.total_results ?? 0)} page_groups=${pageCount}`,
        `forced_local_channel_filter=${data.__undiscord_forceChannelId ? 'yes' : 'no'}`
      );
	    this.state._seachResponse = data;
	    log.debug('search', data);
	    return data;
	  }

	  async filterResponse() {
	    const data = this.state._seachResponse;

	    // search returns messages near the the actual message, only get the messages we searched for.
	    const discoveredMessagesRaw = (Array.isArray(data.messages) ? data.messages : [])
        .map(convo => Array.isArray(convo) ? convo.find(message => message.hit === true) : null)
        .filter(Boolean);
      this.state._rawDiscoveredCount = discoveredMessagesRaw.length;

      // the search total will decrease as we delete stuff
	    const total = data.total_results;

      // If we had to query guild scope without channel_id (API limitation), enforce channel filter locally.
      const forceChannelId = String(data?.__undiscord_forceChannelId || '').trim();
      this.state._forcedChannelFilterActive = !!forceChannelId;
      if (!forceChannelId && total > this.state.grandTotal) this.state.grandTotal = total;

      let discoveredMessages = discoveredMessagesRaw;
      if (forceChannelId) {
        const scoped = [];
        let matchedDirect = 0;
        let matchedParent = 0;
        for (const msg of discoveredMessagesRaw) {
          const cid = String(msg?.channel_id || '');
          if (!cid) continue;
          if (cid === forceChannelId) {
            matchedDirect++;
            scoped.push(msg);
            continue;
          }
          const inScope = await this.channelInScope(cid, forceChannelId);
          if (inScope) {
            matchedParent++;
            scoped.push(msg);
          }
        }
        discoveredMessages = scoped;
        log.verb(
          `filter:scope_match direct=${matchedDirect} parent=${matchedParent}`,
          `target=${forceChannelId}`
        );
      }

      const rawByChannel = discoveredMessagesRaw.reduce((acc, m) => {
        const cid = String(m?.channel_id || 'unknown');
        acc[cid] = (acc[cid] || 0) + 1;
        return acc;
      }, {});
      const scopedByChannel = discoveredMessages.reduce((acc, m) => {
        const cid = String(m?.channel_id || 'unknown');
        acc[cid] = (acc[cid] || 0) + 1;
        return acc;
      }, {});

      log.verb(
        `filter:page raw_hits=${discoveredMessagesRaw.length} scoped_hits=${discoveredMessages.length}`,
        `force_channel_id=${forceChannelId || '<none>'}`
      );
      if (forceChannelId) {
        const targetMeta = await this.getChannelMeta(forceChannelId);
        const guildMap = await this.getGuildChannelMap(this.options.guildId);
        const targetFromGuildMap = guildMap instanceof Map ? guildMap.get(forceChannelId) : null;
        const meta = targetMeta || targetFromGuildMap || null;
        log.verb(
          `filter:target_meta id=${forceChannelId}`,
          `type=${meta?.type ?? 'unknown'}`,
          `parent=${meta?.parent_id || '<none>'}`,
          `name=${meta?.name || '<unknown>'}`
        );
      }
      if (Object.keys(rawByChannel).length) {
        const rawTop = Object.entries(rawByChannel)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([cid, count]) => `${cid}:${count}`)
          .join(', ');
        log.verb(`filter:raw_channel_distribution ${rawTop}`);
      }
      if (forceChannelId && Object.keys(scopedByChannel).length) {
        const scopedTop = Object.entries(scopedByChannel)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([cid, count]) => `${cid}:${count}`)
          .join(', ');
        log.verb(`filter:scoped_channel_distribution ${scopedTop}`);
      }

      // ===== DEBUG message types (what Discord returns) =====
      try {
        const dm = discoveredMessages.filter(Boolean);

        // Count by type
        const byType = dm.reduce((acc, m) => {
          const t = m?.type ?? 'null';
          acc[t] = (acc[t] || 0) + 1;
          return acc;
        }, {});

        // Take a few examples for non-0 types
        const non0 = dm.filter(m => m && m.type !== 0).slice(0, 10).map(m => ({
          id: m.id,
          type: m.type,
          flags: m.flags,
          pinned: m.pinned,
          system_content: m.system_content,
          content: (m.content || '').slice(0, 80),
          author: m.author ? `${m.author.username}#${m.author.discriminator}` : null,
          timestamp: m.timestamp,
        }));

        log.debug('DEBUG types', {
          total_results: data.total_results,
          page_messages: data.messages?.length,
          discovered_raw: discoveredMessagesRaw.length,
          discovered: dm.length,
          force_channel_id: forceChannelId || null,
          byType,
          examples_non0: non0,
        });
      } catch (e) {
        log.warn('DEBUG types failed', e);
      }

	    // we can only delete some types of messages, system messages are not deletable.
      const isDeletableType = (msg) => !!msg && (msg.type === 0 || (msg.type >= 6 && msg.type <= 21));
      const afterType = discoveredMessages.filter(isDeletableType);
      const afterPinned = afterType.filter(msg => msg.pinned ? this.options.includePinned : true); // delete pinned messages
	    let messagesToDelete = afterPinned;

	    // custom filter of messages
      let regexFilteredOut = 0;
	    try {
	      const regex = new RegExp(this.options.pattern, 'i');
	      messagesToDelete = afterPinned.filter(msg => regex.test(msg.content));
        regexFilteredOut = afterPinned.length - messagesToDelete.length;
	    } catch (e) {
	      log.warn('Ignoring RegExp because pattern is malformed!', e);
	    }

      const typeFilteredOut = discoveredMessages.length - afterType.length;
      const pinnedFilteredOut = afterType.length - afterPinned.length;
      log.verb(
        `filter:kept=${messagesToDelete.length}/${discoveredMessages.length}`,
        `filtered(type=${typeFilteredOut}, pinned=${pinnedFilteredOut}, regex=${regexFilteredOut})`
      );
      if (discoveredMessages.length > 0 && messagesToDelete.length === 0) {
        const sample = discoveredMessages.slice(0, 3).map(msg => ({
          id: msg?.id,
          channel_id: msg?.channel_id,
          type: msg?.type,
          pinned: !!msg?.pinned,
          content: String(msg?.content || '').slice(0, 60),
        }));
        log.debug('filter:no-deletable-sample', sample);
      }

	    // create an array containing everything we skipped. (used to calculate offset for next searches)
      const keptIds = new Set(messagesToDelete.map(m => m.id));
	    const skippedMessages = discoveredMessages.filter(msg => !keptIds.has(msg.id));

      for (const msg of skippedMessages) {
        if (!msg?.id) continue;
        if (!this.state._skippedIds.has(msg.id)) {
          this.state._skippedIds.add(msg.id);
          this.state._skippedUniqueCount++;
        }
      }

	    this.state._messagesToDelete = messagesToDelete;
	    this.state._skippedMessages = skippedMessages;
      if (Array.isArray(discoveredMessages) && discoveredMessages.length > 0) {
        this.state._deletePageSamples = (this.state._deletePageSamples || 0) + 1;
        const prev = Number(this.state._avgDeletePerPage) || 25;
        const sample = Math.max(0, Math.min(25, messagesToDelete.length));
        const alpha = 0.2; // keep a stable trend, react quickly enough to filter changes
        this.state._avgDeletePerPage = prev + ((sample - prev) * alpha);
      }

	    log.debug('filterResponse', {
        grandTotal: this.state.grandTotal,
        forcedChannelFilter: this.state._forcedChannelFilterActive,
        rawDiscovered: this.state._rawDiscoveredCount,
        skippedUnique: this.state._skippedUniqueCount,
        effectiveTotal: Math.max(0, this.state.grandTotal - this.state._skippedUniqueCount),
        avgDeletePerPage: Number(this.state._avgDeletePerPage || 0).toFixed(2),
        pageMessages: data?.messages?.length ?? 0,
        toDelete: this.state._messagesToDelete.length,
        skippedPage: this.state._skippedMessages.length,
      });

	  }

	  async deleteMessagesFromList() {
	    for (let i = 0; i < this.state._messagesToDelete.length; i++) {
	      const message = this.state._messagesToDelete[i];
	      if (!this.state.running) return;

        const usingBatch = !!this.state._batchActive;
        const doneCount = usingBatch
          ? this.state._batchDelCount + this.state._batchFailCount
          : this.state.delCount + this.state.failCount;
        const totalCount = usingBatch
          ? this.state._batchGrandTotal
          : this.state.grandTotal;
        const idx = doneCount + 1;
        const max = Math.max(totalCount, idx);

        const meta = `[${idx}/${max}]`;
        const content = (message.content || '').replace(/\n/g, ' ↵ ').trim();
        const messageChannelId = String(message.channel_id || '').trim();
        const showChannel = usingBatch && !!this.options.batchChannelPlan;
        let channelName = '';
        if (showChannel && messageChannelId) {
          channelName = String(this.options.batchChannelPlan?.[messageChannelId]?.name || '').trim();
          if (!channelName) {
            const meta = await this.getChannelMeta(messageChannelId);
            channelName = String(meta?.name || '').trim();
          }
        }

        log.del({
          author: message.author,
          meta,
          content,
          timestamp: message.timestamp,
          channelId: messageChannelId,
          channelName,
          showChannel,
          attachments: Array.isArray(message.attachments) ? message.attachments : [],
          embeds: Array.isArray(message.embeds) ? message.embeds : [],
        });


	      // Delete a single message (with retry)
	      let attempt = 0;
	      while (attempt < this.options.maxAttempt) {
	        const result = await this.deleteMessage(message);

	        if (result === 'RETRY') {
	          attempt++;
	          log.verb(`Retrying in ${this.options.deleteDelay}ms... (${attempt}/${this.options.maxAttempt})`);
	          await this.waitWithTracking(this.options.deleteDelay);
	        }
	        else break;
	      }

	      this.calcEtr();
	      if (this.onProgress) this.onProgress(this.state, this.stats);

	      await this.waitWithTracking(this.options.deleteDelay);
	    }
	  }

	  async deleteMessage(message) {
      if (this.options.previewMode) {
        this.state.delCount++;
        if (this.state._batchActive) this.state._batchDelCount++;
        if (this.onDeleted) this.onDeleted(message);
        return 'OK';
      }

	    const API_DELETE_URL = `https://discord.com/api/v10/channels/${message.channel_id}/messages/${message.id}`;
	    let resp;
	    try {
        const reqCtl = this.beginAbortableRequest();
	      this.beforeRequest();
	      resp = await fetch(API_DELETE_URL, {
	        method: 'DELETE',
	        headers: {
	          'Authorization': this.options.authToken,
	        },
          signal: reqCtl.signal,
	      });
        this.endAbortableRequest(reqCtl);
	      this.afterRequest();
	    } catch (err) {
        if (err?.name === 'AbortError' && !this.state.running) {
          return 'FAILED';
        }
	      // no response error (e.g. network error)
	      log.error('Delete request throwed an error:', err);
	      log.verb('Related object:', redact(JSON.stringify(message)));
	      this.state.failCount++;
        if (this.state._batchActive) this.state._batchFailCount++;
	      return 'FAILED';
	    }

	    if (!resp.ok) {
	      if (resp.status === 429) {
	        // deleting messages too fast
	        // PATCH: tolerate missing retry_after and never LOWER the current delay
	        const w = ((await resp.json().catch(() => ({}))).retry_after || 1) * 1000;
	        this.stats.throttledCount++;
	        this.stats.throttledTotalTime += w;
	        this.options.deleteDelay = Math.max(Number(this.options.deleteDelay) || 0, w);
	        log.warn(`Being rate limited by the API for ${w}ms! Adjusted delete delay to ${this.options.deleteDelay}ms.`);
	        this.printStats();
	        log.verb(`Cooling down for ${w * 2}ms before retrying...`);
	        if (this.onThrottle) this.onThrottle(w * 2, 'delete');
	        await this.waitWithTracking(w * 2);
	        return 'RETRY';
	      } else {
	        const body = await resp.text();

	        try {
	          const r = JSON.parse(body);

	          if (resp.status === 400 && r.code === 50083) {
	            // 400 can happen if the thread is archived (code=50083)
	            // in this case we need to "skip" this message from the next search
	            // otherwise it will come up again in the next page (and fail to delete again)
	            log.warn('Error deleting message (Thread is archived). Will increment offset so we don\'t search this in the next page...');
	            this.state.offset++;
	            this.state.failCount++;
              if (this.state._batchActive) this.state._batchFailCount++;
	            return 'FAIL_SKIP'; // Failed but we will skip it next time
	          }

	          log.error(`Error deleting message, API responded with status ${resp.status}!`, r);
	          log.verb('Related object:', redact(JSON.stringify(message)));
	          this.state.failCount++;
            if (this.state._batchActive) this.state._batchFailCount++;
	          return 'FAILED';
	        } catch (e) {
	          log.error(`Fail to parse JSON. API responded with status ${resp.status}!`, body);
            this.state.failCount++;
            if (this.state._batchActive) this.state._batchFailCount++;
            return 'FAILED';
	        }
	      }
	    }

	    this.state.delCount++;
      if (this.state._batchActive) this.state._batchDelCount++;
      if (this.onDeleted) this.onDeleted(message);
	    return 'OK';
	  }

	  #beforeTs = 0; // used to calculate latency
	  beforeRequest() {
	    this.#beforeTs = Date.now();
	  }
	  afterRequest() {
	    this.stats.lastPing = (Date.now() - this.#beforeTs);
	    this.stats.avgPing = this.stats.avgPing > 0 ? (this.stats.avgPing * 0.9) + (this.stats.lastPing * 0.1) : this.stats.lastPing;
	  }

	  printStats() {
	    log.verb(
	      `Delete delay: ${this.options.deleteDelay}ms, Search delay: ${this.options.searchDelay}ms`,
	      `Last Ping: ${this.stats.lastPing}ms, Average Ping: ${this.stats.avgPing | 0}ms`,
	    );
	    log.verb(
	      `Rate Limited: ${this.stats.throttledCount} times.`,
	      `Total time throttled: ${msToHMS(this.stats.throttledTotalTime)}.`
	    );
	  }
	}

	const MOVE = 0;
	const RESIZE_T = 1;
	const RESIZE_B = 2;
	const RESIZE_L = 4;
	const RESIZE_R = 8;
	const RESIZE_TL = RESIZE_T + RESIZE_L;
	const RESIZE_TR = RESIZE_T + RESIZE_R;
	const RESIZE_BL = RESIZE_B + RESIZE_L;
	const RESIZE_BR = RESIZE_B + RESIZE_R;

	/**
	 * Make an element draggable/resizable
	 * @author Victor N. wwww.vitim.us
	 */
	class DragResize {
	  constructor({ elm, moveHandle, options }) {
	    this.options = defaultArgs({
	      enabledDrag: true,
	      enabledResize: true,
	      minWidth: 200,
	      maxWidth: Infinity,
	      minHeight: 100,
	      maxHeight: Infinity,
	      dragAllowX: true,
	      dragAllowY: true,
	      resizeAllowX: true,
	      resizeAllowY: true,
	      draggingClass: 'drag',
	      useMouseEvents: true,
	      useTouchEvents: true,
	      createHandlers: true,
	    }, options);
	    Object.assign(this, options);
	    options = undefined;

	    elm.style.position = 'fixed';

	    this.drag_m = new Draggable(elm, moveHandle, MOVE, this.options);

	    if (this.options.createHandlers) {
	      this.el_t = createElement('div', { name: 'grab-t' }, elm);
	      this.drag_t = new Draggable(elm, this.el_t, RESIZE_T, this.options);
	      this.el_r = createElement('div', { name: 'grab-r' }, elm);
	      this.drag_r = new Draggable(elm, this.el_r, RESIZE_R, this.options);
	      this.el_b = createElement('div', { name: 'grab-b' }, elm);
	      this.drag_b = new Draggable(elm, this.el_b, RESIZE_B, this.options);
	      this.el_l = createElement('div', { name: 'grab-l' }, elm);
	      this.drag_l = new Draggable(elm, this.el_l, RESIZE_L, this.options);
	      this.el_tl = createElement('div', { name: 'grab-tl' }, elm);
	      this.drag_tl = new Draggable(elm, this.el_tl, RESIZE_TL, this.options);
	      this.el_tr = createElement('div', { name: 'grab-tr' }, elm);
	      this.drag_tr = new Draggable(elm, this.el_tr, RESIZE_TR, this.options);
	      this.el_br = createElement('div', { name: 'grab-br' }, elm);
	      this.drag_br = new Draggable(elm, this.el_br, RESIZE_BR, this.options);
	      this.el_bl = createElement('div', { name: 'grab-bl' }, elm);
	      this.drag_bl = new Draggable(elm, this.el_bl, RESIZE_BL, this.options);
	    }
	  }
	}

	class Draggable {
	  constructor(targetElm, handleElm, op, options) {
	    Object.assign(this, options);
	    options = undefined;

	    this._targetElm = targetElm;
	    this._handleElm = handleElm;

	    let vw = window.innerWidth;
	    let vh = window.innerHeight;
	    let initialX, initialY, initialT, initialL, initialW, initialH;

	    const clamp = (value, min, max) => value < min ? min : value > max ? max : value;

	    const moveOp = (x, y) => {
	      const deltaX = (x - initialX);
	      const deltaY = (y - initialY);
	      const t = clamp(initialT + deltaY, 0, vh - initialH);
	      const l = clamp(initialL + deltaX, 0, vw - initialW);
	      this._targetElm.style.top = t + 'px';
	      this._targetElm.style.left = l + 'px';
	    };

	    const resizeOp = (x, y) => {
	      x = clamp(x, 0, vw);
	      y = clamp(y, 0, vh);
	      const deltaX = (x - initialX);
	      const deltaY = (y - initialY);
	      const resizeDirX = (op & RESIZE_L) ? -1 : 1;
	      const resizeDirY = (op & RESIZE_T) ? -1 : 1;
	      const deltaXMax = (this.maxWidth - initialW);
	      const deltaXMin = (this.minWidth - initialW);
	      const deltaYMax = (this.maxHeight - initialH);
	      const deltaYMin = (this.minHeight - initialH);
	      const t = initialT + clamp(deltaY * resizeDirY, deltaYMin, deltaYMax) * resizeDirY;
	      const l = initialL + clamp(deltaX * resizeDirX, deltaXMin, deltaXMax) * resizeDirX;
	      const w = initialW + clamp(deltaX * resizeDirX, deltaXMin, deltaXMax);
	      const h = initialH + clamp(deltaY * resizeDirY, deltaYMin, deltaYMax);
	      if (op & RESIZE_T) { // resize ↑
	        this._targetElm.style.top = t + 'px';
	        this._targetElm.style.height = h + 'px';
	      }
	      if (op & RESIZE_B) { // resize ↓
	        this._targetElm.style.height = h + 'px';
	      }
	      if (op & RESIZE_L) { // resize ←
	        this._targetElm.style.left = l + 'px';
	        this._targetElm.style.width = w + 'px';
	      }
	      if (op & RESIZE_R) { // resize →
	        this._targetElm.style.width = w + 'px';
	      }
	    };

	    let operation = op === MOVE ? moveOp : resizeOp;

	    function dragStartHandler(e) {
	      const touch = e.type === 'touchstart';
	      // FIX: taps on header buttons (close, mute, ...) must reach the button
	      if (e.target && e.target.closest && e.target.closest('button, [role="button"], input, a, label, select, .hdrBtn, #hide, .killCount')) return;
	      if (document.body.classList.contains('reaper-mobile')) return;
	      if ((e.buttons === 1 || e.which === 1) || touch) {
	        e.preventDefault();
	        const x = touch ? e.touches[0].clientX : e.clientX;
	        const y = touch ? e.touches[0].clientY : e.clientY;
	        initialX = x;
	        initialY = y;
	        vw = window.innerWidth;
	        vh = window.innerHeight;
	        initialT = this._targetElm.offsetTop;
	        initialL = this._targetElm.offsetLeft;
	        initialW = this._targetElm.clientWidth;
	        initialH = this._targetElm.clientHeight;
	        if (this.useMouseEvents) {
	          document.addEventListener('mousemove', this._dragMoveHandler);
	          document.addEventListener('mouseup', this._dragEndHandler);
	        }
	        if (this.useTouchEvents) {
	          document.addEventListener('touchmove', this._dragMoveHandler, { passive: false });
	          document.addEventListener('touchend', this._dragEndHandler);
	        }
	        this._targetElm.classList.add(this.draggingClass);
	      }
	    }

	    function dragMoveHandler(e) {
	      e.preventDefault();
	      let x, y;
	      const touch = e.type === 'touchmove';
	      if (touch) {
	        const t = e.touches[0];
	        x = t.clientX;
	        y = t.clientY;
	      } else { //mouse
	        // If the button is not down, dispatch a "fake" mouse up event, to stop listening to mousemove
	        // This happens when the mouseup is not captured (outside the browser)
	        if ((e.buttons || e.which) !== 1) {
	          this._dragEndHandler();
	          return;
	        }
	        x = e.clientX;
	        y = e.clientY;
	      }
	      // perform drag / resize operation
	      operation(x, y);
	    }

	    function dragEndHandler(e) {
	      if (this.useMouseEvents) {
	        document.removeEventListener('mousemove', this._dragMoveHandler);
	        document.removeEventListener('mouseup', this._dragEndHandler);
	      }
	      if (this.useTouchEvents) {
	        document.removeEventListener('touchmove', this._dragMoveHandler);
	        document.removeEventListener('touchend', this._dragEndHandler);
	      }
	      this._targetElm.classList.remove(this.draggingClass);
	    }

	    // We need to bind the handlers to this instance
	    this._dragStartHandler = dragStartHandler.bind(this);
	    this._dragMoveHandler = dragMoveHandler.bind(this);
	    this._dragEndHandler = dragEndHandler.bind(this);

	    this.enable();
	  }

	  /** Turn on the drag and drop of the instance */
	  enable() {
	    this.destroy(); // prevent events from getting binded twice
	    if (this.useMouseEvents) this._handleElm.addEventListener('mousedown', this._dragStartHandler);
	    if (this.useTouchEvents) this._handleElm.addEventListener('touchstart', this._dragStartHandler, { passive: false });
	  }

	  /** Teardown all events bound to the document and elements. You can resurrect this instance by calling enable() */
	  destroy() {
	    this._targetElm.classList.remove(this.draggingClass);
	    if (this.useMouseEvents) {
	      this._handleElm.removeEventListener('mousedown', this._dragStartHandler);
	      document.removeEventListener('mousemove', this._dragMoveHandler);
	      document.removeEventListener('mouseup', this._dragEndHandler);
	    }
	    if (this.useTouchEvents) {
	      this._handleElm.removeEventListener('touchstart', this._dragStartHandler);
	      document.removeEventListener('touchmove', this._dragMoveHandler);
	      document.removeEventListener('touchend', this._dragEndHandler);
	    }
	  }
	}

	function createElement(tag='div', attrs, parent) {
	  const elm = document.createElement(tag);
	  if (attrs) Object.entries(attrs).forEach(([k, v]) => elm.setAttribute(k, v));
	  if (parent) parent.appendChild(elm);
	  return elm;
	}

	function defaultArgs(defaults, options) {
	  function isObj(x) { return x !== null && typeof x === 'object'; }
	  function hasOwn(obj, prop) { return Object.prototype.hasOwnProperty.call(obj, prop); }
	  if (isObj(options)) for (let prop in defaults) {
	    if (hasOwn(defaults, prop) && hasOwn(options, prop) && options[prop] !== undefined) {
	      if (isObj(defaults[prop])) defaultArgs(defaults[prop], options[prop]);
	      else defaults[prop] = options[prop];
	    }
	  }
	  return defaults;
	}

	function createElm(html) {
	  const temp = document.createElement('div');
	  temp.innerHTML = html;
	  return temp.removeChild(temp.firstElementChild);
	}

	function insertCss(css) {
	  const style = document.createElement('style');
	  style.appendChild(document.createTextNode(css));
	  document.head.appendChild(style);
	  return style;
	}

	const messagePickerCss = `
body.undiscord-pick-message [data-list-id="chat-messages"] {
  background-color: var(--background-secondary-alt);
  box-shadow: inset 0 0 0px 2px #ff2a44;
}

body.undiscord-pick-message [id^="message-content-"]:hover {
  cursor: pointer;
  cursor: cell;
  background: rgba(255,42,68,.12);
}
body.undiscord-pick-message [id^="message-content-"]:hover::after {
  position: absolute;
  top: calc(50% - 11px);
  left: 4px;
  z-index: 1;
  width: 65px;
  height: 22px;
  line-height: 22px;
  font-family: var(--font-display);
  background-color: #a50a1e;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  text-align: center;
  border-radius: 3px;
  content: 'This 👉';
}
body.undiscord-pick-message.before [id^="message-content-"]:hover::after {
  content: 'Before 👆';
}
body.undiscord-pick-message.after [id^="message-content-"]:hover::after {
  content: 'After 👇';
}
`;

	const messagePicker = {
	  init() {
	    insertCss(messagePickerCss);
	  },
	  grab(auxiliary) {
	    return new Promise((resolve, reject) => {
	      document.body.classList.add('undiscord-pick-message');
	      if (auxiliary) document.body.classList.add(auxiliary);
	      function clickHandler(e) {
	        const message = e.target.closest('[id^="message-content-"]');
	        if (message) {
	          e.preventDefault();
	          e.stopPropagation();
	          e.stopImmediatePropagation();
	          if (auxiliary) document.body.classList.remove(auxiliary);
	          document.body.classList.remove('undiscord-pick-message');
	          document.removeEventListener('click', clickHandler);
	          try {
	            resolve(message.id.match(/message-content-(\d+)/)[1]);
	          } catch (e) {
	            resolve(null);
	          }
	        }
	      }
	      document.addEventListener('click', clickHandler);
	    });
	  }
	};
	window.messagePicker = messagePicker;

	function getTokenFromWebpack(globalObj) {
	  const chunkKeys = Object.keys(globalObj).filter(
	    k => k.startsWith('webpackChunk') && Array.isArray(globalObj[k])
	  );

	  let req = null;
	  let foundKey = null;
	  for (const key of chunkKeys) {
	    const chunk = globalObj[key];
	    if (!chunk || typeof chunk.push !== 'function') continue;
	    try {
	      const tokenId = `__undiscord__${Date.now()}`;
	      chunk.push([[tokenId], {}, r => { req = r; }]);
	      if (req?.c) {
	        foundKey = key;
	        break;
	      }
	    } catch {}
	  }

	  if (!req && typeof globalObj.__webpack_require__ === 'function' && globalObj.__webpack_require__.c) {
	    req = globalObj.__webpack_require__;
	    foundKey = '__webpack_require__';
	  }

	  if (!req?.c) throw new Error('webpack require not found');

	  const modules = Object.values(req.c);
	  const mod = modules.find(m =>
	    m?.exports?.default?.getToken ||
	    m?.exports?.getToken
	  );

	  if (!mod) {
	    throw new Error(`getToken module not found (chunk=${foundKey || 'unknown'})`);
	  }

	  if (mod?.exports?.default?.getToken) return mod.exports.default.getToken();
	  if (mod?.exports?.getToken) return mod.exports.getToken();
	  throw new Error('getToken export not callable');
	}

  function normalizeTokenCandidate(raw) {
    if (typeof raw !== 'string') return '';
    const s = raw.trim();
    if (!s) return '';
    try {
      const parsed = JSON.parse(s);
      return typeof parsed === 'string' ? parsed : '';
    } catch {
      // In some builds/storage states token can already be plain text.
      return s.replace(/^"|"$/g, '');
    }
  }

	function getTokenFromPageContext() {
	  return new Promise((resolve, reject) => {
	    const reqId = `undiscord_token_${Date.now()}_${Math.random().toString(36).slice(2)}`;
	    const timeoutMs = 10000;
	    let done = false;

	    function cleanup() {
	      if (done) return;
	      done = true;
	      window.removeEventListener('message', onMessage);
	    }

	    function onMessage(event) {
	      if (event.source !== window) return;
	      if (event.origin !== location.origin) return; // PATCH: same-origin only
	      const data = event.data;
	      if (!data || data.source !== 'undiscord' || data.id !== reqId) return;
	      cleanup();
	      if (data.error) {
	        reject(new Error(data.error));
	      } else {
	        resolve(data.token || '');
	      }
	    }

	    window.addEventListener('message', onMessage);

	    // PATCH: postMessage target is location.origin instead of '*'
	    const script = document.createElement('script');
	    script.textContent = `(function(){try{
  var globalObj = window;
  var chunkKeys = Object.keys(globalObj).filter(function(k){return k.indexOf('webpackChunk')===0 && Array.isArray(globalObj[k]);});
  var req = null;
  var foundKey = null;
  for (var i=0;i<chunkKeys.length;i++){
    var key = chunkKeys[i];
    var chunk = globalObj[key];
    if (!chunk || typeof chunk.push !== 'function') continue;
    try {
      var tokenId = '__undiscord__' + Date.now();
      chunk.push([[tokenId], {}, function(r){ req = r; }]);
      if (req && req.c){ foundKey = key; break; }
    } catch(e){}
  }
  if (!req && typeof globalObj.__webpack_require__ === 'function' && globalObj.__webpack_require__.c){
    req = globalObj.__webpack_require__;
    foundKey = '__webpack_require__';
  }
  if (!req || !req.c) throw new Error('webpack require not found');
  var modules = Object.values(req.c);
  var mod = modules.find(function(m){ return (m && m.exports && m.exports.default && m.exports.default.getToken) || (m && m.exports && m.exports.getToken); });
  if (!mod) throw new Error('getToken module not found (chunk=' + (foundKey || 'unknown') + ')');
  var token = null;
  if (mod.exports && mod.exports.default && mod.exports.default.getToken) token = mod.exports.default.getToken();
  else if (mod.exports && mod.exports.getToken) token = mod.exports.getToken();
  else throw new Error('getToken export not callable');
  window.postMessage({source:'undiscord', id:'${reqId}', token: token}, location.origin);
}catch(e){
  window.postMessage({source:'undiscord', id:'${reqId}', error: String(e && (e.message || e))}, location.origin);
}})();`;
      script.onerror = () => {
        cleanup();
        reject(new Error('page-context script injection blocked or failed'));
      };
	    (document.head || document.documentElement).appendChild(script);
	    script.remove();

	    setTimeout(() => {
	      cleanup();
	      reject(new Error('token request timeout'));
	    }, timeoutMs);
	  });
	}

	function getTokenFromClassicWebpackPush() {
	  const chunk = window.webpackChunkdiscord_app;
	  if (!Array.isArray(chunk) || typeof chunk.push !== 'function') {
	    throw new Error('webpackChunkdiscord_app is not available');
	  }

	  let modules = [];
	  chunk.push([['__undiscord__classic__'], {}, (e) => {
	    modules = [];
	    for (const c in e.c) modules.push(e.c[c]);
	  }]);

	  const mod = modules.find(m =>
	    m?.exports?.default?.getToken !== void 0 ||
	    m?.exports?.getToken !== void 0
	  );
	  if (!mod) throw new Error('classic webpack push: getToken module not found');

	  if (mod?.exports?.default?.getToken) return mod.exports.default.getToken();
	  if (mod?.exports?.getToken) return mod.exports.getToken();
	  throw new Error('classic webpack push: getToken export not callable');
	}

	// PATCH: read localStorage through a temporary iframe and always remove it afterwards
	function readDiscordLocalStorage(key) {
	  const frame = document.body.appendChild(document.createElement('iframe'));
	  frame.style.display = 'none';
	  try {
	    return frame.contentWindow.localStorage[key];
	  } finally {
	    frame.remove();
	  }
	}

	async function getToken() {
	  window.dispatchEvent(new Event('beforeunload'));
    const storageToken = normalizeTokenCandidate(readDiscordLocalStorage('token'));
    if (storageToken) return storageToken;

    log.info('Could not automatically detect Authorization Token in local storage!');
    log.info('Attempting to grab token using webpack');

    const attempts = [];

    try {
      const t = getTokenFromWebpack(window);
      if (t) return t;
      attempts.push('getTokenFromWebpack: empty token');
    } catch (err) {
      attempts.push(`getTokenFromWebpack: ${String(err?.message || err)}`);
      log.warn('Generic webpack token extraction failed, trying classic webpack push...', err);
    }

    try {
      const t = getTokenFromClassicWebpackPush();
      if (t) return t;
      attempts.push('getTokenFromClassicWebpackPush: empty token');
    } catch (errClassic) {
      attempts.push(`getTokenFromClassicWebpackPush: ${String(errClassic?.message || errClassic)}`);
      log.warn('Classic webpack push token extraction failed in content world, trying page context...', errClassic);
    }

    try {
      const t = await getTokenFromPageContext();
      if (t) return t;
      attempts.push('getTokenFromPageContext: empty token');
    } catch (err2) {
      attempts.push(`getTokenFromPageContext: ${String(err2?.message || err2)}`);
      log.warn('Page-context token extraction failed.', err2);
    }

    const chunkKeys = Object.keys(window).filter(k => k.startsWith('webpackChunk'));
    log.debug('Token extraction attempts:', attempts);
    log.debug('webpackChunk keys detected:', chunkKeys);
    throw new Error('token auto-detection failed');
	}

	function getAuthorId() {
	  return JSON.parse(readDiscordLocalStorage('user_id_cache'));
	}

  function getGuildId({ silent = false } = {}) {
    const m = location.href.match(/channels\/([\w@]+)\/(\d+)/);
    if (m) return m[1];
    if (!silent) udToast('Could not find the Server ID.\nOpen a server or DM first.', { type: 'warn' });
    return null;
  }

  function getChannelId({ silent = false } = {}) {
    const m = location.href.match(/channels\/([\w@]+)\/(\d+)/);
    if (m) return m[2];
    if (!silent) udToast('Could not find the Channel ID.\nOpen a channel or DM first.', { type: 'warn' });
    return null;
  }

  function extractDiscordId(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const m = raw.match(/\d{17,21}/);
    return m ? m[0] : '';
  }

  function parseChannelIdsInput(value) {
    const tokens = String(value || '')
      .split(/[\s,;]+/)
      .map(x => x.trim())
      .filter(Boolean);
    const ids = [];
    const seen = new Set();
    for (const token of tokens) {
      const id = extractDiscordId(token);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }

  function getServerChannelIdsFromDom(guildId) {
    const gid = String(guildId || '').trim();
    if (!gid || gid === '@me') return [];

    const rows = Array.from(document.querySelectorAll(
      `#app-mount a[data-list-item-id^="channels___"][href^="/channels/${gid}/"]`
    ));
    const ids = new Set();

    for (const row of rows) {
      const href = String(row.getAttribute('href') || '');
      const m = href.match(new RegExp(`^/channels/${gid}/(\\d+)`));
      if (m) ids.add(m[1]);
    }
    return Array.from(ids);
  }

  async function getServerMessageChannels(guildId, authToken) {
    const gid = String(guildId || '').trim();
    if (!gid || gid === '@me') return [];

    if (!authToken) {
      return getServerChannelIdsFromDom(gid).map((id) => ({ id: String(id), type: null, name: '', source: 'dom' }));
    }

    try {
      const resp = await fetch(`https://discord.com/api/v10/guilds/${gid}/channels`, {
        headers: { Authorization: authToken }
      });
      if (!resp.ok) throw new Error(`GET /guilds/${gid}/channels failed with ${resp.status}`);
      const channels = await resp.json();
      if (!Array.isArray(channels)) {
        return getServerChannelIdsFromDom(gid).map((id) => ({ id: String(id), type: null, name: '', source: 'dom' }));
      }

      // Message-bearing / searchable channel types:
      // 0 text, 5 announcement, 10/11/12/13 threads, 15 forum, 16 media
      const messageType = new Set([0, 5, 10, 11, 12, 13, 15, 16]);
      const out = new Map();
      for (const ch of channels) {
        if (!ch || String(ch.guild_id) !== gid) continue;
        const type = Number(ch.type);
        if (!messageType.has(type)) continue;
        const id = String(ch.id || '');
        if (!id) continue;
        out.set(id, { id, type, name: String(ch.name || ''), source: 'guild_channels' });
      }

      // Active threads are not always present in /guilds/{id}/channels on all builds.
      try {
        const tResp = await fetch(`https://discord.com/api/v10/guilds/${gid}/threads/active`, {
          headers: { Authorization: authToken }
        });
        if (tResp.ok) {
          const tData = await tResp.json();
          const threads = Array.isArray(tData?.threads) ? tData.threads : [];
          for (const th of threads) {
            const thId = String(th?.id || '');
            if (!thId) continue;
            const type = Number(th?.type);
            out.set(thId, {
              id: thId,
              type: Number.isFinite(type) ? type : 11,
              name: String(th?.name || ''),
              source: 'threads_active'
            });
          }
        }
      } catch {}

      // Archived threads are a common blind spot of guild-wide search.
      // Probe one page per parent to improve coverage with minimal overhead.
      // Include private thread archives as well when allowed by permissions.
      const archiveParents = channels
        .filter(ch => ch && String(ch.guild_id) === gid && [0, 5, 15, 16].includes(Number(ch.type)))
        .map(ch => String(ch.id || ''))
        .filter(Boolean);
      for (const parentId of archiveParents) {
        const archiveEndpoints = [
          { path: 'threads/archived/public', source: 'threads_archived_public' },
          { path: 'users/@me/threads/archived/private', source: 'threads_archived_private_me' },
          { path: 'threads/archived/private', source: 'threads_archived_private' },
        ];
        for (const endpoint of archiveEndpoints) {
          try {
            const aResp = await fetch(
              `https://discord.com/api/v10/channels/${parentId}/${endpoint.path}?limit=100`,
              { headers: { Authorization: authToken } }
            );
            if (!aResp.ok) continue;
            const aData = await aResp.json();
            const threads = Array.isArray(aData?.threads) ? aData.threads : [];
            for (const th of threads) {
              const thId = String(th?.id || '');
              if (!thId) continue;
              const type = Number(th?.type);
              out.set(thId, {
                id: thId,
                type: Number.isFinite(type) ? type : 11,
                name: String(th?.name || ''),
                source: endpoint.source
              });
            }
          } catch {}
        }
      }

      const resolved = Array.from(out.values());
      if (resolved.length) return resolved;

      return getServerChannelIdsFromDom(gid).map((id) => ({ id: String(id), type: null, name: '', source: 'dom' }));
    } catch (err) {
      log.warn('Could not fetch all guild channels from API, falling back to sidebar DOM.', err);
      return getServerChannelIdsFromDom(gid).map((id) => ({ id: String(id), type: null, name: '', source: 'dom' }));
    }
  }

  function messageMatchesDeleteFiltersLocal(message, opts, regex) {
    if (!message) return false;
    const authorId = String(opts?.authorId || '').trim();
    if (authorId && String(message?.author?.id || '') !== authorId) return false;

    const messageId = String(message?.id || '');
    if (!messageId) return false;

    if (opts?.minId) {
      const minSnow = String(toSnowflake(opts.minId));
      if (BigInt(messageId) <= BigInt(minSnow)) return false;
    }
    if (opts?.maxId) {
      const maxSnow = String(toSnowflake(opts.maxId));
      if (BigInt(messageId) >= BigInt(maxSnow)) return false;
    }

    const content = String(message?.content || '');
    if (opts?.content && !content.toLowerCase().includes(String(opts.content).toLowerCase())) return false;

    if (opts?.hasFile && !(Array.isArray(message?.attachments) && message.attachments.length > 0)) return false;
    if (opts?.hasLink && !/(https?:\/\/[^\s]+)/i.test(content)) return false;

    // Same deletable-type filter used later by core.
    const type = Number(message?.type);
    const isDeletableType = (type === 0 || (type >= 6 && type <= 21));
    if (!isDeletableType) return false;

    if (!opts?.includePinned && !!message?.pinned) return false;
    if (regex && !regex.test(content)) return false;

    return true;
  }

  async function estimateChannelMessageCount({ authToken, guildId, channelId, filters }) {
    const ch = String(channelId || '').trim();
    if (!ch) return { channelId: ch, count: 0, method: 'invalid' };

    const searchQuery = () => queryString([
      ['author_id', filters.authorId || undefined],
      ['channel_id', undefined],
      ['min_id', filters.minId ? toSnowflake(filters.minId) : undefined],
      ['max_id', filters.maxId ? toSnowflake(filters.maxId) : undefined],
      ['sort_by', 'timestamp'],
      ['sort_order', 'desc'],
      ['offset', 0],
      ['has', filters.hasLink ? 'link' : undefined],
      ['has', filters.hasFile ? 'file' : undefined],
      ['content', filters.content || undefined],
      ['include_nsfw', filters.includeNsfw ? true : undefined],
    ]);

    // Fast path: channel search total_results.
    try {
      const resp = await fetch(`https://discord.com/api/v10/channels/${ch}/messages/search?${searchQuery()}`, {
        headers: { Authorization: authToken }
      });

      if (resp.ok) {
        const data = await resp.json();
        return { channelId: ch, count: Math.max(0, Number(data?.total_results || 0)), method: 'search_total' };
      }

      if (resp.status === 202) {
        const body = await resp.json().catch(() => ({}));
        const waitMs = Math.max(500, Math.round((Number(body?.retry_after) || 1) * 1000));
        await wait(waitMs);
        const retry = await fetch(`https://discord.com/api/v10/channels/${ch}/messages/search?${searchQuery()}`, {
          headers: { Authorization: authToken }
        });
        if (retry.ok) {
          const data = await retry.json();
          return { channelId: ch, count: Math.max(0, Number(data?.total_results || 0)), method: 'search_total_after_index' };
        }
      }

      const body = await resp.clone().json().catch(() => null);
      if (!(resp.status === 400 && body?.code === 50024)) {
        return { channelId: ch, count: 0, method: `search_error_${resp.status}` };
      }
    } catch {
      // fallback to history scan below
    }

    // Fallback path: channel history scan count (slower but robust).
    let regex = null;
    try {
      regex = new RegExp(filters.pattern, 'i');
    } catch {
      regex = null;
    }

    let before = null;
    let matched = 0;
    for (let page = 0; page < 5000; page++) {
      const qs = queryString([
        ['limit', 100],
        ['before', before || undefined],
      ]);
      const resp = await fetch(`https://discord.com/api/v10/channels/${ch}/messages?${qs}`, {
        headers: { Authorization: authToken }
      });
      if (!resp.ok) {
        if (resp.status === 429) {
          const body = await resp.json().catch(() => ({}));
          const retryAfterMs = Math.max(500, Math.round((Number(body?.retry_after) || 1) * 1000));
          await wait(retryAfterMs);
          continue;
        }
        return { channelId: ch, count: matched, method: `history_partial_${resp.status}` };
      }
      const list = await resp.json();
      const batch = Array.isArray(list) ? list : [];
      if (!batch.length) break;

      for (const msg of batch) {
        if (messageMatchesDeleteFiltersLocal(msg, filters, regex)) matched++;
      }
      before = String(batch[batch.length - 1]?.id || '');
      if (!before) break;
      await wait(120);
    }
    return { channelId: ch, count: matched, method: 'history_scan_count' };
  }

  async function collectChannelPreviewLines({ authToken, channelId, filters, maxLines = 100 }) {
    const ch = String(channelId || '').trim();
    if (!ch || maxLines <= 0) return { lines: [], truncated: false, method: 'invalid' };

    const lines = [];
    let truncated = false;
    let regex = null;
    try {
      regex = new RegExp(filters.pattern, 'i');
    } catch {
      regex = null;
    }

    const toLine = (m) => {
      const author = m?.author
        ? `${m.author.username || 'Unknown'}#${m.author.discriminator || '0'}`
        : 'Unknown#0000';
      const text = String(m?.content || '').replace(/\s+/g, ' ').trim();
      const hasAtt = Array.isArray(m?.attachments) && m.attachments.length > 0;
      return `${author}: ${text || (hasAtt ? '[ATTACHMENTS]' : '[NO TEXT]')}`;
    };

    const searchQuery = (offset = 0) => queryString([
      ['author_id', filters.authorId || undefined],
      ['channel_id', undefined],
      ['min_id', filters.minId ? toSnowflake(filters.minId) : undefined],
      ['max_id', filters.maxId ? toSnowflake(filters.maxId) : undefined],
      ['sort_by', 'timestamp'],
      ['sort_order', 'desc'],
      ['offset', offset],
      ['has', filters.hasLink ? 'link' : undefined],
      ['has', filters.hasFile ? 'file' : undefined],
      ['content', filters.content || undefined],
      ['include_nsfw', filters.includeNsfw ? true : undefined],
    ]);

    // Fast path: search pages
    try {
      for (let offset = 0; offset < 5000 && lines.length < maxLines; offset += 25) {
        const resp = await fetch(`https://discord.com/api/v10/channels/${ch}/messages/search?${searchQuery(offset)}`, {
          headers: { Authorization: authToken }
        });

        if (resp.status === 202) {
          const body = await resp.json().catch(() => ({}));
          const waitMs = Math.max(500, Math.round((Number(body?.retry_after) || 1) * 1000));
          await wait(waitMs);
          offset -= 25;
          continue;
        }
        if (resp.status === 429) {
          const body = await resp.json().catch(() => ({}));
          const waitMs = Math.max(500, Math.round((Number(body?.retry_after) || 1) * 1000));
          await wait(waitMs);
          offset -= 25;
          continue;
        }

        if (!resp.ok) {
          const body = await resp.clone().json().catch(() => null);
          if (resp.status === 400 && body?.code === 50024) break; // fallback below
          return { lines, truncated, method: `search_error_${resp.status}` };
        }

        const data = await resp.json();
        const groups = Array.isArray(data?.messages) ? data.messages : [];
        if (!groups.length) break;

        const pageMessages = groups
          .map(g => Array.isArray(g) ? g.find((m) => m?.hit === true) : null)
          .filter(Boolean)
          .filter((m) => messageMatchesDeleteFiltersLocal(m, filters, regex));

        for (const msg of pageMessages) {
          lines.push(toLine(msg));
          if (lines.length >= maxLines) {
            truncated = true;
            break;
          }
        }

        if (Number(data?.total_results || 0) <= offset + groups.length) break;
      }

      if (lines.length) return { lines, truncated, method: 'search_pages' };
    } catch {
      // fallback below
    }

    // Fallback: history scan
    let before = null;
    for (let page = 0; page < 5000 && lines.length < maxLines; page++) {
      const qs = queryString([
        ['limit', 100],
        ['before', before || undefined],
      ]);
      const resp = await fetch(`https://discord.com/api/v10/channels/${ch}/messages?${qs}`, {
        headers: { Authorization: authToken }
      });
      if (!resp.ok) {
        if (resp.status === 429) {
          const body = await resp.json().catch(() => ({}));
          const retryAfterMs = Math.max(500, Math.round((Number(body?.retry_after) || 1) * 1000));
          await wait(retryAfterMs);
          continue;
        }
        return { lines, truncated, method: `history_error_${resp.status}` };
      }
      const list = await resp.json();
      const batch = Array.isArray(list) ? list : [];
      if (!batch.length) break;

      for (const msg of batch) {
        if (!messageMatchesDeleteFiltersLocal(msg, filters, regex)) continue;
        lines.push(toLine(msg));
        if (lines.length >= maxLines) {
          truncated = true;
          break;
        }
      }

      before = String(batch[batch.length - 1]?.id || '');
      if (!before) break;
      await wait(120);
    }

    return { lines, truncated, method: 'history_scan' };
  }

  async function debugCurrentChannelDiscovery(guildId, authToken, discoveredChannels) {
    const gid = String(guildId || '').trim();
    const currentChannelId = String(getChannelId({ silent: true }) || '').trim();
    if (!gid || gid === '@me') return;
    if (!currentChannelId) {
      log.warn('debug:current-channel: could not resolve current channel id from URL.');
      return;
    }

    const discoveredSet = new Set((Array.isArray(discoveredChannels) ? discoveredChannels : [])
      .map((x) => String(x?.id || ''))
      .filter(Boolean));
    const isInDiscovered = discoveredSet.has(currentChannelId);
    log.verb(`debug:current-channel id=${currentChannelId} in_discovered=${isInDiscovered ? 'yes' : 'no'}`);
    if (isInDiscovered) {
      const found = discoveredChannels.find((x) => String(x?.id || '') === currentChannelId);
      log.verb('debug:current-channel discovered entry:', found || null);
      return;
    }

    if (!authToken) {
      log.warn('debug:current-channel: missing auth token, cannot run API diagnostics.');
      return;
    }

    let channelMeta = null;
    try {
      const cResp = await fetch(`https://discord.com/api/v10/channels/${currentChannelId}`, {
        headers: { Authorization: authToken }
      });
      if (!cResp.ok) {
        log.warn(`debug:current-channel GET /channels/${currentChannelId} failed with ${cResp.status}`);
      } else {
        const cData = await cResp.json();
        channelMeta = {
          id: String(cData?.id || ''),
          guild_id: String(cData?.guild_id || ''),
          type: Number(cData?.type),
          parent_id: String(cData?.parent_id || ''),
          name: String(cData?.name || ''),
          thread_metadata: cData?.thread_metadata || null,
        };
        log.verb('debug:current-channel meta:', channelMeta);
      }
    } catch (err) {
      log.warn('debug:current-channel meta fetch failed:', err);
    }

    if (channelMeta?.guild_id && channelMeta.guild_id !== gid) {
      log.warn(`debug:current-channel guild mismatch: current=${channelMeta.guild_id} expected=${gid}`);
    }

    const allowedTypes = new Set([0, 5, 10, 11, 12, 13, 15, 16]);
    if (channelMeta && !allowedTypes.has(channelMeta.type)) {
      log.warn(`debug:current-channel filtered by type. type=${channelMeta.type} is not in [0,5,10,11,12,13,15,16].`);
    }

    let guildChannels = [];
    try {
      const gResp = await fetch(`https://discord.com/api/v10/guilds/${gid}/channels`, {
        headers: { Authorization: authToken }
      });
      if (!gResp.ok) {
        log.warn(`debug:current-channel GET /guilds/${gid}/channels failed with ${gResp.status}`);
      } else {
        const data = await gResp.json();
        guildChannels = Array.isArray(data) ? data : [];
      }
    } catch (err) {
      log.warn('debug:current-channel guild channels fetch failed:', err);
    }
    if (guildChannels.length) {
      const inGuildChannels = guildChannels.some((ch) => String(ch?.id || '') === currentChannelId);
      log.verb(`debug:current-channel in guild/channels list: ${inGuildChannels ? 'yes' : 'no'}`);
    }

    try {
      const tResp = await fetch(`https://discord.com/api/v10/guilds/${gid}/threads/active`, {
        headers: { Authorization: authToken }
      });
      if (tResp.ok) {
        const tData = await tResp.json();
        const threads = Array.isArray(tData?.threads) ? tData.threads : [];
        const inActiveThreads = threads.some((th) => String(th?.id || '') === currentChannelId);
        log.verb(`debug:current-channel in guild/threads/active: ${inActiveThreads ? 'yes' : 'no'}`);
      } else {
        log.warn(`debug:current-channel GET /guilds/${gid}/threads/active failed with ${tResp.status}`);
      }
    } catch (err) {
      log.warn('debug:current-channel active threads fetch failed:', err);
    }

    const parentId = String(channelMeta?.parent_id || '');
    if (parentId) {
      const archiveEndpoints = [
        'threads/archived/public',
        'users/@me/threads/archived/private',
        'threads/archived/private',
      ];
      for (const endpoint of archiveEndpoints) {
        try {
          const aResp = await fetch(
            `https://discord.com/api/v10/channels/${parentId}/${endpoint}?limit=100`,
            { headers: { Authorization: authToken } }
          );
          if (!aResp.ok) {
            log.verb(`debug:current-channel parent archive endpoint ${endpoint} status=${aResp.status}`);
            continue;
          }
          const aData = await aResp.json();
          const threads = Array.isArray(aData?.threads) ? aData.threads : [];
          const present = threads.some((th) => String(th?.id || '') === currentChannelId);
          log.verb(`debug:current-channel in ${endpoint}: ${present ? 'yes' : 'no'} (parent=${parentId}, page_size=${threads.length})`);
        } catch (err) {
          log.verb(`debug:current-channel archive endpoint failed (${endpoint}):`, err);
        }
      }
    } else {
      log.verb('debug:current-channel has no parent_id; archive-thread probes skipped.');
    }

    const domIds = getServerChannelIdsFromDom(gid);
    const inDom = domIds.includes(currentChannelId);
    log.verb(`debug:current-channel in DOM sidebar list: ${inDom ? 'yes' : 'no'}`);
  }


	async function fillToken() {
	  try {
	    return await getToken();
	  } catch (err) {
	    // Discord changes frequently; auto token extraction is brittle and may stop working.
	    log.warn('Could not automatically detect Authorization Token (Discord likely changed how it stores/exposes it).');
	    log.info('Please enter the token manually in the "Advanced settings" section.');
	    log.debug('Auto-detection failure details:', err);
	  }
	  return '';
	}

	const PREFIX = '[UNDISCORD]';

	// -------------------------- User interface ------------------------------- //

	// links
	const HOME = 'https://github.com/victornpb/undiscord';
	const WIKI = 'https://github.com/victornpb/undiscord/wiki';

	const undiscordCore = new UndiscordCore();
	messagePicker.init();

	const ui = {
	  undiscordWindow: null,
	  undiscordBtn: null,
	  logArea: null,
	  autoScroll: null,

	  // progress handler
	  progressMain: null,
	  progressIcon: null,
	  progressBarPercent: null,
	  percent: null,

    verboseMode: null,
    previewMode: null,
    hideAuthorText: null,
    hideMessageText: null,
    redact: null,
    channelBadge: null,
    channelName: null,
    convBadge: null,
    convName: null,
    convAvatar: null,
    deleteAllChannels: null,
    preScanStatus: null,
	};
  let hardStopRequested = false;
	const $ = s => ui.undiscordWindow.querySelector(s);

	function initUI() {

	  insertCss(themeCss);
	  insertCss(mainCss);
	  insertCss(dragCss);
    insertCss(undiscordUiCss);

	  // create undiscord window
	  const undiscordUI = replaceInterpolations(undiscordTemplate, {
	    BRAND: BRAND_NAME,
	    AUTHOR: AUTHOR_NAME,
	    VERSION,
	    HOME,
	    WIKI,
	  });
	  ui.undiscordWindow = createElm(undiscordUI);
	  document.body.appendChild(ui.undiscordWindow);

    // ---------- Auto update IDs on conversation change ----------
    function isUndiscordOpen() {
      return ui.undiscordWindow && ui.undiscordWindow.style.display !== 'none';
    }

    let lastRoute = location.pathname;
    let requestButtonRemount = () => {};

    function onConversationChange() {
      const route = location.pathname;
      if (route !== lastRoute) {
        lastRoute = route;
        if (isUndiscordOpen() && !undiscordCore.state.running) {
          safeAutofillFields();
        }
      }
      updateDeleteAllToggleVisibility();
      scheduleConversationBadgeUpdate();
    }


    // Hook navigation SPA Discord
    (function hookDiscordNavigation() {
      const push = history.pushState;
      const replace = history.replaceState;

      history.pushState = function () {
        const r = push.apply(this, arguments);
        queueMicrotask(() => {
          onConversationChange();
          requestButtonRemount();
        });
        return r;
      };

      history.replaceState = function () {
        const r = replace.apply(this, arguments);
        queueMicrotask(onConversationChange);
        return r;
      };

      window.addEventListener('popstate', onConversationChange);
    })();
    const chatObserver = new MutationObserver(() => {
      onConversationChange();
    });

    const appMount = document.querySelector('#app-mount');
    if (appMount) {
      chatObserver.observe(appMount, {
        childList: true,
        subtree: false
      });
    }

	  // enable drag and resize on undiscord window
	  new DragResize({ elm: ui.undiscordWindow, moveHandle: $('.header') });

	  // create undiscord Skull icon
	  ui.undiscordBtn = createElm(buttonHtml);
	  ui.undiscordBtn.onclick = toggleWindow;

    // ====== ROBUST MOUNT (language-free, without patch history) ======
    (function mountUndiscordButtonRobust(btn, onRouteMaybeChanged) {
      const ROOT_SEL = '#app-mount';
      const BTN_ID = 'undicord-btn';

      // Ensure a stable id (useful to avoid duplicates)
      if (!btn.id) btn.id = BTN_ID;

      function isVisible(el) {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0;
      }

      function findTopCombobox() {
        // Discord often has multiple comboboxes. Pick the highest visible one.
        const all = Array.from(document.querySelectorAll(
          `${ROOT_SEL} [role="combobox"][contenteditable="true"]`
        ));
        const visible = all.filter(isVisible);
        if (!visible.length) return null;
        visible.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        return visible[0];
      }

      function findToolbarFrom(el) {
        // Walk up to a "top" container that contains many buttons
        let p = el;
        for (let i = 0; i < 40 && p; i++) {
          if (p.nodeType === 1) {
            const top = p.getBoundingClientRect().top;
            if (top <= 180) {
              const buttons = p.querySelectorAll?.('[role="button"]').length || 0;
              const hasCombo = !!p.querySelector?.('[role="combobox"][contenteditable="true"]');
              // "toolbar" heuristic
              if (buttons >= 3 && hasCombo) return p;
            }
          }
          p = p.parentElement;
        }
        return null;
      }

      function findSearchBlock(combobox, toolbar) {
        // Find a block that contains the combobox + at least 1 svg (search/clear)
        let p = combobox;
        for (let i = 0; i < 18 && p && p !== toolbar; i++) {
          if (toolbar.contains(p)) {
            const hasSvg = !!p.querySelector?.('svg');
            const hasCombo = !!p.querySelector?.('[role="combobox"][contenteditable="true"]');
            if (hasSvg && hasCombo) return p;
          }
          p = p.parentElement;
        }
        return null;
      }

      function ensureMounted() {
        const root = document.querySelector(ROOT_SEL);
        if (!root) return false;

        const combobox = findTopCombobox();
        if (!combobox) return false;

        const toolbar = findToolbarFrom(combobox);
        if (!toolbar) return false;

        // If already in this toolbar, just ensure styling
        if (toolbar.contains(btn)) {
          btn.style.order = '9999';
          btn.style.marginLeft = '8px';
          btn.style.flex = '0 0 auto';
          return true;
        }

        const searchBlock = findSearchBlock(combobox, toolbar);

        // Insert after the most "top-level" search block under the toolbar
        if (searchBlock) {
          let top = searchBlock;
          while (top.parentElement && top.parentElement !== toolbar) top = top.parentElement;
          top.insertAdjacentElement('afterend', btn);
        } else {
          toolbar.appendChild(btn);
        }

        btn.style.order = '9999';
        btn.style.marginLeft = '8px';
        btn.style.flex = '0 0 auto';
        return true;
      }

      // Anti-spam scheduler
      let scheduled = false;
      const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;

          const ok = ensureMounted();
          // Optional: auto-refresh fields when Discord changes view
          if (ok && typeof onRouteMaybeChanged === 'function') onRouteMaybeChanged();
        });
      };
      requestButtonRemount = schedule;

      // Observe DOM (Discord = SPA, everything shows up in the DOM)
      const root = document.querySelector(ROOT_SEL);
      if (!root) return;

      // Broad observer, throttled by schedule()
      const obs = new MutationObserver(schedule);
      obs.observe(root, { childList: true, subtree: true });

      // Initial mount
      schedule();
    })(ui.undiscordBtn, onConversationChange);


    function safeAutofillFields() {
      if (undiscordCore?.state?.running) return;

      try {
        const v = getAuthorId();
        if (v) $('input#authorId').value = v;
      } catch {}

      try {
        const v = getGuildId({ silent: true });
        if (v) $('input#guildId').value = v;
      } catch {}

      try {
        const v = getChannelId({ silent: true });
        if (v) $('input#channelId').value = v;
      } catch {}

      updateDeleteAllToggleVisibility();
    }

    function isVisible(el) {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0;
    }

    function isValidDiscordAvatarUrl(url) {
      if (!url || typeof url !== 'string') return false;
      return /https:\/\/(cdn|media)\.discord(app)?\.com\/(avatars|embed\/avatars|icons|guilds|users)\//.test(url);
    }

    function normalizeConvName(text) {
      return String(text || '')
        .trim();
    }

    function hashToHue(input) {
      const s = String(input || '');
      let h = 0;
      for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h + s.charCodeAt(i)) | 0;
      }
      return Math.abs(h) % 360;
    }

    function makeInitials(label) {
      const text = normalizeConvName(label).replace(/\s+/g, ' ');
      if (!text) return '?';
      // Preserve Discord acronym as-is when available (e.g. "Sdc").
      if (!text.includes(' ') && /^[A-Za-z0-9]{2,4}$/.test(text)) return text;
      const words = text.split(' ').filter(Boolean);
      if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
      const compact = words[0].replace(/[^A-Za-z0-9]/g, '');
      if (!compact) return '?';
      return compact.slice(0, 2).toUpperCase();
    }

    function makeGuildFallbackAvatarDataUrl(label) {
      const initials = makeInitials(label);
      const hue = hashToHue(label || initials);
      const bg1 = `hsl(${hue}, 68%, 40%)`;
      const bg2 = `hsl(${(hue + 28) % 360}, 65%, 30%)`;
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
        `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0%" stop-color="${bg1}"/><stop offset="100%" stop-color="${bg2}"/></linearGradient></defs>` +
        `<rect width="64" height="64" rx="32" fill="url(#g)"/>` +
        `<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,Arial" font-size="24" font-weight="700" fill="white">${escapeHTML(initials)}</text>` +
        `</svg>`;
      return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function parseGuildIdFromListItemId(listItemId) {
      const m = String(listItemId || '').match(/^guildsnav___(\d+)$/);
      return m ? m[1] : '';
    }

    function getGuildInfoFromNavItem(item) {
      if (!item) return { guildId: '', name: '', avatar: '' };

      const guildId = parseGuildIdFromListItemId(item.getAttribute('data-list-item-id'));
      if (!guildId) return { guildId: '', name: '', avatar: '' };

      const hidden = item.querySelector('.hiddenVisually_b18fe2');
      const dnd = item.closest('[data-dnd-name]')?.getAttribute('data-dnd-name') || '';
      const name = normalizeConvName(hidden?.textContent || dnd || '');
      const acronym = normalizeConvName(
        item.querySelector('[class*="acronym"]')?.textContent || ''
      );

      const img = item.querySelector('img.icon__6e9f8, img[aria-hidden="true"]');
      const avatar = img?.src && isValidDiscordAvatarUrl(img.src)
        ? img.src
        // Prefer Discord's displayed acronym (e.g. "Sdc") when no icon exists.
        : makeGuildFallbackAvatarDataUrl(acronym || name || guildId);

      return { guildId, name: isGenericConversationLabel(name) ? '' : name, avatar };
    }

    function getSelectedGuildInfoFromNav() {
      const selected = Array.from(document.querySelectorAll(
        '#app-mount [data-list-item-id^="guildsnav___"][aria-selected="true"]'
      )).find((el) => !!parseGuildIdFromListItemId(el.getAttribute('data-list-item-id')));

      return getGuildInfoFromNavItem(selected);
    }

    function getGuildInfoFromNavById(guildId) {
      const gid = String(guildId || '').trim();
      if (!gid || gid === '@me') return { guildId: '', name: '', avatar: '' };

      const item = document.querySelector(
        `#app-mount [data-list-item-id="guildsnav___${gid}"]`
      );
      return getGuildInfoFromNavItem(item);
    }

    function isGenericConversationLabel(text) {
      const t = normalizeConvName(text);
      return !t || /^[#@]?$/.test(t) || /^\d+$/.test(t);
    }

    function extractNameFromContainer(container) {
      if (!container) return '';
      const nameHost = container.querySelector('[class*="name__"] [class*="overflowTooltip"]')
        || container.querySelector('[class*="overflowTooltip"]')
        || container.querySelector('[data-text-variant]')
        || container;
      if (!nameHost) return '';

      const clone = nameHost.cloneNode(true);
      clone.querySelectorAll(
        '[class*="chiplet"], [class*="clanTag"], [class*="tagText"], [class*="badge"], [class*="hiddenVisually"], img, svg'
      ).forEach(n => n.remove());

      const name = normalizeConvName(clone.textContent || '');
      return isGenericConversationLabel(name) ? '' : name;
    }

    function getConversationInfoFromDom(channelId, guildId) {
      let name = '';
      let avatar = '';

      // For guilds, use server icon as avatar but keep channel name as title.
      if (guildId && guildId !== '@me') {
        const byId = getGuildInfoFromNavById(guildId);
        if (byId.avatar) avatar = byId.avatar;

        // Fallback: selected guild entry if direct lookup misses temporarily.
        if (!avatar) {
          const selected = getSelectedGuildInfoFromNav();
          if (selected.guildId === String(guildId)) {
            if (!avatar && selected.avatar) avatar = selected.avatar;
          }
        }
      }

      const header = Array.from(document.querySelectorAll('#app-mount header')).find(isVisible) || null;
      if (header) {
        // Prefer DM header content first to avoid generic header fallback while scrolling.
        const dmTitle = header.querySelector('.children__9293f .titleWrapper__9293f h1 span:not([class*="hiddenVisually"])')
          || header.querySelector('[class*="children__"] [class*="titleWrapper__"] h1 span:not([class*="hiddenVisually"])');
        if (dmTitle) {
          const dmName = normalizeConvName(dmTitle.textContent || '');
          if (!isGenericConversationLabel(dmName)) name = dmName;
        }
        const dmAvatar = header.querySelector('.children__9293f [class*="avatarStack"] img')
          || header.querySelector('[class*="children__"] [class*="avatarStack"] img');
        if (dmAvatar?.src && isValidDiscordAvatarUrl(dmAvatar.src)) avatar = dmAvatar.src;

        const heading = header.querySelector('h1, h2, [role="heading"]');
        if (!name) name = extractNameFromContainer(heading || header);
      }

      // Try exact conversation row from sidebar (works without token in many layouts)
      if ((!name || !avatar) && channelId) {
        const hrefPart = `/channels/${guildId || '@me'}/${channelId}`;
        const row = Array.from(document.querySelectorAll(`#app-mount a[href*="${hrefPart}"]`)).find(isVisible) || null;
        if (row) {
          name = name || extractNameFromContainer(row);
          const rowImg = Array.from(row.querySelectorAll('img')).find(i => isValidDiscordAvatarUrl(i.src));
          if (rowImg?.src) avatar = avatar || rowImg.src;
        }
      }

      if (!name) {
        const selected = Array.from(document.querySelectorAll('#app-mount [aria-selected="true"]')).find(isVisible) || null;
        if (selected) {
          name = extractNameFromContainer(selected);

          const img = Array.from(selected.querySelectorAll('img')).find(i => isValidDiscordAvatarUrl(i.src));
          if (img?.src) avatar = img.src;
        }
      }

      if (!avatar) {
        const header = Array.from(document.querySelectorAll('#app-mount header')).find(isVisible) || null;
        const img = header ? Array.from(header.querySelectorAll('img')).find(i => isValidDiscordAvatarUrl(i.src)) : null;
        if (img?.src) avatar = img.src;
      }

      return { name, avatar };
    }

    function getChannelNameFromSidebarById(channelId, guildId) {
      const cid = String(channelId || '').trim();
      if (!cid) return '';
      const gid = String(guildId || '').trim();
      const selectors = [
        `#app-mount a[data-list-item-id="channels___${cid}"]`,
        gid ? `#app-mount a[href="/channels/${gid}/${cid}"]` : '',
      ].filter(Boolean);
      for (const selector of selectors) {
        const anchor = document.querySelector(selector);
        if (!anchor) continue;
        const nameNode = anchor.querySelector('[class*="name__2ea32"], [class*="name__"]');
        const name = normalizeConvName(nameNode?.textContent || '');
        if (name && !isGenericConversationLabel(name)) return name;
      }
      return '';
    }

    function getAuthTokenForConv() {
      try {
        const v = $('input#token')?.value?.trim();
        if (v) return v;
      } catch {}
      try {
        const v = undiscordCore?.options?.authToken;
        if (typeof v === 'string' && v.trim()) return v.trim();
      } catch {}
      return '';
    }

    async function fetchSelfUserId(token) {
      const r = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: token }
      });
      if (!r.ok) throw new Error('GET /users/@me failed: ' + r.status);
      const me = await r.json();
      return me?.id || '';
    }

    function cdnDefaultAvatarUrl(userId, discriminator, size = 32) {
      try {
        const disc = String(discriminator ?? '0');
        if (disc === '0') {
          const mod = Number(BigInt(userId) >> 22n) % 6;
          return `https://cdn.discordapp.com/embed/avatars/${mod}.png?size=${size}`;
        }
        const idx = parseInt(disc, 10) % 5;
        return `https://cdn.discordapp.com/embed/avatars/${idx}.png?size=${size}`;
      } catch {
        return `https://cdn.discordapp.com/embed/avatars/0.png?size=${size}`;
      }
    }

    const convCache = new Map();
    let convFetchPromise = null;
    async function fetchConversationInfoFromApi(channelId) {
      const token = getAuthTokenForConv();
      if (!token || !channelId) return null;
      const key = `ch:${channelId}`;
      if (convCache.has(key)) return convCache.get(key);
      if (convFetchPromise) return convFetchPromise;

      convFetchPromise = (async () => {
        try {
          const [chResp, selfId] = await Promise.all([
            fetch(`https://discord.com/api/v10/channels/${channelId}`, { headers: { Authorization: token } }),
            fetchSelfUserId(token)
          ]);
          if (!chResp.ok) return null;
          const data = await chResp.json();
          const recips = Array.isArray(data?.recipients) ? data.recipients : [];
          let other = null;
          if (selfId) other = recips.find(r => r?.id && r.id !== selfId) || null;
          if (!other && recips.length) other = recips[0];

          const name = normalizeConvName(other?.global_name || other?.username || data?.name || '');
          let avatar = '';
          if (other?.id) {
            if (other?.avatar) {
              const ext = String(other.avatar).startsWith('a_') ? 'gif' : 'png';
              avatar = `https://cdn.discordapp.com/avatars/${other.id}/${other.avatar}.${ext}?size=32`;
            } else {
              avatar = cdnDefaultAvatarUrl(other.id, other?.discriminator ?? '0', 32);
            }
          }
          const info = { name, avatar };
          convCache.set(key, info);
          return info;
        } catch {
          return null;
        } finally {
          convFetchPromise = null;
        }
      })();

      return convFetchPromise;
    }

    const convStable = { name: '', avatar: '' };
    let badgeTimer = null;
    let lastBadgeRunAt = 0;
    const BADGE_MIN_INTERVAL_MS = 250;
    let lastBadgeWarnNoTokenAt = 0;
    function scheduleConversationBadgeUpdate(delayMs = 0) {
      clearTimeout(badgeTimer);
      badgeTimer = setTimeout(() => {
        const elapsed = Date.now() - lastBadgeRunAt;
        if (elapsed < BADGE_MIN_INTERVAL_MS) {
          return scheduleConversationBadgeUpdate(BADGE_MIN_INTERVAL_MS - elapsed);
        }
        lastBadgeRunAt = Date.now();
        updateConversationBadgeNow();
      }, Math.max(0, delayMs));
    }

    function updateConversationBadgeNow() {
      if (!ui.channelBadge || !ui.channelName || !ui.convBadge || !ui.convName || !ui.convAvatar) return;

      const inputChannelId = $('input#channelId')?.value?.trim() || getChannelId({ silent: true }) || '';
      const runningChannelId = undiscordCore?.state?.running
        ? String(undiscordCore?.options?.channelId || '').trim()
        : '';
      const activeChannelId = runningChannelId || inputChannelId;
      const guildId = $('input#guildId')?.value?.trim() || getGuildId({ silent: true }) || '';
      const isDm = guildId === '@me';
      const deleteAllChannels = !isDm && !!ui.deleteAllChannels?.checked;

      if (!activeChannelId && !guildId) {
        ui.channelBadge.style.display = 'none';
        ui.convBadge.style.display = 'none';
        return;
      }

      if (!isDm) {
        const guildInfo = getGuildInfoFromNavById(guildId) || { name: '', avatar: '' };
        const guildName = normalizeConvName(guildInfo?.name || '');
        const serverName = guildName || `Server ${guildId}`;
        const serverAvatar = guildInfo?.avatar || makeGuildFallbackAvatarDataUrl(serverName || guildId || 'Server');

        ui.convBadge.style.display = '';
        ui.convName.textContent = serverName;
        ui.convAvatar.src = serverAvatar;
        ui.convAvatar.style.display = '';

        if (deleteAllChannels) {
          ui.channelBadge.style.display = 'none';
        } else {
          const channelNameFromSidebar = getChannelNameFromSidebarById(activeChannelId, guildId);
          const channelNameFromDom = getConversationInfoFromDom(activeChannelId, guildId)?.name || '';
          const channelName = channelNameFromSidebar || channelNameFromDom || (activeChannelId ? `Channel ${activeChannelId}` : 'Current channel');
          if (channelName) {
            ui.channelBadge.style.display = '';
            ui.channelName.textContent = channelName;
          } else {
            ui.channelBadge.style.display = 'none';
          }
        }
        return;
      }

      ui.channelBadge.style.display = 'none';
      const dmDom = getConversationInfoFromDom(activeChannelId, guildId);
      const dmName = dmDom?.name || convStable.name || 'DM';
      const dmAvatar = dmDom?.avatar || convStable.avatar || '';

      ui.convBadge.style.display = '';
      ui.convName.textContent = dmName;
      if (dmAvatar) {
        ui.convAvatar.src = dmAvatar;
        ui.convAvatar.style.display = '';
      } else {
        ui.convAvatar.style.display = 'none';
      }
      if (dmName) convStable.name = dmName;
      if (dmAvatar) convStable.avatar = dmAvatar;

      const token = getAuthTokenForConv();
      if (!token) {
        const now = Date.now();
        if (now - lastBadgeWarnNoTokenAt > 15000) {
          lastBadgeWarnNoTokenAt = now;
          log.warn('conv:badge:no-token');
        }
        return;
      }
      fetchConversationInfoFromApi(activeChannelId).then((info) => {
        if (!info) return;
        const nextName = info.name || ui.convName.textContent || 'DM';
        ui.convName.textContent = nextName;
        if (info.avatar) {
          ui.convAvatar.src = info.avatar;
          ui.convAvatar.style.display = '';
        }
        convStable.name = nextName;
        if (info.avatar) convStable.avatar = info.avatar;
      });
    }


    function toggleWindow() {
      const isOpen = ui.undiscordWindow.style.display !== 'none';

      if (isOpen) {
        ui.undiscordWindow.style.display = 'none';
        ui.undiscordBtn.style.color = '';
      } else {
        ui.undiscordWindow.style.display = '';
        ui.undiscordBtn.style.color = '#ff2a44';
        playIntro();

        // Auto-fill only on open, and only if not running
        safeAutofillFields();
        scheduleConversationBadgeUpdate();
      }
    }


	  // cached elements
	  ui.logArea = $('#logArea');
	  ui.autoScroll = $('#autoScroll');
	  ui.progressMain = $('#progressBar');
	  ui.progressIcon = ui.undiscordBtn.querySelector('progress');
	  ui.progressBarPercent = $('#progressBarPercent');
	  ui.percent = $('#progressPercent');
    ui.verboseMode = $('#verboseMode');
    ui.previewMode = $('#previewMode');
    ui.hideAuthorText = $('#hideAuthorText');
    ui.hideMessageText = $('#hideMessageText');
    ui.redact = $('#redact');
    ui.channelBadge = $('#channelBadge');
    ui.channelName = $('#channelName');
    ui.convBadge = $('#convBadge');
    ui.convName = $('#convName');
    ui.convAvatar = $('#convAvatar');
    ui.deleteAllChannels = $('#deleteAllChannels');
    ui.preScanStatus = $('#preScanStatus');

    function updateDeleteAllToggleVisibility() {
      const guildId = $('input#guildId')?.value?.trim() || getGuildId({ silent: true }) || '';
      const isServer = !!guildId && guildId !== '@me';
      const wrap = ui.deleteAllChannels?.closest('.allChannelsToggle');
      if (!wrap) return;
      wrap.style.display = isServer ? '' : 'none';
      if (!isServer && ui.deleteAllChannels?.checked) {
        ui.deleteAllChannels.checked = false;
      }
    }

    ui.deleteAllChannels?.addEventListener('change', () => {
      scheduleConversationBadgeUpdate();
    });
    updateDeleteAllToggleVisibility();

    function applyVerboseUI() {
      const on = !!ui.verboseMode.checked;
      ui.undiscordWindow.classList.toggle('verbose', on);
      renderLogsForMode(on ? 'verbose' : 'compact');
      if (ui.autoScroll?.checked) {
        // Wait for render + style recalculation, then snap to bottom reliably.
        requestAnimationFrame(() => requestAnimationFrame(() => scrollLogToBottom({ smooth: true })));
      }
    }
    ui.verboseMode.onchange = applyVerboseUI;
    applyVerboseUI();
    scheduleConversationBadgeUpdate();
    setInterval(() => {
      if (ui.undiscordWindow?.style?.display !== 'none' && undiscordCore?.state?.running) {
        scheduleConversationBadgeUpdate();
      }
    }, 500);



	  // register event listeners
	  $('#hide').onclick = (e) => { e.stopPropagation(); if (IS_APP === 'android') reaperQuit(); else toggleWindow(); };
	  $('#toggleSidebar').onclick = ()=> ui.undiscordWindow.classList.toggle('hide-sidebar');
	  $('button#start').onclick = startAction;
	  $('button#stop').onclick = stopAction;
	  $('button#clear').onclick = () => {
      ui.logArea.innerHTML = '';
      logStore.compact = [];
      logStore.verbose = [];
    };
	  $('button#getAuthor').onclick = () => $('input#authorId').value = getAuthorId();
    $('button#getGuild').onclick = () => {
      const guildInput = $('input#guildId');
      const channelInput = $('input#channelId');

      const g = getGuildId(); // already shows alert if not found
      if (g) {
        guildInput.value = g;
        if (g === '@me') {
          const c = getChannelId(); // already shows alert if not found
          if (c) channelInput.value = c;
        }
        updateDeleteAllToggleVisibility();
        scheduleConversationBadgeUpdate();
      }
    };

    $('button#getChannel').onclick = () => {
      const guildInput = $('input#guildId');
      const channelInput = $('input#channelId');

      const c = getChannelId(); // already shows alert if not found
      if (c) channelInput.value = c;

      const g = getGuildId(); // already shows alert if not found
      if (g) guildInput.value = g;
      updateDeleteAllToggleVisibility();
      scheduleConversationBadgeUpdate();
    };

    let savedHideAuthor = false;
    let savedHideMessage = false;
    function applyRedactInputs(on) {
      const ids = ['authorId', 'guildId', 'channelId'];
      for (const id of ids) {
        const input = $(`input#${id}`);
        if (!input) continue;
        if (on) {
          input.dataset.udPrevType = input.dataset.udPrevType || input.type || 'text';
          input.type = 'password';
        } else if (input.dataset.udPrevType) {
          input.type = input.dataset.udPrevType;
        }
      }
    }
    function applyRedactUI() {
      const on = !!ui.redact?.checked;
      ui.undiscordWindow.classList.toggle('redact', on);

      if (on) {
        savedHideAuthor = !!ui.hideAuthorText?.checked;
        savedHideMessage = !!ui.hideMessageText?.checked;
        if (ui.hideAuthorText) {
          ui.hideAuthorText.checked = true;
          ui.hideAuthorText.disabled = true;
        }
        if (ui.hideMessageText) {
          ui.hideMessageText.checked = true;
          ui.hideMessageText.disabled = true;
        }
      } else {
        if (ui.hideAuthorText) {
          ui.hideAuthorText.disabled = false;
          ui.hideAuthorText.checked = savedHideAuthor;
        }
        if (ui.hideMessageText) {
          ui.hideMessageText.disabled = false;
          ui.hideMessageText.checked = savedHideMessage;
        }
      }

      applyRedactInputs(on);
      applyPrivacyUI();

      // Re-render logs so verbose lines get redacted immediately.
      const mode = ui.verboseMode?.checked ? 'verbose' : 'compact';
      renderLogsForMode(mode);
      if (ui.autoScroll?.checked) {
        requestAnimationFrame(() => scrollLogToBottom({ smooth: true }));
      }
    }
	  ui.redact.onchange = () => {
	    if (!ui.redact.checked) {
        udToast('Streamer mode is OFF. Sensitive info may be visible.\nDouble check before sharing your screen.', { type: 'warn', ms: 6000 });
      }
      applyRedactUI();
	  };
    function applyPrivacyUI() {
      const hideAuthorText = !!ui.hideAuthorText?.checked;
      const hideMessageText = !!ui.hideMessageText?.checked;
      ui.undiscordWindow.classList.toggle('hide-author', hideAuthorText);
      ui.undiscordWindow.classList.toggle('hide-text', hideMessageText);

      // Chrome does not consistently support -webkit-text-security on inputs;
      // switching the input type is reliable across browsers.
      try {
        const authorInput = $('input#authorId');
        if (authorInput) {
          if (hideAuthorText) {
            authorInput.dataset.udAuthorType = authorInput.dataset.udAuthorType || authorInput.type || 'text';
            authorInput.type = 'password';
          } else {
            authorInput.type = authorInput.dataset.udAuthorType || 'text';
          }
        }
      } catch {}
    }

    ui.hideAuthorText?.addEventListener('change', applyPrivacyUI);
    ui.hideMessageText?.addEventListener('change', applyPrivacyUI);
    applyPrivacyUI();
    applyRedactUI();

	  $('#pickMessageAfter').onclick = async () => {
	    udToast('Click a message in the chat.\nMessages AFTER it will be targeted.', { ms: 6000 });
	    toggleWindow();
	    const id = await messagePicker.grab('after');
	    if (id) $('input#minId').value = id;
	    toggleWindow();
	  };
	  $('#pickMessageBefore').onclick = async () => {
	    udToast('Click a message in the chat.\nMessages BEFORE it will be targeted.', { ms: 6000 });
	    toggleWindow();
	    const id = await messagePicker.grab('before');
	    if (id) $('input#maxId').value = id;
	    toggleWindow();
	  };
	  $('button#getToken').onclick = async () => {
	    $('input#token').value = await fillToken();
      scheduleConversationBadgeUpdate();
	  };

	  // sync delays
	  $('input#searchDelay').onchange = (e) => {
	    const v = parseInt(e.target.value);
	    if (v) undiscordCore.options.searchDelay = v;
	  };
	  $('input#deleteDelay').onchange = (e) => {
	    const v = parseInt(e.target.value);
	    if (v) undiscordCore.options.deleteDelay = v;
	  };

	  $('input#searchDelay').addEventListener('input', (event) => {
	    $('div#searchDelayValue').textContent = event.target.value + 'ms';
	  });
	  $('input#deleteDelay').addEventListener('input', (event) => {
	    $('div#deleteDelayValue').textContent = event.target.value + 'ms';
	  });

	  // import json
	  const fileSelection = $('input#importJsonInput');
	  fileSelection.onchange = async () => {
	    const files = fileSelection.files;

	    // No files added
	    if (files.length === 0) return log.warn('No file selected.');

	    // Get channel id field to set it later
	    const channelIdField = $('input#channelId');

	    // Force the guild id to be ourself (@me)
	    const guildIdField = $('input#guildId');
	    guildIdField.value = '@me';

	    // Set author id in case its not set already
	    $('input#authorId').value = getAuthorId();
	    try {
	      const file = files[0];
	      const text = await file.text();
	      const json = JSON.parse(text);
	      const channelIds = Object.keys(json);
	      channelIdField.value = channelIds.join(',');
	      log.info(`Loaded ${channelIds.length} channels.`);
	    } catch(err) {
	      log.error('Error parsing file!', err);
	    }
	  };

	  // ---- Reaper extras wiring ----
	  document.addEventListener('keydown', (e) => {
	    if (e.code === 'KeyX' && e.shiftKey && (e.ctrlKey || e.metaKey) && !e.altKey) {
	      if (document.getElementById('ud-overlay')) return;
	      e.preventDefault();
	      e.stopPropagation();
	      toggleWindow();
	    }
	  }, true);
	  setupReaperControls();
	  setupMobile(toggleWindow);
	  startIconGlitchLoop();

	  // redirect console logs to inside the window after setting up the UI
	  setLogFn(printLog);

	  setupUndiscordCore();
	}

  function getAvatarURL(author) {
    try {
      const id = author?.id;
      const avatar = author?.avatar;
      const disc = parseInt(author?.discriminator || '0', 10);

      // security: only real Discord ids and avatar hashes are put into the URL (pen test 2026-11-11:
      // a crafted avatar value could break out of the <img src="..."> attribute in the log and run code)
      if (id && avatar && /^\d{5,25}$/.test(String(id)) && /^(a_)?[0-9a-f]{32}$/i.test(String(avatar))) {
        // png is OK; you can use .webp too
        return `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=32`;
      }
      // fallback Discord default avatar
      return `https://cdn.discordapp.com/embed/avatars/${(disc % 5)}.png`;
    } catch {
      return `https://cdn.discordapp.com/embed/avatars/0.png`;
    }
  }

  function formatArgs(args) {
    return Array.from(args).map(o =>
      typeof o === 'object'
        ? JSON.stringify(o, o instanceof Error && Object.getOwnPropertyNames(o))
        : String(o)
    ).join('\t');
  }

  function getCurrentAuthorId() {
    try {
      const v = $('input#authorId')?.value?.trim();
      if (v) return v;
    } catch {}
    try {
      const v = undiscordCore?.options?.authorId;
      if (typeof v === 'string' && v.trim()) return v.trim();
    } catch {}
    return '';
  }

  function getCurrentGuildId() {
    try {
      const v = $('input#guildId')?.value?.trim();
      if (v) return v;
    } catch {}
    try {
      const v = undiscordCore?.options?.guildId;
      if (typeof v === 'string' && v.trim()) return v.trim();
    } catch {}
    return '';
  }

  function getCurrentChannelId() {
    try {
      const v = $('input#channelId')?.value?.trim();
      if (v) return v;
    } catch {}
    try {
      const v = undiscordCore?.options?.channelId;
      if (typeof v === 'string' && v.trim()) return v.trim();
    } catch {}
    return '';
  }

  function redactSensitiveInText(text) {
    let result = escapeHTML(text || '');
    const ids = [getCurrentAuthorId(), getCurrentGuildId(), getCurrentChannelId()].filter(Boolean);
    for (const id of ids) {
      const safe = escapeHTML(id);
      if (safe) result = result.split(safe).join('[hidden]');
    }
    return result;
  }

  function renderWithAuthorIdSpans(text) {
    const id = getCurrentAuthorId();
    if (!id) return escapeHTML(text || '');
    const raw = String(text || '');
    const parts = raw.split(id);
    if (parts.length === 1) return escapeHTML(raw);
    const redaction = `<span class="authorText authorId">${escapeHTML(id)}</span><span class="authorHidden authorId">[hidden]</span>`;
    return parts.map(p => escapeHTML(p)).join(redaction);
  }

  function scrollLogToBottom({ smooth = false } = {}) {
    if (!ui?.logArea) return;
    const top = ui.logArea.scrollHeight;
    if (smooth && typeof ui.logArea.scrollTo === 'function') {
      ui.logArea.scrollTo({ top, behavior: 'smooth' });
    } else {
      ui.logArea.scrollTop = top;
    }
  }

  // PATCH: only auto-load media hosted on Discord's own CDN (no third-party requests)
  const DISCORD_MEDIA_HOST_RE = /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\//i;

  function appendCompactLog(entry) {
    const payload = entry.args[0] || {};
    const avatarUrl = getAvatarURL(payload.author);
    const ts = payload.timestamp ? new Date(payload.timestamp) : entry.time;
    const time = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const date = ts.toLocaleDateString();
    const tag = payload.author ? (payload.author.global_name || payload.author.username || 'Unknown') : 'Unknown';
    const meta = payload.meta || '';
    const showChannel = !!payload.showChannel;
    const channelLabel = String(payload.channelName || payload.channelId || '').trim();
    const channelHtml = showChannel && channelLabel
      ? `<span class="lineChannel">#${escapeHTML(channelLabel)}</span>`
      : '';
    const content = payload.content || '';
    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    const embeds = Array.isArray(payload.embeds) ? payload.embeds : [];

    const mediaCandidates = [];
    const seen = new Set();
    const addCandidate = (urlRaw, contentType = '', filename = 'file') => {
      const url = String(urlRaw || '').trim();
      if (!url) return;
      if (!DISCORD_MEDIA_HOST_RE.test(url)) return; // PATCH
      if (seen.has(url)) return;
      seen.add(url);
      mediaCandidates.push({ url, contentType: String(contentType || '').toLowerCase(), filename: String(filename || 'file') });
    };

    for (const a of attachments) {
      addCandidate(a?.proxy_url || a?.url, a?.content_type, a?.filename || 'file');
    }

    for (const e of embeds) {
      // Prefer Discord's proxied copies of embed media when available.
      addCandidate(
        e?.video?.proxy_url || e?.image?.proxy_url || e?.thumbnail?.proxy_url ||
        e?.video?.url || e?.image?.url || e?.thumbnail?.url || e?.url,
        e?.type || '', e?.title || e?.provider?.name || 'embed'
      );
    }

    const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
    const contentUrls = String(content).match(urlRegex) || [];
    for (const u of contentUrls) {
      addCandidate(u, '', 'link');
    }

    const mediaHtml = mediaCandidates.map((m) => {
      const srcRaw = m.url;
      const src = escapeHTML(srcRaw);
      const ct = m.contentType;
      const name = escapeHTML(m.filename);
      const rawName = String(m.filename || '').toLowerCase();
      const lowerUrl = srcRaw.toLowerCase();

      const isImage = ct.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(lowerUrl);
      const isVideo = ct.startsWith('video/') || ct === 'gifv' || /\.(mp4|webm|mov|m4v|avi|mkv)(\?|$)/.test(lowerUrl);
      const isAudio = ct.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac)(\?|$)/.test(lowerUrl);
      const isGifLikeVideo = isVideo && (
        ct === 'gifv' ||
        /\.gifv?(\?|$)/.test(lowerUrl) ||
        rawName.includes('gif') ||
        /(?:^|\/\/)(?:media\.)?tenor\.com\//.test(lowerUrl)
      );

      if (isImage) return `<img src="${src}" alt="${name}">`;
      if (isGifLikeVideo) return `<video autoplay loop muted playsinline preload="metadata" src="${src}"></video>`;
      if (isVideo) return `<video controls preload="metadata" src="${src}"></video>`;
      if (isAudio) return `<audio controls preload="metadata" src="${src}"></audio>`;
      return '';
    }).filter(Boolean).join('');

    const visibleText = content.trim();
    const hasOnlyUrls = visibleText.length > 0 && visibleText.replace(urlRegex, '').trim() === '';
    const hideUrlTextBecauseMediaIsRendered = !!mediaHtml && hasOnlyUrls;
    const textHtml = hideUrlTextBecauseMediaIsRendered
      ? ''
      : (visibleText ? escapeHTML(visibleText) : (mediaHtml ? '' : '[no text]'));
    const attachmentsHtml = mediaHtml ? `<div class="attachments">${mediaHtml}</div>` : '';
    // NOTE: logArea is a <pre>; avoid whitespace/newlines which render as extra gaps.
    ui.logArea.insertAdjacentHTML(
      'beforeend',
      `<div class="log log-del${entry.fresh ? ' fresh' : ''}"><div class="stamp"><div class="date"><span class="d">${escapeHTML(date)}</span><span class="t">${escapeHTML(time)}</span></div></div><img class="authorAvatar" src="${escapeHTML(avatarUrl)}" alt=""><div class="txt"><div class="head"><div class="author"><span class="authorText">${escapeHTML(tag)}</span><span class="authorHidden">[hidden]</span></div>${channelHtml}</div><div class="content"><span class="msgText">${textHtml}</span><span class="msgHidden">[hidden]</span>${attachmentsHtml}</div></div><div class="meta">☠ ${escapeHTML(meta)}</div></div>`
    );
  }

  function appendVerboseLog(entry) {
    const time = entry.time.toLocaleTimeString([], { hour12: false });
    const badge = entry.type || 'log';
    const authorId = entry.args[0]?.author?.id || '';
    const authorIdHtml = authorId
      ? ` <span class="authorText authorId">(${escapeHTML(authorId)})</span><span class="authorHidden authorId">(hidden)</span>`
      : '';
    const msgHtml = entry.type === 'del'
      ? `<span class="vmeta">${escapeHTML(entry.args[0]?.meta || 'Deleted')}</span>${authorIdHtml} — <span class="msgText">${escapeHTML(entry.args[0]?.content || '')}</span><span class="msgHidden">[hidden]</span>`
      : (ui.redact?.checked ? redactSensitiveInText(formatArgs(entry.args)) : renderWithAuthorIdSpans(formatArgs(entry.args)));

    // NOTE: logArea is a <pre>; avoid whitespace/newlines which render as extra gaps.
    ui.logArea.insertAdjacentHTML(
      'beforeend',
      `<div class="log log-vrow log-${escapeHTML(entry.type)}"><div class="vtime">${escapeHTML(time)}</div><div class="vbadge">${escapeHTML(badge)}</div><div class="vmsg">${msgHtml}</div></div>`
    );
  }

  function appendCompactTextLog(entry) {
    const time = entry.time.toLocaleTimeString([], { hour12: false });
    const type = String(entry.type || 'info');
    const msg = ui.redact?.checked
      ? redactSensitiveInText(formatArgs(entry.args))
      : renderWithAuthorIdSpans(formatArgs(entry.args));
    ui.logArea.insertAdjacentHTML(
      'beforeend',
      `<div class="log log-${escapeHTML(type)}">[${escapeHTML(time)}] ${msg}</div>`
    );
  }

  function appendCompactEntry(entry) {
    if (entry.type === 'del') appendCompactLog(entry);
    else appendCompactTextLog(entry);
  }

    function renderLogsForMode(mode) {
    ui.logArea.innerHTML = '';
    const entries = logStore[mode] || [];
    for (const entry of entries) {
      if (mode === 'verbose') appendVerboseLog(entry);
      else if (entry.type === 'del') appendCompactEntry(entry);
    }
  }

  function printLog(type = '', args) {
    const entry = { type, args: Array.from(args), time: new Date() };
    logStore.verbose.push(entry);
    logStore.compact.push(entry);

    const isVerbose = !!ui.verboseMode?.checked;
    if (isVerbose) {
      appendVerboseLog(entry);
    } else {
      // Compact mode shows only deletion cards.
      if (type === 'del') {
        entry.fresh = true;
        appendCompactEntry(entry);
        entry.fresh = false; // re-renders (mode switch) shouldn't flash again
        animateNewCard();
      }
    }

    if (ui.autoScroll.checked) scrollLogToBottom();
    if (type === 'error') console.error(PREFIX, ...Array.from(args));
  }


function setupUndiscordCore() {
    let progressTicker = null;
    let lastKillCount = 0;
    function setKillCount(n) {
      const el = $('#killCount');
      if (!el) return;
      const v = Math.max(0, Number(n) || 0);
      el.querySelector('b').textContent = String(v);
      if (v > lastKillCount) {
        el.classList.remove('bump');
        void el.offsetWidth; // restart animation
        el.classList.add('bump');
      }
      lastKillCount = v;
    }
    let displayedRemainingMs = 0;
    let lastRemainingUiUpdateTs = 0;

    function setPreScanStatus(text = '') {
      if (!ui.preScanStatus) return;
      const value = String(text || '');
      ui.preScanStatus.style.display = value ? 'block' : 'none';
      ui.preScanStatus.textContent = value;
    }

    function setMainProgressVisibility(show) {
      const display = show ? 'block' : 'none';
      ui.progressMain.style.display = display;
      ui.progressBarPercent.style.display = display;
      ui.percent.style.display = display;
    }

    function getUiStableRemaining(rawRemainingMs) {
      const now = Date.now();
      const raw = Math.max(0, Number(rawRemainingMs) || 0);

      if (!displayedRemainingMs) {
        displayedRemainingMs = raw;
        lastRemainingUiUpdateTs = now;
      }

      const elapsedSinceUiUpdate = now - lastRemainingUiUpdateTs;
      const minUiIntervalMs = 1800; // avoid visual jitter
      const significantDelta = Math.max(5000, displayedRemainingMs * 0.10);
      const shouldUpdate =
        elapsedSinceUiUpdate >= minUiIntervalMs ||
        Math.abs(raw - displayedRemainingMs) >= significantDelta;

      if (shouldUpdate) {
        const alpha = raw > displayedRemainingMs ? 0.22 : 0.35;
        displayedRemainingMs = displayedRemainingMs + ((raw - displayedRemainingMs) * alpha);

        const step =
          displayedRemainingMs >= 3600000 ? 60000 :
          displayedRemainingMs >= 600000 ? 30000 :
          displayedRemainingMs >= 120000 ? 10000 : 5000;

        displayedRemainingMs = Math.max(0, Math.round(displayedRemainingMs / step) * step);
        lastRemainingUiUpdateTs = now;
      }

      return displayedRemainingMs;
    }

    function renderProgress(state, stats) {
      const usingBatch = !!state._batchActive;
      const value = usingBatch
        ? (state._batchDelCount + state._batchFailCount)
        : (state.delCount + state.failCount);
      let max = usingBatch
        ? Math.max(0, state._batchGrandTotal)
        : Math.max(0, state.grandTotal - (state._skippedUniqueCount || 0));
      max = Math.max(max, value, 0);

      const percent = value >= 0 && max ? Math.round(value / max * 100) + '%' : '';
      const elapsedMs = stats?.startTime ? (Date.now() - stats.startTime.getTime()) : 0;
      const elapsed = msToHMS(Math.max(0, elapsedMs));
      const remaining = msToHMS(getUiStableRemaining(stats?.etr));

      ui.percent.innerHTML = `${percent} (${value}/${max}) Elapsed: ${elapsed} Remaining: ${remaining}`;
      setKillCount(usingBatch ? state._batchDelCount : state.delCount);
      if (state.running) {
        document.title = `☠ ${percent || '...'} · ${BRAND_NAME}`;
        setRunner(max ? value / max : 0);
        if (window.ReaperApp?.progress && Date.now() - (window.__reaperLastPush || 0) > 800) {
          window.__reaperLastPush = Date.now();
          try {
            window.ReaperApp.progress(value | 0, max | 0, (usingBatch ? state._batchDelCount : state.delCount) | 0,
              String(remaining), ui.undiscordWindow.classList.contains('signal-lost'));
          } catch {}
        }
        updateSpeedo();
      }
      ui.progressBarPercent.textContent = percent || '...';

      ui.progressIcon.value = value;
      ui.progressMain.value = value;

      if (max) {
        ui.progressIcon.setAttribute('max', max);
        ui.progressMain.setAttribute('max', max);
      } else {
        ui.progressIcon.removeAttribute('value');
        ui.progressMain.removeAttribute('value');
        ui.percent.innerHTML = '...';
      }

      const searchDelayInput = $('input#searchDelay');
      searchDelayInput.value = undiscordCore.options.searchDelay;
      $('div#searchDelayValue').textContent = undiscordCore.options.searchDelay + 'ms';

      const deleteDelayInput = $('input#deleteDelay');
      deleteDelayInput.value = undiscordCore.options.deleteDelay;
      $('div#deleteDelayValue').textContent = undiscordCore.options.deleteDelay + 'ms';
    }

	  undiscordCore.onStart = (state, stats) => {
      ui.undiscordWindow.classList.remove('finished');
      $('#doneBanner').textContent = '';
      setPreScanStatus('');

	    log.debug('onStart', state, stats);
	    $('#start').disabled = true;
	    $('#stop').disabled = false;

	    ui.undiscordBtn.classList.add('running');
      setMainProgressVisibility(true);
	    ui.progressBarPercent.textContent = '0%';
      lastKillCount = 0;
      setKillCount(0);
      reaperRunStart(stats);

      if (undiscordCore.options.previewMode) {
        log.warn('Preview mode enabled: messages are not deleted.');
      }
      displayedRemainingMs = 0;
      lastRemainingUiUpdateTs = 0;

      if (progressTicker) clearInterval(progressTicker);
      progressTicker = setInterval(() => {
        if (!undiscordCore.state.running) return;
        undiscordCore.calcEtr();
        renderProgress(undiscordCore.state, undiscordCore.stats);
      }, 500);
	  };

	  undiscordCore.onProgress = (state, stats) => {
      renderProgress(state, stats);
	  };
    undiscordCore.onDeleted = (message) => reaperOnDeleted(message);
    undiscordCore.onThrottle = (ms) => signalLost.show(ms);

    undiscordCore.onStop = (state, stats) => {
      log.debug('onStop', state, stats);
      setPreScanStatus('');
      if (progressTicker) {
        clearInterval(progressTicker);
        progressTicker = null;
      }
      displayedRemainingMs = 0;
      lastRemainingUiUpdateTs = 0;

      $('#start').disabled = false;
      $('#stop').disabled = true;
      ui.undiscordBtn.classList.remove('running');
      setMainProgressVisibility(false);
      setKillCount(state._batchActive ? state._batchDelCount : state.delCount);
      reaperRunStop(state, stats);

      // Normal completion: green bar + success message
      if (state.endReason === 'DONE') {
        const total = state.delCount + state.failCount;
        const skipped = state._skippedUniqueCount || 0;
        const effectiveMax = Math.max(0, state.grandTotal - skipped);
        const max = Math.max(effectiveMax, total);
        const isPreview = !!undiscordCore.options.previewMode;

        // If this happens, Discord search/index likely returned an empty page too early.
        if (effectiveMax > 0 && total < effectiveMax) {
          ui.undiscordWindow.classList.remove('finished');
          const msg = `WARNING: finished early? ${state.delCount} deleted, ${state.failCount} failed. (${total}/${max}) Try increasing Search delay and run again.`;
          $('#doneBanner').textContent = msg;
          log.warn(msg);
        } else {
          ui.undiscordWindow.classList.add('finished');
          const msg = isPreview
            ? `Preview completed: ${state.delCount} simulated deletions, ${state.failCount} failed. (${total}/${max})`
            : `☠ Completed: ${state.delCount} deleted, ${state.failCount} failed. (${total}/${max})`;
          $('#doneBanner').textContent = msg;
          if (isPreview) log.info(msg);
          else log.success(msg);
        }
      } else {
        // Otherwise, remove "finished" state
        ui.undiscordWindow.classList.remove('finished');

        if (state.endReason === 'STOPPED') {
          log.warn('Stopped by user.');
        } else if (state.endReason === 'ERROR') {
          log.error('Stopped due to an error.');
        }
      }
    };

	}

async function startAction() {
	  log.debug('startAction');
    hardStopRequested = false;
    $('#start').disabled = true;
    $('#stop').disabled = false;
    let preScanProgressActive = false;
    const setPreScanStatus = (text = '') => {
      if (!ui.preScanStatus) return;
      const value = String(text || '');
      ui.preScanStatus.style.display = value ? 'block' : 'none';
      ui.preScanStatus.textContent = value;
    };
    const setMainProgressVisibility = (show) => {
      const display = show ? 'block' : 'none';
      ui.progressMain.style.display = display;
      ui.progressBarPercent.style.display = display;
      ui.percent.style.display = display;
    };
    const throwIfHardStop = () => {
      if (!hardStopRequested) return;
      const err = new Error('STOP_REQUESTED');
      err.code = 'STOP_REQUESTED';
      throw err;
    };
    const showPreScanProgress = (label, value = null, max = null) => {
      preScanProgressActive = true;
      ui.undiscordWindow.classList.remove('finished');
      $('#doneBanner').textContent = '';
      setPreScanStatus(label || 'Preparing all-channels scan...');
      ui.undiscordBtn.classList.add('running');
      setMainProgressVisibility(true);

      const hasMax = Number.isFinite(max) && Number(max) > 0;
      if (hasMax) {
        const safeMax = Math.max(1, Math.floor(Number(max)));
        const safeValue = Math.max(0, Math.min(safeMax, Math.floor(Number(value) || 0)));
        ui.progressMain.setAttribute('max', safeMax);
        ui.progressMain.value = safeValue;
        const pct = Math.round((safeValue / safeMax) * 100);
        ui.progressBarPercent.textContent = `${pct}%`;
      } else {
        ui.progressMain.removeAttribute('max');
        ui.progressMain.removeAttribute('value');
        ui.progressBarPercent.textContent = '...';
      }

      ui.percent.textContent = '';
    };
    const clearPreScanProgress = () => {
      if (!preScanProgressActive) return;
      preScanProgressActive = false;
      setPreScanStatus('');
      if (undiscordCore.state.running) return;
      ui.undiscordBtn.classList.remove('running');
      setMainProgressVisibility(false);
    };

    try {

    // Ensure IDs are refreshed right before validation/start.
    // NOTE: this function runs outside initUI scope, so we can't call safeAutofillFields() here.
    const authorInput = $('input#authorId');
    const guildInput = $('input#guildId');
    const channelInput = $('input#channelId');
    if (!authorInput.value.trim()) {
      try {
        const v = getAuthorId();
        if (v) authorInput.value = v;
      } catch {}
    }
    if (!guildInput.value.trim()) {
      const v = getGuildId({ silent: true });
      if (v) guildInput.value = v;
    }
    if (!channelInput.value.trim()) {
      const v = getChannelId({ silent: true });
      if (v) channelInput.value = v;
    }

	  // general
	  const authorId = extractDiscordId(authorInput.value) || authorInput.value.trim();
	  const guildId = extractDiscordId(guildInput.value) || guildInput.value.trim() || (getGuildId({ silent: true }) || '');
    const deleteAllChannels = $('input#deleteAllChannels')?.checked && guildId !== '@me';
    let allChannelInfos = [];
    let fallbackChannelIds = [];
    let preCountGrandTotal = 0;
    let batchPreviewLines = [];
    let batchPreviewTruncated = false;
    let perChannelCounts = [];
	  const channelValue = channelInput.value.trim() || (getChannelId({ silent: true }) || '');
	  let channelIds = deleteAllChannels ? [] : parseChannelIdsInput(channelValue);
    if (guildId && !guildInput.value.trim()) guildInput.value = guildId;
    if (channelValue && !channelInput.value.trim()) channelInput.value = channelValue;
	  const includeNsfw = $('input#includeNsfw').checked;
	  // filter
	  const content = $('input#search').value.trim();
	  const hasLink = $('input#hasLink').checked;
	  const hasFile = $('input#hasFile').checked;
	  const includePinned = $('input#includePinned').checked;
	  const pattern = $('input#pattern').value;
    const previewMode = $('input#previewMode').checked;
	  // message interval
	  const minId = $('input#minId').value.trim();
	  const maxId = $('input#maxId').value.trim();
	  // date range
	  const minDate = $('input#minDate').value.trim();
	  const maxDate = $('input#maxDate').value.trim();
	  //advanced
	  const searchDelay = parseInt($('input#searchDelay').value.trim());
	  const deleteDelay = parseInt($('input#deleteDelay').value.trim());

	  // token
	  const authToken = $('input#token').value.trim() || await fillToken();
    throwIfHardStop();
    if (authToken && !$('input#token').value.trim()) {
      $('input#token').value = authToken;
    }
	  if (!authToken) return; // get token already logs an error.

	  // clear logArea early so discovery diagnostics remain visible
	  ui.logArea.innerHTML = '';

    // ===== Multi-target run (picked DMs/servers) =====
    if (reaperTargets.length) {
      if (!authorId) {
        udToast('Author ID is empty. Click "me" in General first.', { type: 'warn' });
        return log.error('Author ID is required for multi-target runs.');
      }
      const targets = reaperTargets.slice();
      const filters = { authorId, minId: minId || minDate, maxId: maxId || maxDate, content, hasLink, hasFile, includeNsfw };
      const plan = {};
      const lines = [];
      let total = 0;
      for (let i = 0; i < targets.length; i++) {
        throwIfHardStop();
        const t = targets[i];
        showPreScanProgress(`Counting messages: ${i + 1}/${targets.length} (${t.name})`, i + 1, targets.length);
        const c = await countTargetMessages(authToken, t, filters);
        throwIfHardStop();
        total += c;
        lines.push(`${t.kind === 'dm' ? 'DM' : 'Server'} ${t.name}: ${c} message${c === 1 ? '' : 's'}`);
        if (t.kind === 'dm') plan[t.id] = { count: c, name: t.name, type: 1, source: 'picker' };
        log.info(`target [${i + 1}/${targets.length}] ${t.kind}=${t.id} count=${c}`);
        await wait(350);
      }
      setPreScanStatus('Waiting for confirmation...');
      const etrMs = total * ((deleteDelay || 0) + 150) + targets.length * (searchDelay || 0);
      const ok = await udConfirmDelete({ total, etrText: msToHMS(etrMs), previewMode, lines, scopeText: `${targets.length} target${targets.length === 1 ? '' : 's'}` });
      if (!ok) { log.info('Multi-target run cancelled.'); return; }
      throwIfHardStop();
      undiscordCore.resetState();
      undiscordCore.options = {
        ...undiscordCore.options,
        authToken, authorId,
        guildId: undefined, channelId: undefined,
        minId: minId || minDate, maxId: maxId || maxDate,
        content, hasLink, hasFile, includeNsfw, includePinned, pattern,
        previewMode, searchDelay, deleteDelay,
        batchExpectedTotal: total,
        batchPreviewLines: null,
        batchChannelPlan: plan,
        askForConfirmation: false,
      };
      const jobs = targets.map(t => t.kind === 'dm'
        ? { guildId: '@me', channelId: t.id }
        : { guildId: t.id, channelId: undefined });
      log.info(`Multi-target run: ${jobs.length} targets, ~${total} messages.`);
      await undiscordCore.runBatch(jobs);
      return;
    }

    if (deleteAllChannels) {
      showPreScanProgress('Discovering channels across this server...');
      throwIfHardStop();
      allChannelInfos = await getServerMessageChannels(guildId, authToken);
      throwIfHardStop();
      channelIds = allChannelInfos.map((x) => String(x?.id || '')).filter(Boolean);
      if (!channelIds.length) {
        udToast('Could not find this server\'s text channels for "Delete from all channels".', { type: 'warn' });
        return log.error('Delete from all channels is ON but no text channel IDs were found.');
      }
      log.info(`Delete from all channels enabled: ${channelIds.length} message channels selected.`);
      const byType = allChannelInfos.reduce((acc, x) => {
        const k = String(Number(x?.type));
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      const bySource = allChannelInfos.reduce((acc, x) => {
        const k = String(x?.source || 'unknown');
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      log.verb('All-channels discovery breakdown (by type):', byType);
      log.verb('All-channels discovery breakdown (by source):', bySource);
      const allIds = allChannelInfos.map((x) => String(x?.id || '')).filter(Boolean);
      log.verb(`All-channels IDs (${allIds.length}):`, allIds.join(', '));
      const allIdsDetailed = allChannelInfos
        .map((x) => `${String(x?.id || '')}[type=${Number(x?.type)},source=${String(x?.source || 'unknown')}]`)
        .filter((x) => !x.startsWith('[type='));
      log.verb('All-channels IDs detailed:', allIdsDetailed.join(', '));
      await debugCurrentChannelDiscovery(guildId, authToken, allChannelInfos);
      throwIfHardStop();
      const preCountFilters = {
        authorId,
        minId: minId || minDate,
        maxId: maxId || maxDate,
        content,
        hasLink,
        hasFile,
        includeNsfw,
        includePinned,
        pattern,
      };
      log.info(`All-channels pre-count: scanning ${channelIds.length} channels to estimate totals...`);
      const previewLimitTotal = 300;
      showPreScanProgress(`Scanning all channels: 0/${channelIds.length}`, 0, channelIds.length);
      for (let i = 0; i < channelIds.length; i++) {
        throwIfHardStop();
        const ch = channelIds[i];
        const chMeta = allChannelInfos.find((x) => String(x?.id || '') === ch) || null;
        const chName = String(chMeta?.name || '').trim();
        showPreScanProgress(
          chName
            ? `Scanning all channels: ${i + 1}/${channelIds.length} (#${chName})`
            : `Scanning all channels: ${i + 1}/${channelIds.length}`,
          i + 1,
          channelIds.length
        );
        const estimate = await estimateChannelMessageCount({
          authToken,
          guildId,
          channelId: ch,
          filters: preCountFilters,
        });
        throwIfHardStop();
        const count = Math.max(0, Number(estimate?.count || 0));
        preCountGrandTotal += count;
        perChannelCounts.push({
          id: ch,
          count,
          method: String(estimate?.method || 'unknown'),
        });
        const remainingPreview = previewLimitTotal - batchPreviewLines.length;
        if (remainingPreview > 0) {
          const preview = await collectChannelPreviewLines({
            authToken,
            channelId: ch,
            filters: preCountFilters,
            maxLines: remainingPreview,
          });
          throwIfHardStop();
          if (Array.isArray(preview?.lines) && preview.lines.length) {
            batchPreviewLines.push(...preview.lines);
          }
          if (preview?.truncated) batchPreviewTruncated = true;
        } else {
          batchPreviewTruncated = true;
        }
        log.info(`All-channels pre-count [${i + 1}/${channelIds.length}] channel=${ch} count=${count} via=${estimate?.method || 'unknown'}`);
      }
      if (batchPreviewTruncated) {
        batchPreviewLines.push('[... preview truncated ...]');
      }
      showPreScanProgress('All-channels scan complete. Preparing deletion...', channelIds.length, channelIds.length);
      log.info(`All-channels pre-count total: ${preCountGrandTotal} messages across ${channelIds.length} channels.`);
      const perChannelSummary = perChannelCounts.map((x) => `${x.id}:${x.count}`).join(', ');
      log.verb('All-channels pre-count per-channel:', perChannelSummary);
      log.info('Deletion plan (per channel):');
      for (let i = 0; i < perChannelCounts.length; i++) {
        const x = perChannelCounts[i];
        const meta = allChannelInfos.find((m) => String(m?.id || '') === x.id) || {};
        log.info(
          `plan [${i + 1}/${perChannelCounts.length}]`,
          `channel=${x.id}`,
          `count=${x.count}`,
          `type=${Number(meta?.type)}`,
          `source=${String(meta?.source || 'unknown')}`
        );
      }
      // Guild-wide search may miss some channel families (threads/forum/media).
      fallbackChannelIds = allChannelInfos
        .filter((x) => [10, 11, 12, 13, 15, 16].includes(Number(x?.type)))
        .map((x) => String(x?.id || ''))
        .filter(Boolean);
      if (fallbackChannelIds.length) {
        log.verb(`All-channels fallback candidates: ${fallbackChannelIds.length} (threads/forum/media).`);
      }
    }

	  // validate input
	  if (!guildId) {
      udToast('Could not find the Server ID.\nOpen a server/DM, click "current", then retry.', { type: 'warn' });
      return log.error('You must fill the "Server ID" field!');
    }
    if (!deleteAllChannels && !channelIds.length) {
      udToast('Could not find the Channel ID.\nOpen a channel/DM, click "current", then retry.', { type: 'warn' });
      return log.error('You must fill the "Channel ID" field!');
    }

	  undiscordCore.resetState();
	  undiscordCore.options = {
	    ...undiscordCore.options,
	    authToken,
	    authorId,
	    guildId,
	    channelId: deleteAllChannels ? undefined : (channelIds.length === 1 ? channelIds[0] : undefined), // all channels => guild-wide search
	    minId: minId || minDate,
	    maxId: maxId || maxDate,
	    content,
	    hasLink,
	    hasFile,
	    includeNsfw,
	    includePinned,
	    pattern,
      previewMode,
	    searchDelay,
	    deleteDelay,
      batchExpectedTotal: deleteAllChannels ? preCountGrandTotal : 0,
      batchPreviewLines: deleteAllChannels ? batchPreviewLines : null,
      batchChannelPlan: deleteAllChannels
        ? Object.fromEntries(perChannelCounts.map((x) => {
          const meta = allChannelInfos.find((m) => String(m?.id || '') === x.id) || {};
          return [x.id, {
            count: x.count,
            method: x.method,
            type: Number(meta?.type),
            name: String(meta?.name || ''),
            source: String(meta?.source || 'unknown'),
          }];
        }))
        : null,
	    // maxAttempt: 2,
	  };
    throwIfHardStop();
	  if (!deleteAllChannels && channelIds.length > 1) {
	    const jobs = channelIds.map(ch => ({
	      guildId: guildId,
	      channelId: ch,
	    }));

	    try {
          throwIfHardStop();
	      await undiscordCore.runBatch(jobs);
	    } catch (err) {
	      log.error('CoreException', err);
	    }
	  }
	  // single channel OR all channels (guild-wide aggregate)
	  else {
	    try {
          throwIfHardStop();
        if (deleteAllChannels) {
          const allJobs = Array.from(new Set(channelIds)).map((ch) => ({
            guildId: guildId,
            channelId: ch,
          }));
          log.info(`Delete from all channels: running strict per-channel batch (${allJobs.length} channels).`);
          throwIfHardStop();
          await undiscordCore.runBatch(allJobs);
          return;
        }
          throwIfHardStop();
	      await undiscordCore.run();

        // Phase 2 fallback: channel-scoped pass for channel families that guild-wide
        // index/search can under-report (threads/forum/media).
        if (deleteAllChannels && fallbackChannelIds.length) {
          const uniqueFallbackIds = Array.from(new Set(fallbackChannelIds));
          const jobs = uniqueFallbackIds.map((ch) => ({
            guildId: guildId,
            channelId: ch,
          }));

          log.info(
            `Delete from all channels: running targeted fallback on ${jobs.length} thread/forum/media channels...`
          );

          undiscordCore.resetState();
          undiscordCore.options = {
            ...undiscordCore.options,
            authToken,
            authorId,
            guildId,
            channelId: undefined,
            minId: minId || minDate,
            maxId: maxId || maxDate,
            content,
            hasLink,
            hasFile,
            includeNsfw,
            includePinned,
            pattern,
            previewMode,
            searchDelay,
            deleteDelay,
            askForConfirmation: false,
          };
          throwIfHardStop();
          await undiscordCore.runBatch(jobs);
        }
	    } catch (err) {
	      log.error('CoreException', err);
	      undiscordCore.stop();
	    }
	  }
    } catch (err) {
      if (err?.code === 'STOP_REQUESTED') {
        log.warn('Stop requested: immediate interruption.');
      } else {
        log.error('startAction failed:', err);
        undiscordCore.stop();
      }
    } finally {
      clearPreScanProgress();
      if (!undiscordCore.state.running) {
        $('#start').disabled = false;
        $('#stop').disabled = true;
      }
    }
	}

	function stopAction() {
	  log.debug('stopAction');
    hardStopRequested = true;
	  undiscordCore.stop();
    if (!undiscordCore.state.running) {
      $('#start').disabled = false;
      $('#stop').disabled = true;
    }
	}


	// ============================ REAPER EXTRAS ============================
	// All effects are cosmetic and only *observe* the core (onDeleted/onThrottle/onStart/onStop).

	const SKULL_PATTERN = ['.#####.', '#######', '#..#..#', '#..#..#', '#######', '.##.##.', '.#.#.#.'];
	const SKULL_CELLS = [];
	SKULL_PATTERN.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') SKULL_CELLS.push([x, y]); }));
	const SKULL_EYES = [[1, 2], [2, 2], [1, 3], [2, 3], [4, 2], [5, 2], [4, 3], [5, 3]];

	const prefersReducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
	const fxOn = () => { try { return !!ui.undiscordWindow?.querySelector('#fxMode')?.checked; } catch { return true; } };

	// ============================ THEME PACKS ============================
	// "skull" packs reuse the red art and tint the whole UI with hue-rotate.
	// "art" packs bring their own true-color pixel art (icon, runner, rain, background, sounds),
	// which is counter-rotated so it keeps its real colors while the UI chrome gets tinted.

	// pal values: '#hex' | { f: fill, c: 'class', seq: true }  (seq => each pixel gets --i for staggered animation)
	function pxRects(rows, pal, dx = 0, dy = 0) {
	  let out = '';
	  const seqN = {};
	  const fillAttr = (f) => f.startsWith('var(') ? `style="fill:${f}"` : `fill="${f}"`;
	  rows.forEach((row, y) => {
	    let x = 0;
	    while (x < row.length) {
	      const c = row[x];
	      const v = pal[c];
	      if (c === '.' || !v) { x++; continue; }
	      if (typeof v === 'object') {
	        const i = (seqN[c] = (seqN[c] ?? -1) + 1);
	        out += `<rect x="${x + dx}" y="${y + dy}" width="1" height="1" ${fillAttr(v.f)}${v.c ? ` class="${v.c}"` : ''}${v.seq ? ` style="--i:${i}"` : ''}/>`;
	        x++;
	        continue;
	      }
	      let w = 1;
	      while (row[x + w] === c) w++;
	      out += `<rect x="${x + dx}" y="${y + dy}" width="${w}" height="1" ${fillAttr(v)}/>`;
	      x += w;
	    }
	  });
	  return out;
	}
	function pxSvg(rows, pal, { size = 24, cls = '', pad = 0.5, wrap = '' } = {}) {
	  const h = rows.length, w = Math.max(...rows.map(r => r.length));
	  const m = Math.max(w, h);
	  const ox = (m - w) / 2, oy = (m - h) / 2;
	  const body = pxRects(rows, pal, ox, oy);
	  return `<svg ${cls ? `class="${cls}" ` : ''}aria-hidden="true" width="${size}" height="${size}" viewBox="${-pad} ${-pad} ${m + pad * 2} ${m + pad * 2}" shape-rendering="crispEdges">${wrap ? `<g class="${wrap}">${body}</g>` : body}</svg>`;
	}
	function pxCells(rows, pal) {
	  const cells = [];
	  rows.forEach((row, y) => [...row].forEach((c, x) => { const v = pal[c]; if (c !== '.' && v) cells.push([x, y, typeof v === 'object' ? v.f : v]); }));
	  return cells;
	}

	// ---- pixel art ----
	const ICON_SKULL = ['.#####.', '#######', '#ll#rr#', '#ll#rr#', '#######', '.##.##.', '.#.#.#.'];
	const PAL_SKULL_ICON = { '#': 'currentColor', l: { f: 'var(--udic-eye, #ff2a44)', c: 'udic-eyeL' }, r: { f: 'var(--udic-eye, #ff2a44)', c: 'udic-eyeR' } };

	const ICON_INK = (() => {
	  const N = 12, g = Array.from({ length: N }, () => Array(N).fill('.'));
	  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
	    const d = Math.hypot(x - 6.2, y - 5.3);
	    if (d <= 4.9) g[y][x] = d > 4.0 ? 'M' : 'm';
	  }
	  for (let x = 0; x < N; x++) {
	    const y = 11 - x;
	    if (x <= 2) g[y][x] = 'r';
	    else if (x === 3) { g[y][x] = 'g'; if (g[y - 1]) g[y - 1][x - 1] = 'g'; if (g[y + 1] && x + 1 < N) g[y + 1][x + 1] = 'g'; }
	    else { g[y][x] = 's'; if (y + 1 < N && x + 1 < N && x >= 5) g[y + 1][x] = 'S'; }
	  }
	  return g.map(r => r.join(''));
	})();
	const PAL_INK = { m: { f: '#d1173a', c: 'udic-moon' }, M: '#8e0f28', s: { f: '#c9d2de', c: 'udic-gleam', seq: true }, S: '#8a96a8', g: '#e8b64c', r: '#2b2650' };

	const ICON_SURGE = [
	  '......oyyo',
	  '.....oyyo.',
	  '....oyyo..',
	  '...oyyo...',
	  '..oyyyyyyo',
	  '.oyyyyyyo.',
	  '....oyyo..',
	  '...oyyo...',
	  '..oyyo....',
	  '..oyo.....',
	  '..oo......',
	];
	const PAL_SURGE = { o: '#ff6a00', y: { f: '#ffe14d', c: 'udic-bolt' } };

	const ICON_COSMIC = [
	  '....cccc....',
	  '...ccwccc...',
	  '...cccccc...',
	  '..pppppppp..',
	  'pppyppyppypp',
	  '.pppppppppp.',
	  '....bbbb....',
	  '...bbbbbb...',
	  '..bbbbbbbb..',
	];
	const PAL_COSMIC = { c: '#7df9ff', w: '#ffffff', p: '#b44dff', y: { f: '#ffe14d', c: 'udic-light', seq: true }, b: { f: 'rgba(255,225,77,.4)', c: 'udic-beam' } };

	// ---- runner characters (same 12x18 rig as the skeleton) ----
	const RIG = {
	  ronin: {
	    head: ['....hhhh....', '..hhhhhhhh..', 'hhhhhhhhhhhh', '...kkkkkk...', '...kkkkek...', '...kkkkkk...', '....kkkk....'],
	    torso: ['.....kk.....', '...bbwwbb...', '...bbbwbb...', '...bbbbbb...', '...rrrrrr...', '....bbbb....'],
	    extra: [[9, 10, 'g'], [10, 9, 'g'], [2, 12, 'z'], [1, 13, 'z'], [0, 14, 'z']],
	    pal: { h: '#c9a36a', k: '#f0c8a0', e: '#1a1020', b: '#2b2650', w: '#e9e4f0', r: '#d1173a', g: '#e8b64c', z: '#6a1022' },
	    near: '#3b3470', far: '#1b1838',
	  },
	  hero: {
	    head: ['...nnnnn....', '..nnnnnnn...', '.rrrrrrrr...', 'r.kkkkkkk...', '..kkkkkek...', '..kkkkkkk...', '...kkkkk....'],
	    torso: ['.....kk.....', '...jjjjjj...', '...jjwjjj...', '...jjwjjj...', '...jjjjjj...', '....pppp....'],
	    extra: [],
	    pal: { n: '#1c1a24', r: '#e2232f', k: '#f2c6a0', e: '#1a1020', j: '#2f6fe0', w: '#f4f4f4', p: '#22263a' },
	    near: '#2f6fe0', far: '#1d3f86',
	  },
	  alien: {
	    head: ['.......y....', '......a.....', '...tttttt...', '..tttttttt..', '..ttwwwwtt..', '..ttwwpwtt..', '..tttttttt..'],
	    torso: ['....tttt....', '...tttttt...', '...tllllt...', '...tllllt...', '...tttttt...', '....tttt....'],
	    extra: [],
	    pal: { y: '#ffe14d', a: '#3de0c8', t: '#3de0c8', w: '#ffffff', p: '#1a1030', l: '#b9fff2' },
	    near: '#3de0c8', far: '#1f8f80',
	  },
	};
	function rigRunnerSvg(rig) {
	  const limb = (names, color, dy) => names.map(n => SK_LIMBS[n].map(([x, y]) => `<rect x="${x}" y="${y + dy}" width="1" height="1" fill="${color}"/>`).join('')).join('');
	  const extra = (dy) => rig.extra.map(([x, y, c]) => `<rect x="${x}" y="${y + dy}" width="1" height="1" fill="${rig.pal[c]}"/>`).join('');
	  return `<svg viewBox="0 -1 12 19" width="24" height="38" shape-rendering="crispEdges">` +
	    SK_FRAMES.map((f, i) => `<g class="sk-f" style="animation-delay:${(-0.1 * (4 - i)).toFixed(1)}s">` +
	      limb(f.far, rig.far, f.dy) + pxRects(rig.head, rig.pal, 0, f.dy) + pxRects(rig.torso, rig.pal, 0, 7 + f.dy) + extra(f.dy) + limb(f.near, rig.near, f.dy) +
	    `</g>`).join('') + `</svg>`;
	}

	// ---- rain sprites ----
	const SPR_PETAL = { rows: ['.pp..', 'pPpp.', '.ppPp', '..pp.'], pal: { p: '#ffb7c9', P: '#ff7fa6' } };
	const SPR_SPARK = { rows: ['.y.', 'yWy', '.y.'], pal: { y: '#ffb000', W: '#fff6c8' } };
	const SPR_EMBER = { rows: ['o', 'y'], pal: { o: '#ff6a00', y: '#ffe14d' } };
	const SPR_STAR = { rows: ['.w.', 'wyw', '.w.'], pal: { w: '#ffffff', y: '#7df9ff' } };
	const SPR_UFO = { rows: ['.cc.', 'pppp', '.y..'], pal: { c: '#7df9ff', p: '#b44dff', y: '#ffe14d' } };

	// ---- backgrounds (pure CSS / inline SVG, nothing remote) ----
	const BG_INK = [
	  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 200' preserveAspectRatio='none'><path d='M0 200 L0 120 L60 95 L110 120 L170 60 L230 110 L300 80 L360 125 L430 50 L500 105 L560 85 L620 120 L690 70 L760 110 L800 95 L800 200Z' fill='%2311102a'/><path d='M0 200 L0 150 L80 135 L150 160 L240 120 L320 155 L400 130 L480 165 L560 135 L650 160 L720 140 L800 150 L800 200Z' fill='%23070615'/></svg>") bottom / 100% 42% no-repeat`,
	  `radial-gradient(circle at 80% 42%, rgba(255,244,236,.95) 0 38px, rgba(255,120,150,.28) 39px 52px, rgba(209,23,58,.10) 53px 110px, transparent 111px)`,
	  `radial-gradient(rgba(255,183,201,.05) 1px, transparent 1.5px) 0 0 / 14px 14px`,
	  `linear-gradient(180deg, #0c0a24 0%, #07061a 55%, #040310 100%)`,
	].join(',');
	const BG_SURGE = [
	  `radial-gradient(circle at 50% 55%, rgba(255,210,80,.22) 0, rgba(255,106,0,.16) 22%, transparent 55%)`,
	  `repeating-conic-gradient(from 0deg at 50% 55%, rgba(255,140,0,.10) 0deg 2.5deg, transparent 2.5deg 9deg)`,
	  `radial-gradient(rgba(255,190,80,.10) 1.2px, transparent 1.6px) 0 0 / 9px 9px`,
	  `linear-gradient(180deg, #1a0702, #0b0301)`,
	].join(',');
	const BG_COSMIC = [
	  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><ellipse cx='100' cy='100' rx='92' ry='22' fill='none' stroke='%237df9ff' stroke-opacity='.45' stroke-width='5' transform='rotate(-18 100 100)'/></svg>") 4% 82% / 200px 200px no-repeat`,
	  `radial-gradient(circle at calc(4% + 100px) calc(82% - 0px), #ff7ad9 0, #b44dff 34px, #5a1d9e 58px, transparent 60px)`,
	  `radial-gradient(1.3px 1.3px at 20px 30px, #fff, transparent) 0 0 / 190px 170px, radial-gradient(1px 1px at 120px 80px, #7df9ff, transparent) 0 0 / 210px 150px, radial-gradient(1.5px 1.5px at 70px 150px, #fff, transparent) 0 0 / 230px 190px, radial-gradient(1px 1px at 170px 20px, #ffe14d, transparent) 0 0 / 260px 200px`,
	  `linear-gradient(180deg, #0a0820, #05040f)`,
	].join(',');

	const PACKS = {
	  blood: { name: 'Blood', kind: 'skull', hue: 0, accent: '#ff2a44' },
	  toxic: { name: 'Toxic', kind: 'skull', hue: 130, accent: '#39ff6a' },
	  ice:   { name: 'Ice', kind: 'skull', hue: 200, accent: '#3ad7ff' },
	  void:  { name: 'Void', kind: 'skull', hue: 275, accent: '#b44dff' },
	  ink: {
	    name: 'Ink Blade', kind: 'art', hue: 0, accent: '#d1173a', glow: 'rgba(255,120,150,.8)',
	    icon: ICON_INK, pal: PAL_INK, rig: RIG.ronin, bg: BG_INK,
	    rain: { sprites: [SPR_PETAL], count: 24, dir: 1, sway: 22, speed: 0.6, alpha: [0.35, 0.8] },
	    sfx: { zap: 'ink_zap', boot: 'ink_boot', finish: 'ink_finish' },
	    finish: ['CLEAN CUT', 'Every last message cut down.'],
	  },
	  surge: {
	    name: 'Power Surge', kind: 'art', hue: 0, accent: '#ff6a00', glow: 'rgba(255,170,0,.9)', aura: true,
	    icon: ICON_SURGE, pal: PAL_SURGE, rig: RIG.hero, bg: BG_SURGE,
	    rain: { sprites: [SPR_SPARK, SPR_EMBER, SPR_EMBER], count: 34, dir: -1, sway: 8, speed: 1.4, alpha: [0.35, 0.9] },
	    sfx: { zap: 'surge_zap', boot: 'surge_boot', finish: 'surge_finish' },
	    finish: ['LIMIT BROKEN', 'Full power. Nothing left standing.'],
	  },
	  cosmic: {
	    name: 'Cosmic Mess', kind: 'art', hue: 0, accent: '#b44dff', glow: 'rgba(125,249,255,.85)',
	    icon: ICON_COSMIC, pal: PAL_COSMIC, iconWrap: 'udic-bob', rig: RIG.alien, bg: BG_COSMIC,
	    rain: { sprites: [SPR_STAR, SPR_STAR, SPR_UFO], count: 26, dir: 1, sway: 14, speed: 0.5, alpha: [0.3, 0.85] },
	    sfx: { zap: 'cosmic_zap', boot: 'cosmic_boot', finish: 'cosmic_finish' },
	    finish: ['SECTOR CLEARED', 'Every message got beamed away.'],
	  },
	};
	let currentPackId = 'blood';
	const currentPack = () => PACKS[currentPackId] || PACKS.blood;

	function packIconSvg(size = 24, cls = '') {
	  const p = currentPack();
	  if (p.kind !== 'art') return pxSvg(ICON_SKULL, PAL_SKULL_ICON, { size, cls });
	  return pxSvg(p.icon, p.pal, { size, cls, wrap: p.iconWrap || '' });
	}
	function tileIconSvg(p) {
	  if (p.kind !== 'art') return pxSvg(ICON_SKULL, { '#': p.accent, l: '#fff', r: '#fff' }, { size: 20 });
	  return pxSvg(p.icon, p.pal, { size: 20 });
	}
	function currentRunnerSvg() {
	  const p = currentPack();
	  return p.kind === 'art' ? rigRunnerSvg(p.rig) : RUNNER_SVG;
	}
	function currentRainSpec() {
	  const p = currentPack();
	  if (p.kind === 'art') return p.rain;
	  return { sprites: [{ rows: SKULL_PATTERN, pal: { '#': '#ff2a44' } }], count: 28, dir: 1, sway: 0, speed: 1, alpha: [0.05, 0.18], skull: true };
	}
	const spriteCache = new WeakMap();
	function spriteCellsOf(spr) {
	  if (!spriteCache.has(spr)) spriteCache.set(spr, { cells: pxCells(spr.rows, spr.pal), w: Math.max(...spr.rows.map(r => r.length)), h: spr.rows.length });
	  return spriteCache.get(spr);
	}

	function applyPack(id) {
	  if (!PACKS[id]) id = 'blood';
	  currentPackId = id;
	  try { window.ReaperApp?.setPack?.(id); } catch {}
	  const p = PACKS[id];
	  const body = document.body;
	  const win = ui.undiscordWindow;
	  body.style.setProperty('--ud-hue', (p.hue || 0) + 'deg');
	  if (p.hue) body.dataset.udTheme = id; else delete body.dataset.udTheme;
	  if (p.kind === 'art') { body.dataset.udArt = id; body.style.setProperty('--pack-glow', p.glow || 'rgba(255,42,68,.8)'); }
	  else { delete body.dataset.udArt; body.style.removeProperty('--pack-glow'); }

	  // background layer
	  const bg = win.querySelector('#packBg');
	  if (bg) bg.style.background = p.kind === 'art' ? p.bg : '';
	  win.classList.toggle('aura', !!p.aura);

	  // icons: window header + Discord toolbar button
	  const head = win.querySelector('.header > svg.icon');
	  if (head) {
	    const tmp = document.createElement('div');
	    tmp.innerHTML = packIconSvg(24, 'icon');
	    head.replaceWith(tmp.firstChild);
	  }
	  const fab = document.getElementById('reaper-fab');
	  if (fab) fab.innerHTML = packIconSvg(30);
	  const btnSvg = ui.undiscordBtn?.querySelector('svg');
	  if (btnSvg) {
	    const tmp = document.createElement('div');
	    tmp.innerHTML = packIconSvg(24);
	    btnSvg.replaceWith(tmp.firstChild);
	  }

	  // runner + rain pick up the new pack on next draw
	  const r = win.querySelector('#runner');
	  if (r) r.innerHTML = '';
	  if (rain.active) { rain.drops = Array.from({ length: currentRainSpec().count }, () => rain.spawn(true)); }

	  win.querySelectorAll('button.packTile').forEach(b => b.classList.toggle('active', b.dataset.pack === id));
	}

	// ---------- Sound v2: "hacker" synth (FM zaps, data chatter, bitcrush, sub hits) ----------
	// Everything is generated with WebAudio; no audio files are downloaded.
	const sfx = {
	  on: true,
	  ctx: null,
	  out: null,     // dry bus -> compressor
	  echo: null,    // echo send bus
	  lastZap: 0,
	  DATA_FREQS: [1568, 1760, 2093, 2349, 2637, 3136, 3520, 4186],
	  init() {
	    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return true; }
	    try {
	      const AC = window.AudioContext || window.webkitAudioContext;
	      if (!AC) return false;
	      this.build(new AC());
	      return true;
	    } catch { return false; }
	  },
	  build(ctx) {
	    this.ctx = ctx;
	    const comp = ctx.createDynamicsCompressor();
	    comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 6;
	    comp.attack.value = 0.002; comp.release.value = 0.18;
	    const master = ctx.createGain();
	    master.gain.value = 1.1; // louder than v1, compressor keeps it from clipping
	    comp.connect(master); master.connect(ctx.destination);
	    this.out = ctx.createGain(); this.out.connect(comp);
	    // short digital echo: delay -> lowpass -> feedback
	    const d = ctx.createDelay(1); d.delayTime.value = 0.13;
	    const fb = ctx.createGain(); fb.gain.value = 0.32;
	    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
	    this.echo = ctx.createGain(); this.echo.gain.value = 0.4;
	    this.echo.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(comp);
	  },
	  // --- building blocks ---
	  noise(dur) {
	    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
	    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
	    const ch = buf.getChannelData(0);
	    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
	    const src = this.ctx.createBufferSource(); src.buffer = buf;
	    return src;
	  },
	  shaper(amount) {
	    const ws = this.ctx.createWaveShaper(); const n = 1024; const c = new Float32Array(n);
	    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + amount) * x / (1 + amount * Math.abs(x)); }
	    ws.curve = c; return ws;
	  },
	  crusher(steps) {
	    const ws = this.ctx.createWaveShaper(); const n = 2048; const c = new Float32Array(n);
	    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = Math.round(x * steps) / steps; }
	    ws.curve = c; return ws;
	  },
	  // envelope gain that routes to dry bus (+ optional echo send)
	  vca(t, peak, dur, { attack = 0.003, send = 0 } = {}) {
	    const g = this.ctx.createGain();
	    g.gain.setValueAtTime(0.0001, t);
	    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
	    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.005, dur));
	    g.connect(this.out);
	    if (send > 0) { const s = this.ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(this.echo); }
	    return g;
	  },
	  // FM voice: modulator -> carrier.frequency (metallic / digital timbres)
	  fm(t, dur, { cf0, cf1, ratio = 1.5, i0 = 500, i1 = 0, peak = 0.3, send = 0, type = 'sine', dest = null }) {
	    const car = this.ctx.createOscillator(); car.type = type;
	    const mod = this.ctx.createOscillator(); mod.type = 'sine';
	    const idx = this.ctx.createGain();
	    car.frequency.setValueAtTime(cf0, t); car.frequency.exponentialRampToValueAtTime(Math.max(1, cf1), t + dur);
	    mod.frequency.setValueAtTime(cf0 * ratio, t); mod.frequency.exponentialRampToValueAtTime(Math.max(1, cf1 * ratio), t + dur);
	    idx.gain.setValueAtTime(Math.max(0.01, i0), t); idx.gain.exponentialRampToValueAtTime(Math.max(0.01, i1), t + dur);
	    mod.connect(idx); idx.connect(car.frequency);
	    const v = this.vca(t, peak, dur, { send });
	    if (dest) { car.connect(dest); dest.connect(v); } else car.connect(v);
	    car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
	  },
	  blip(t, f, dur = 0.018, peak = 0.22, send = 0.25) {
	    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t);
	    o.connect(this.vca(t, peak, dur, { attack: 0.001, send }));
	    o.start(t); o.stop(t + dur + 0.02);
	  },
	  sub(t, f0, f1, dur, peak) {
	    const o = this.ctx.createOscillator(); o.type = 'sine';
	    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
	    o.connect(this.vca(t, peak, dur, { attack: 0.002 }));
	    o.start(t); o.stop(t + dur + 0.05);
	  },
	  chatter(t, count, spacing, peak = 0.2) {
	    for (let i = 0; i < count; i++) {
	      const f = this.DATA_FREQS[(Math.random() * this.DATA_FREQS.length) | 0] * (Math.random() < 0.3 ? 0.5 : 1);
	      this.blip(t + i * spacing, f, 0.014 + Math.random() * 0.012, peak);
	    }
	  },
	  // --- sounds ---
	  play(name) {
	    if (!this.on || !this.init()) return;
	    const remap = currentPack().sfx;
	    if (remap && remap[name]) name = remap[name];
	    const t = this.ctx.currentTime + 0.01;
	    try {
	      if (name === 'zap' || name === 'crunch') {
	        const now = performance.now();
	        if (now - this.lastZap < 70) return;
	        this.lastZap = now;
	        // filtered, distorted noise "zap" sweeping down
	        const n = this.noise(0.1);
	        const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 5;
	        bp.frequency.setValueAtTime(7500, t); bp.frequency.exponentialRampToValueAtTime(500, t + 0.085);
	        const sh = this.shaper(40);
	        n.connect(bp); bp.connect(sh); sh.connect(this.vca(t, 0.6, 0.09, { send: 0.15 })); n.start(t);
	        // metallic FM click
	        this.fm(t, 0.05, { cf0: 3200, cf1: 180, ratio: 1.41, i0: 2500, i1: 10, peak: 0.22 });
	        // data chatter
	        this.chatter(t + 0.015, 3 + ((Math.random() * 3) | 0), 0.021, 0.2);
	        // sub thump
	        this.sub(t, 120, 38, 0.1, 0.65);
	      } else if (name === 'glitch') {
	        // stuttering bitcrushed static
	        const dur = 0.75;
	        const n = this.noise(dur);
	        const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.8;
	        const cr = this.crusher(5);
	        const gate = this.ctx.createGain();
	        for (let i = 0; i * 0.024 < dur; i++) gate.gain.setValueAtTime(Math.random() < 0.55 ? 0.5 : 0.0, t + i * 0.024);
	        gate.gain.setValueAtTime(0, t + dur);
	        n.connect(bp); bp.connect(cr); cr.connect(gate); gate.connect(this.out); n.start(t);
	        // FM "power down"
	        this.fm(t, dur, { cf0: 900, cf1: 40, ratio: 3.5, i0: 700, i1: 40, peak: 0.35, send: 0.3, dest: this.shaper(8) });
	        // low drone
	        this.sub(t, 58, 50, dur, 0.3);
	      } else if (name === 'restore') {
	        this.fm(t, 0.2, { cf0: 180, cf1: 2600, ratio: 2, i0: 300, i1: 900, peak: 0.28, send: 0.35 });
	        [1318, 1760, 2637, 3520].forEach((f, i) => this.blip(t + 0.1 + i * 0.035, f, 0.025, 0.22));
	      } else if (name === 'boot') {
	        this.sub(t, 52, 30, 1.1, 0.75);
	        // noise riser
	        const n = this.noise(0.65);
	        const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 4;
	        bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(6500, t + 0.6);
	        const g = this.ctx.createGain();
	        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.4, t + 0.58); g.gain.linearRampToValueAtTime(0, t + 0.65);
	        n.connect(bp); bp.connect(g); g.connect(this.out); n.start(t);
	        // accelerating data chatter
	        let tt = t + 0.05, gap = 0.11;
	        for (let i = 0; i < 11; i++) { this.blip(tt, this.DATA_FREQS[(Math.random() * 8) | 0], 0.02, 0.18); tt += gap; gap *= 0.8; }
	        // lock-on ping
	        this.fm(t + 0.78, 0.35, { cf0: 1975, cf1: 1960, ratio: 3, i0: 1600, i1: 5, peak: 0.32, send: 0.6 });
	        this.sub(t + 0.78, 90, 40, 0.25, 0.5);
	      } else if (name === 'finish') {
	        this.fm(t, 0.6, { cf0: 2400, cf1: 70, ratio: 1.5, i0: 900, i1: 80, peak: 0.32, send: 0.4 });
	        this.chatter(t, 7, 0.03, 0.2);
	        const n = this.noise(0.35);
	        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
	        const sh = this.shaper(25);
	        n.connect(lp); lp.connect(sh); sh.connect(this.vca(t + 0.55, 0.5, 0.35, { send: 0.3 })); n.start(t + 0.55);
	        this.sub(t + 0.55, 75, 30, 0.9, 0.85);
	      } else if (name === 'decay') {
	        // corrupted data stream collapsing
	        const dur = 1.0;
	        const n = this.noise(dur);
	        const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
	        bp.frequency.setValueAtTime(4000, t); bp.frequency.exponentialRampToValueAtTime(250, t + dur);
	        const cr = this.crusher(4);
	        const gate = this.ctx.createGain();
	        for (let i = 0; i * 0.03 < dur; i++) gate.gain.setValueAtTime(Math.random() < 0.6 ? 0.45 * (1 - i * 0.03 / dur) : 0, t + i * 0.03);
	        gate.gain.setValueAtTime(0, t + dur);
	        n.connect(bp); bp.connect(cr); cr.connect(gate); gate.connect(this.out); n.start(t);
	        this.chatter(t, 14, 0.045, 0.16);
	        this.fm(t + 0.1, 0.8, { cf0: 1400, cf1: 90, ratio: 2.7, i0: 1200, i1: 30, peak: 0.25, send: 0.35, dest: this.shaper(12) });
	      } else if (name === 'ink_zap') {
	        // katana: air swish + ringing steel
	        const now = performance.now(); if (now - this.lastZap < 70) return; this.lastZap = now;
	        const n = this.noise(0.09);
	        const hp = this.ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.Q.value = 2.5;
	        hp.frequency.setValueAtTime(1200, t); hp.frequency.exponentialRampToValueAtTime(9000, t + 0.07);
	        n.connect(hp); hp.connect(this.vca(t, 0.5, 0.085, { attack: 0.01 })); n.start(t);
	        this.fm(t + 0.04, 0.45, { cf0: 2850, cf1: 2830, ratio: 3.73, i0: 1100, i1: 15, peak: 0.2, send: 0.45 });
	        const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 4310;
	        o.connect(this.vca(t + 0.04, 0.07, 0.3, { send: 0.3 })); o.start(t + 0.04); o.stop(t + 0.4);
	        this.sub(t + 0.03, 160, 60, 0.07, 0.35);
	      } else if (name === 'ink_boot') {
	        // two taiko hits, then a breathy flute note
	        [0, 0.3].forEach((dt, i) => {
	          this.sub(t + dt, 100, 46, 0.55, i ? 0.95 : 0.7);
	          const n = this.noise(0.14); const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
	          n.connect(lp); lp.connect(this.vca(t + dt, i ? 0.6 : 0.45, 0.13)); n.start(t + dt);
	        });
	        const f = this.ctx.createOscillator(); f.type = 'sine'; f.frequency.setValueAtTime(587, t + 0.62);
	        f.frequency.linearRampToValueAtTime(622, t + 0.75); f.frequency.linearRampToValueAtTime(587, t + 1.3);
	        const lfo = this.ctx.createOscillator(); lfo.frequency.value = 5.5; const ld = this.ctx.createGain(); ld.gain.value = 7;
	        lfo.connect(ld); ld.connect(f.frequency);
	        f.connect(this.vca(t + 0.62, 0.2, 0.75, { attack: 0.12, send: 0.5 })); f.start(t + 0.62); lfo.start(t + 0.62); f.stop(t + 1.45); lfo.stop(t + 1.45);
	        const br = this.noise(0.75); const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 9;
	        br.connect(bp); bp.connect(this.vca(t + 0.62, 0.12, 0.7, { attack: 0.1 })); br.start(t + 0.62);
	      } else if (name === 'ink_finish') {
	        // temple gong
	        this.fm(t, 2.4, { cf0: 98, cf1: 96, ratio: 1.41, i0: 320, i1: 15, peak: 0.55, send: 0.5 });
	        this.fm(t, 1.9, { cf0: 196, cf1: 193, ratio: 2.76, i0: 260, i1: 8, peak: 0.22, send: 0.4 });
	        const n = this.noise(1.2); const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
	        n.connect(hp); hp.connect(this.vca(t, 0.08, 1.2, { attack: 0.02 })); n.start(t);
	        this.sub(t, 70, 45, 0.6, 0.6);
	      } else if (name === 'surge_zap') {
	        // impact punch
	        const now = performance.now(); if (now - this.lastZap < 70) return; this.lastZap = now;
	        const w = this.noise(0.1); const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.5;
	        bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(2400, t + 0.06);
	        w.connect(bp); bp.connect(this.vca(t, 0.25, 0.07, { attack: 0.02 })); w.start(t);
	        const n = this.noise(0.08); const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
	        const sh = this.shaper(30); n.connect(lp); lp.connect(sh); sh.connect(this.vca(t + 0.05, 0.6, 0.08)); n.start(t + 0.05);
	        this.sub(t + 0.05, 150, 42, 0.16, 0.85);
	      } else if (name === 'surge_boot') {
	        // power-up charge then blast
	        const o = this.ctx.createOscillator(); o.type = 'sawtooth';
	        o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(880, t + 0.85);
	        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass';
	        lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(5000, t + 0.85);
	        const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.8); g.gain.linearRampToValueAtTime(0, t + 0.87);
	        o.connect(lp); lp.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.9);
	        const r = this.noise(0.85); const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
	        bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(7000, t + 0.85);
	        const rg = this.ctx.createGain(); rg.gain.setValueAtTime(0.0001, t); rg.gain.linearRampToValueAtTime(0.3, t + 0.84); rg.gain.linearRampToValueAtTime(0, t + 0.86);
	        r.connect(bp); bp.connect(rg); rg.connect(this.out); r.start(t);
	        const b = this.noise(0.6); const blp = this.ctx.createBiquadFilter(); blp.type = 'lowpass'; blp.frequency.value = 2200;
	        const sh = this.shaper(20); b.connect(blp); blp.connect(sh); sh.connect(this.vca(t + 0.88, 0.6, 0.55, { send: 0.3 })); b.start(t + 0.88);
	        this.sub(t + 0.88, 70, 26, 0.9, 0.9);
	      } else if (name === 'surge_finish') {
	        const b = this.noise(0.9); const blp = this.ctx.createBiquadFilter(); blp.type = 'lowpass'; blp.frequency.value = 1800;
	        const sh = this.shaper(25); b.connect(blp); blp.connect(sh); sh.connect(this.vca(t, 0.6, 0.85, { send: 0.35 })); b.start(t);
	        this.sub(t, 65, 24, 1.1, 0.9);
	        [523, 659, 784, 1047].forEach((f, i) => {
	          const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
	          o.connect(this.vca(t + 0.35 + i * 0.07, 0.14, 0.9, { attack: 0.02, send: 0.4 })); o.start(t + 0.35 + i * 0.07); o.stop(t + 1.4 + i * 0.07);
	        });
	      } else if (name === 'cosmic_zap') {
	        // laser pew
	        const now = performance.now(); if (now - this.lastZap < 70) return; this.lastZap = now;
	        const o = this.ctx.createOscillator(); o.type = 'sawtooth';
	        o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(170, t + 0.14);
	        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
	        o.connect(lp); lp.connect(this.vca(t, 0.2, 0.14, { send: 0.3 })); o.start(t); o.stop(t + 0.18);
	        const s = this.ctx.createOscillator(); s.type = 'sine';
	        s.frequency.setValueAtTime(2600, t); s.frequency.exponentialRampToValueAtTime(320, t + 0.11);
	        s.connect(this.vca(t, 0.22, 0.11)); s.start(t); s.stop(t + 0.14);
	        this.blip(t + 0.12, 880, 0.03, 0.12);
	      } else if (name === 'cosmic_boot') {
	        // theremin swoop + boops
	        const o = this.ctx.createOscillator(); o.type = 'sine';
	        o.frequency.setValueAtTime(280, t); o.frequency.exponentialRampToValueAtTime(920, t + 0.7); o.frequency.exponentialRampToValueAtTime(660, t + 1.1);
	        const lfo = this.ctx.createOscillator(); lfo.frequency.value = 6.5; const ld = this.ctx.createGain(); ld.gain.value = 14;
	        lfo.connect(ld); ld.connect(o.frequency);
	        o.connect(this.vca(t, 0.3, 1.15, { attack: 0.15, send: 0.6 })); o.start(t); lfo.start(t); o.stop(t + 1.2); lfo.stop(t + 1.2);
	        [523, 784, 1047].forEach((f, i) => this.blip(t + 0.75 + i * 0.09, f, 0.06, 0.2));
	        this.sub(t, 60, 40, 0.6, 0.5);
	      } else if (name === 'cosmic_finish') {
	        // slide whistle down + boop boop
	        const o = this.ctx.createOscillator(); o.type = 'sine';
	        o.frequency.setValueAtTime(1700, t); o.frequency.exponentialRampToValueAtTime(240, t + 0.75);
	        const lfo = this.ctx.createOscillator(); lfo.frequency.value = 9; const ld = this.ctx.createGain(); ld.gain.value = 25;
	        lfo.connect(ld); ld.connect(o.frequency);
	        o.connect(this.vca(t, 0.3, 0.78, { attack: 0.03, send: 0.4 })); o.start(t); lfo.start(t); o.stop(t + 0.82); lfo.stop(t + 0.82);
	        this.blip(t + 0.85, 440, 0.1, 0.28); this.blip(t + 1.0, 330, 0.16, 0.28);
	        this.sub(t + 0.85, 90, 40, 0.4, 0.6);
	      } else if (name === 'beam') {
	        const o = this.ctx.createOscillator(); o.type = 'sine';
	        o.frequency.setValueAtTime(220, t); o.frequency.linearRampToValueAtTime(330, t + 0.7);
	        const lfo = this.ctx.createOscillator(); lfo.frequency.value = 11; const ld = this.ctx.createGain(); ld.gain.value = 18;
	        lfo.connect(ld); ld.connect(o.frequency);
	        o.connect(this.vca(t, 0.16, 0.75, { attack: 0.08, send: 0.35 })); o.start(t); lfo.start(t); o.stop(t + 0.8); lfo.stop(t + 0.8);
	      } else if (name === 'chomp') {
	        // tiny crunchy bite
	        const n = this.noise(0.035);
	        const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 1400; bp.Q.value = 3;
	        const cr = this.crusher(6);
	        n.connect(bp); bp.connect(cr); cr.connect(this.vca(t, 0.22, 0.03, { attack: 0.001 })); n.start(t);
	        this.blip(t, 300 + Math.random() * 200, 0.012, 0.08, 0);
	      } else if (name === 'click') {
	        this.chatter(t, 2, 0.02, 0.18);
	      }
	    } catch (e) { console.debug('[reaper sfx]', e); }
	  },
	};

	// ---------- Awakening intro (first open per page load) ----------
	let introPlayed = false;
	function playIntro() {
	  const win = ui.undiscordWindow;
	  if (introPlayed || !win) return;
	  introPlayed = true;
	  if (!fxOn() || prefersReducedMotion()) return;

	  const ov = document.createElement('div');
	  ov.className = 'ud-intro';
	  ov.innerHTML = '<div class="ud-crt"></div><div class="ud-skullbox"></div><div class="ud-brand"></div><div class="ud-skip">click to skip</div>';
	  ov.querySelector('.ud-brand').textContent = BRAND_NAME;
	  const box = ov.querySelector('.ud-skullbox');
	  const pk = currentPack();
	  const isArt = pk.kind === 'art';
	  const cells = isArt ? pxCells(pk.icon, pk.pal) : SKULL_CELLS.map(([x, y]) => [x, y, '']);
	  const gw = isArt ? Math.max(...pk.icon.map(r => r.length)) : 7;
	  const gh = isArt ? pk.icon.length : 7;
	  const cs = Math.floor(98 / Math.max(gw, gh));
	  box.style.width = (gw * cs) + 'px';
	  box.style.height = (gh * cs) + 'px';
	  for (const [x, y, col] of cells) {
	    const px = document.createElement('div');
	    px.className = 'ud-px';
	    px.style.width = px.style.height = cs + 'px';
	    if (col) { px.style.background = col; px.style.boxShadow = `0 0 6px ${col}`; }
	    px.style.left = (x * cs) + 'px';
	    px.style.top = (y * cs) + 'px';
	    const a = Math.random() * Math.PI * 2;
	    const r = 180 + Math.random() * 260;
	    px.style.transform = `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px) rotate(${(Math.random() * 360) | 0}deg) scale(${(0.4 + Math.random()).toFixed(2)})`;
	    px.style.transitionDelay = `${(Math.random() * 0.22).toFixed(3)}s`;
	    box.appendChild(px);
	  }
	  for (const [x, y] of (isArt ? [] : SKULL_EYES)) {
	    const eye = document.createElement('div');
	    eye.className = 'ud-eye';
	    eye.style.left = (x * 14) + 'px';
	    eye.style.top = (y * 14) + 'px';
	    box.appendChild(eye);
	  }
	  win.appendChild(ov);
	  sfx.play('boot');

	  const timers = [];
	  const end = () => { timers.forEach(clearTimeout); ov.classList.add('out'); setTimeout(() => ov.remove(), 320); };
	  ov.addEventListener('click', end);
	  timers.push(setTimeout(() => box.classList.add('assemble'), 330));
	  timers.push(setTimeout(() => { box.classList.add('ignite'); ov.classList.add('ignite'); }, 900));
	  timers.push(setTimeout(end, 1650));
	}

	// ---------- Text decay on new deletion cards ----------
	const DECAY_CHARS = '░▒▓█#$%&@01<>/\\|!?*+=';
	function decayLastCard() {
	  if (!fxOn() || prefersReducedMotion()) return;
	  if (ui.undiscordWindow.classList.contains('hide-text')) return;
	  const cards = ui.logArea.querySelectorAll('.log-del');
	  const el = cards[cards.length - 1]?.querySelector('.msgText');
	  if (!el) return;
	  const finalText = el.textContent;
	  if (!finalText) return;
	  const head = finalText.slice(0, 140);
	  const tail = finalText.slice(140);
	  const dur = 520;
	  const t0 = performance.now();
	  const step = (now) => {
	    if (!el.isConnected) return;
	    const p = Math.min(1, (now - t0) / dur);
	    const settled = Math.floor(p * p * head.length);
	    let out = head.slice(0, settled);
	    for (let i = settled; i < head.length; i++) {
	      const ch = head[i];
	      out += (ch === ' ') ? ' ' : DECAY_CHARS[(Math.random() * DECAY_CHARS.length) | 0];
	    }
	    el.textContent = out + (p >= 1 ? tail : '');
	    if (p < 1) requestAnimationFrame(step);
	    else el.textContent = finalText;
	  };
	  requestAnimationFrame(step);
	}

	// ---------- Digital bug that eats deleted messages (skull packs) ----------
	const BUG_BASE = [
	  '.......a.a.',
	  '..bbbbb..a.',
	  '.bbcbcbbhh.',
	  'bbbbbbbbhe.',
	  '.bbcbcbbhh.',
	  '..bbbbb....',
	];
	const BUG_LEGS_A = '.l.l.l.....';
	const BUG_LEGS_B = 'l.l.l......';
	const BUG_PAL = { a: '#ff8a96', b: '#ff2a44', c: '#ffe3e6', h: '#a8001c', e: '#ffffff', l: '#ff8a96', m: '#ffffff' };
	const BUG_SVG = (() => {
	  const frame = (legs, open) => {
	    const rows = BUG_BASE.slice();
	    const set = (y, x, ch) => { rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); };
	    if (open) { set(2, 10, 'm'); set(4, 10, 'm'); } else set(3, 10, 'm');
	    return pxRects([...rows, legs], BUG_PAL);
	  };
	  return `<svg viewBox="0 0 11 7" width="28" height="18" shape-rendering="crispEdges">` +
	    `<g class="bug-a">${frame(BUG_LEGS_A, true)}</g><g class="bug-b">${frame(BUG_LEGS_B, false)}</g></svg>`;
	})();
	const CRUMB_CHARS = '░▒▓#%&01';
	let activeBug = null;

	function animateNewCard() {
	  const id = currentPackId;
	  if (id === 'ink') sliceLastCard();
	  else if (id === 'surge') strikeLastCard();
	  else if (id === 'cosmic') abductLastCard();
	  else bugEatLastCard();
	}

	function bugEatLastCard() {
	  if (activeBug) activeBug.finish();
	  if (typeof activeKill !== 'undefined' && activeKill) activeKill.finish();
	  if (!fxOn() || prefersReducedMotion()) return;
	  if (ui.undiscordWindow.classList.contains('hide-text')) return;
	  const cards = ui.logArea.querySelectorAll('.log-del');
	  const card = cards[cards.length - 1];
	  const el = card?.querySelector('.msgText');
	  const host = card?.querySelector('.content');
	  if (!el || !host) return;
	  const text = el.textContent;
	  if (!text.trim()) return;

	  const chars = Array.from(text);
	  const LIMIT = 220;
	  const head = chars.slice(0, LIMIT);
	  const tail = chars.slice(LIMIT).join('');
	  el.textContent = '';
	  const spans = head.map(ch => {
	    const sp = document.createElement('span');
	    sp.className = 'bug-ch';
	    sp.textContent = ch;
	    el.appendChild(sp);
	    return sp;
	  });
	  if (tail) el.appendChild(document.createTextNode(tail));

	  const bug = document.createElement('div');
	  bug.className = 'ud-bug';
	  bug.innerHTML = BUG_SVG;
	  host.appendChild(bug);

	  const dur = Math.max(380, Math.min(950, spans.length * 20));
	  const t0 = performance.now();
	  let eaten = 0, lastChomp = 0, done = false;

	  const place = (sp) => {
	    const hr = host.getBoundingClientRect();
	    const r = sp.getBoundingClientRect();
	    bug.style.transform = `translate(${(r.left - hr.left - 8).toFixed(1)}px, ${(r.top - hr.top + r.height / 2 - 9).toFixed(1)}px)`;
	  };
	  const crumbFrom = (sp) => {
	    const hr = host.getBoundingClientRect();
	    const r = sp.getBoundingClientRect();
	    const c = document.createElement('i');
	    c.className = 'ud-crumb';
	    c.style.left = (r.left - hr.left) + 'px';
	    c.style.top = (r.top - hr.top + r.height / 2) + 'px';
	    c.style.setProperty('--dx', (-8 - Math.random() * 14).toFixed(1) + 'px');
	    c.style.setProperty('--dy', (-8 + Math.random() * 16).toFixed(1) + 'px');
	    host.appendChild(c);
	    setTimeout(() => c.remove(), 420);
	  };
	  const finish = () => {
	    if (done) return;
	    done = true;
	    if (activeBug === job) activeBug = null;
	    bug.remove();
	    host.querySelectorAll('.ud-crumb').forEach(c => c.remove());
	    el.textContent = text;
	    el.classList.add('remains');
	  };
	  const job = { finish };
	  activeBug = job;
	  place(spans[0]);

	  const step = (now) => {
	    if (done) return;
	    if (!el.isConnected) { done = true; if (activeBug === job) activeBug = null; return; }
	    const p = Math.min(1, (now - t0) / dur);
	    const target = Math.floor(p * spans.length);
	    while (eaten < target) {
	      const sp = spans[eaten];
	      sp.classList.add('crumb');
	      if (sp.textContent.trim()) sp.textContent = CRUMB_CHARS[(Math.random() * CRUMB_CHARS.length) | 0];
	      const prev = spans[eaten - 2];
	      if (prev) prev.classList.add('gone');
	      if (eaten % 3 === 0) crumbFrom(sp);
	      eaten++;
	    }
	    const cur = spans[Math.min(eaten, spans.length - 1)];
	    if (cur) place(cur);
	    bug.classList.toggle('chomp', ((now / 70) | 0) % 2 === 0);
	    if (now - lastChomp > 95) { lastChomp = now; sfx.play('chomp'); }
	    if (p < 1) { requestAnimationFrame(step); return; }
	    spans.forEach(sp => sp.classList.add('gone'));
	    // scuttle off and fade, then the remains come back crossed out
	    bug.classList.add('leaving');
	    setTimeout(finish, 260);
	  };
	  requestAnimationFrame(step);
	}

	// ---------- Signature kills for art packs (slice / strike / abduct) ----------
	let activeKill = null;
	function killPrelude() {
	  if (activeKill) activeKill.finish();
	  if (activeBug) activeBug.finish();
	  if (!fxOn() || prefersReducedMotion()) return null;
	  if (ui.undiscordWindow.classList.contains('hide-text')) return null;
	  const cards = ui.logArea.querySelectorAll('.log-del');
	  const card = cards[cards.length - 1];
	  const el = card?.querySelector('.msgText');
	  const host = card?.querySelector('.content');
	  if (!el || !host) return null;
	  const text = el.textContent;
	  if (!text.trim()) return null;
	  return { card, el, host, text };
	}
	function killJob(ctx, cleanup) {
	  let done = false;
	  const job = {
	    finish() {
	      if (done) return;
	      done = true;
	      if (activeKill === job) activeKill = null;
	      try { cleanup(); } catch {}
	      ctx.el.style.visibility = '';
	      ctx.el.textContent = ctx.text;
	      ctx.el.classList.add('remains');
	    },
	    get done() { return done; },
	  };
	  activeKill = job;
	  return job;
	}
	function splitToSpans(el, text, limit = 220) {
	  const chars = Array.from(text);
	  el.textContent = '';
	  const spans = chars.slice(0, limit).map(ch => { const sp = document.createElement('span'); sp.className = 'k-ch'; sp.textContent = ch; el.appendChild(sp); return sp; });
	  if (chars.length > limit) el.appendChild(document.createTextNode(chars.slice(limit).join('')));
	  return spans;
	}
	function relRect(host, node) {
	  const h = host.getBoundingClientRect(), r = node.getBoundingClientRect();
	  return { x: r.left - h.left, y: r.top - h.top, w: r.width, h: r.height };
	}
	function particle(host, x, y, cls, dx, dy, ms = 500) {
	  const p = document.createElement('i');
	  p.className = 'k-part ' + cls;
	  p.style.left = x + 'px'; p.style.top = y + 'px';
	  p.style.setProperty('--dx', dx.toFixed(1) + 'px'); p.style.setProperty('--dy', dy.toFixed(1) + 'px');
	  p.style.animationDuration = ms + 'ms';
	  host.appendChild(p);
	  setTimeout(() => p.remove(), ms + 30);
	  return p;
	}

	// Ink Blade: one clean katana slash, the message splits in two and slides apart
	function sliceLastCard() {
	  const ctx = killPrelude(); if (!ctx) return;
	  const { el, host, text } = ctx;
	  const box = relRect(host, el);
	  const layer = document.createElement('div');
	  layer.className = 'k-slice';
	  layer.innerHTML = `<span class="k-half k-top"></span><span class="k-half k-bot"></span><i class="k-slash"></i>`;
	  layer.querySelectorAll('.k-half').forEach(h => { h.textContent = text; });
	  host.appendChild(layer);
	  el.style.visibility = 'hidden';
	  const job = killJob(ctx, () => layer.remove());
	  requestAnimationFrame(() => layer.classList.add('go'));
	  setTimeout(() => {
	    if (job.done) return;
	    layer.classList.add('split');
	    const lineY = Math.min(box.h, 18) / 2;
	    for (let i = 0; i < 7; i++) particle(host, Math.random() * Math.max(40, box.w), lineY, 'petal', 10 + Math.random() * 30, -16 + Math.random() * 32, 650);
	  }, 130);
	  setTimeout(() => job.finish(), 720);
	}

	// Power Surge: lightning strikes the message, it charges up and blows apart
	function strikeLastCard() {
	  const ctx = killPrelude(); if (!ctx) return;
	  const { card, el, host, text } = ctx;
	  const spans = splitToSpans(el, text);
	  if (!spans.length) return;
	  const hit = spans[Math.floor(spans.length * (0.25 + Math.random() * 0.5))] || spans[0];
	  const hr = relRect(host, hit);
	  const bolt = document.createElement('div');
	  bolt.className = 'k-bolt';
	  bolt.innerHTML = `<svg viewBox="0 0 16 44" width="20" height="54"><polyline points="9,0 3,15 10,17 2,31 12,24 7,44" fill="none" stroke="#fff7c2" stroke-width="2.4" stroke-linejoin="bevel"/></svg>`;
	  bolt.style.left = (hr.x + hr.w / 2 - 10) + 'px';
	  bolt.style.top = (hr.y + hr.h / 2 - 54) + 'px';
	  host.appendChild(bolt);
	  card.classList.add('k-struck');
	  const job = killJob(ctx, () => { bolt.remove(); card.classList.remove('k-struck'); });
	  spans.forEach(sp => sp.classList.add('charged'));
	  setTimeout(() => {
	    if (job.done) return;
	    const cx = hr.x + hr.w / 2, cy = hr.y + hr.h / 2;
	    spans.forEach(sp => {
	      const r = relRect(host, sp);
	      const ax = r.x + r.w / 2 - cx, ay = r.y + r.h / 2 - cy;
	      const d = Math.max(6, Math.hypot(ax, ay));
	      const f = 18 + Math.random() * 26;
	      sp.style.transform = `translate(${(ax / d * f + (Math.random() - .5) * 10).toFixed(1)}px, ${(ay / d * f - 6 - Math.random() * 14).toFixed(1)}px) rotate(${((Math.random() - .5) * 120) | 0}deg) scale(.6)`;
	      sp.classList.add('blown');
	    });
	    for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28, r = 14 + Math.random() * 30; particle(host, cx, cy, 'spark', Math.cos(a) * r, Math.sin(a) * r, 420); }
	  }, 210);
	  setTimeout(() => job.finish(), 760);
	}

	// Cosmic Mess: a UFO hovers over the text and beams the letters up one by one
	const UFO_ROWS = ICON_COSMIC.slice(0, 6);
	function abductLastCard() {
	  const ctx = killPrelude(); if (!ctx) return;
	  const { el, host, text } = ctx;
	  const spans = splitToSpans(el, text);
	  if (!spans.length) return;
	  const ufo = document.createElement('div');
	  ufo.className = 'k-ufo';
	  ufo.innerHTML = `<i class="k-beam"></i>${pxSvg(UFO_ROWS, PAL_COSMIC, { size: 30, pad: 0 })}`;
	  host.appendChild(ufo);
	  const job = killJob(ctx, () => ufo.remove());
	  sfx.play('beam');
	  const dur = Math.max(450, Math.min(1000, spans.length * 22));
	  const t0 = performance.now();
	  let taken = 0;
	  const place = (sp) => { const r = relRect(host, sp); ufo.style.transform = `translate(${(r.x + r.w / 2 - 15).toFixed(1)}px, ${(r.y - 26).toFixed(1)}px)`; return r; };
	  place(spans[0]);
	  const step = (now) => {
	    if (job.done) return;
	    if (!el.isConnected) { job.finish(); return; }
	    const p = Math.min(1, (now - t0) / dur);
	    const target = Math.floor(p * spans.length);
	    while (taken < target) {
	      const sp = spans[taken];
	      const r = relRect(host, sp);
	      const ur = place(sp);
	      sp.style.transform = `translate(${(ur.x - r.x) * 0}px, ${-(r.y - ur.y + 22)}px) scale(.15)`;
	      sp.classList.add('lifted');
	      taken++;
	    }
	    const cur = spans[Math.min(taken, spans.length - 1)];
	    if (cur) place(cur);
	    if (p < 1) { requestAnimationFrame(step); return; }
	    ufo.classList.add('away');
	    setTimeout(() => job.finish(), 380);
	  };
	  requestAnimationFrame(step);
	}

	// ---------- Skull rain (canvas behind the log, only while running) ----------
	const rain = {
	  raf: 0, drops: [], w: 0, h: 0, last: 0, active: false,
	  canvas() { return ui.undiscordWindow?.querySelector('#skullRain'); },
	  resize(c) {
	    const dpr = window.devicePixelRatio || 1;
	    const w = c.clientWidth, h = c.clientHeight;
	    if (w === this.w && h === this.h) return;
	    this.w = w; this.h = h;
	    c.width = Math.max(1, Math.floor(w * dpr));
	    c.height = Math.max(1, Math.floor(h * dpr));
	    c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
	  },
	  spawn(randomY) {
	    const spec = currentRainSpec();
	    const spr = spec.sprites[(Math.random() * spec.sprites.length) | 0];
	    const info = spriteCellsOf(spr);
	    const s = 2 + ((Math.random() * 3) | 0);
	    const hpx = info.h * s;
	    const startY = spec.dir > 0 ? -hpx - Math.random() * 80 : this.h + Math.random() * 80;
	    return { spr: info, x: Math.random() * Math.max(1, this.w - s * info.w), x0: 0, y: randomY ? Math.random() * this.h : startY,
	      v: (18 + Math.random() * 40 + s * 6) * (spec.speed || 1) * (spec.dir || 1), s,
	      a: spec.alpha[0] + Math.random() * (spec.alpha[1] - spec.alpha[0]),
	      sway: spec.sway || 0, ph: Math.random() * 6.28, tint: !!spec.skull };
	  },
	  start() {
	    if (this.active || !fxOn() || prefersReducedMotion()) return;
	    const c = this.canvas();
	    if (!c) return;
	    this.active = true;
	    this.resize(c);
	    this.drops = Array.from({ length: currentRainSpec().count }, () => this.spawn(true));
	    ui.undiscordWindow.classList.add('raining');
	    this.last = performance.now();
	    const ctx = c.getContext('2d');
	    const frame = (now) => {
	      if (!this.active) return;
	      this.raf = requestAnimationFrame(frame);
	      if (document.hidden || ui.undiscordWindow.style.display === 'none') { this.last = now; return; }
	      const dt = Math.min(0.1, (now - this.last) / 1000);
	      this.last = now;
	      this.resize(c);
	      ctx.clearRect(0, 0, this.w, this.h);
	      for (let i = 0; i < this.drops.length; i++) {
	        const d = this.drops[i];
	        d.y += d.v * dt;
	        d.ph += dt * 1.6;
	        if ((d.v > 0 && d.y > this.h + 10) || (d.v < 0 && d.y < -60)) { this.drops[i] = this.spawn(false); continue; }
	        const ox = d.sway ? Math.sin(d.ph) * d.sway : 0;
	        ctx.globalAlpha = d.a;
	        for (const [x, y, col] of d.spr.cells) {
	          ctx.fillStyle = col;
	          ctx.fillRect(Math.round(d.x + ox + x * d.s), Math.round(d.y + y * d.s), d.s, d.s);
	        }
	      }
	      ctx.globalAlpha = 1;
	    };
	    this.raf = requestAnimationFrame(frame);
	  },
	  stop() {
	    if (!this.active) return;
	    ui.undiscordWindow.classList.remove('raining');
	    setTimeout(() => {
	      if (ui.undiscordWindow.classList.contains('raining')) return;
	      this.active = false;
	      cancelAnimationFrame(this.raf);
	      const c = this.canvas();
	      c?.getContext('2d').clearRect(0, 0, c.width, c.height);
	    }, 850);
	  },
	};

	// ---------- SIGNAL LOST cooldown overlay ----------
	const signalLost = {
	  until: 0, timer: null, restoreTimer: null,
	  show(ms) {
	    const win = ui.undiscordWindow;
	    if (!win || !(ms > 0)) return;
	    const wasLost = win.classList.contains('signal-lost');
	    this.until = Math.max(this.until, Date.now() + ms);
	    clearTimeout(this.restoreTimer);
	    win.classList.remove('signal-restored');
	    win.classList.add('signal-lost');
	    win.querySelector('#signalLost .sl-title').textContent = 'SIGNAL LOST';
	    win.querySelector('#signalLost .sl-title').dataset.text = 'SIGNAL LOST';
	    if (!wasLost) { sfx.play('glitch'); try { window.ReaperApp?.haptic?.(1); } catch {} }
	    this.tick();
	    clearInterval(this.timer);
	    this.timer = setInterval(() => this.tick(), 100);
	  },
	  tick() {
	    const win = ui.undiscordWindow;
	    const left = this.until - Date.now();
	    const el = win.querySelector('#slCount');
	    if (left <= 0) { this.restore(); return; }
	    // jittery countdown: occasionally flash a garbage digit
	    el.textContent = Math.random() < 0.08 ? String((Math.random() * 99) | 0) : String(Math.ceil(left / 1000));
	  },
	  restore() {
	    const win = ui.undiscordWindow;
	    clearInterval(this.timer);
	    this.timer = null;
	    this.until = 0;
	    if (!win.classList.contains('signal-lost')) return;
	    win.classList.remove('signal-lost');
	    win.classList.add('signal-restored');
	    const title = win.querySelector('#signalLost .sl-title');
	    title.textContent = 'SIGNAL RESTORED';
	    title.dataset.text = 'SIGNAL RESTORED';
	    sfx.play('restore');
	    this.restoreTimer = setTimeout(() => win.classList.remove('signal-restored'), 700);
	  },
	  hide() {
	    clearInterval(this.timer);
	    clearTimeout(this.restoreTimer);
	    this.timer = null;
	    this.until = 0;
	    ui.undiscordWindow?.classList.remove('signal-lost', 'signal-restored');
	  },
	};

	// ---------- Run tracking: speedometer, title, finish screen ----------
	const run = { startTs: 0, deleteTimes: [], oldestTs: null, throttleBase: 0, savedTitle: '', finishShown: true };

	function reaperRunStart(stats) {
	  run.startTs = Date.now();
	  run.deleteTimes = [];
	  run.oldestTs = null;
	  run.throttleBase = Number(stats?.throttledCount || 0);
	  run.savedTitle = document.title.startsWith('☠') ? run.savedTitle : document.title;
	  run.finishShown = false;
	  run.appNotified = false;
	  const sp = ui.undiscordWindow.querySelector('#speedo');
	  if (sp) { sp.style.display = ''; sp.querySelector('b').textContent = '0'; }
	  sfx.init();
	  try { window.ReaperApp?.setRunning?.(true); } catch {}
	  setRunner(0);
	  ui.undiscordWindow.classList.add('is-running');
	  rain.start();
	}

	function reaperOnDeleted(message) {
	  const now = Date.now();
	  run.deleteTimes.push(now);
	  const ts = message?.timestamp ? new Date(message.timestamp).getTime() : NaN;
	  if (Number.isFinite(ts) && (run.oldestTs === null || ts < run.oldestTs)) run.oldestTs = ts;
	  sfx.play('zap');
	  try { window.ReaperApp?.haptic?.(0); } catch {}
	  updateSpeedo();
	}

	function currentRate() {
	  const now = Date.now();
	  while (run.deleteTimes.length && now - run.deleteTimes[0] > 60000) run.deleteTimes.shift();
	  const windowMs = Math.min(60000, Math.max(5000, now - run.startTs));
	  return Math.round(run.deleteTimes.length * 60000 / windowMs);
	}

	function updateSpeedo() {
	  const b = ui.undiscordWindow?.querySelector('#speedo b');
	  if (b) b.textContent = String(currentRate());
	}

	function reaperRunStop(state, stats) {
	  try {
	    if (window.ReaperApp?.finished && !run.appNotified) {
	      run.appNotified = true;
	      window.ReaperApp.finished(state.delCount | 0, state.failCount | 0, String(state.endReason || 'DONE'), !!undiscordCore.options.previewMode);
	    }
	  } catch {}
	  try { window.ReaperApp?.setRunning?.(false); } catch {}
	  ui.undiscordWindow.classList.remove('is-running');
	  rain.stop();
	  signalLost.hide();
	  if (run.savedTitle) document.title = run.savedTitle;
	  const sp = ui.undiscordWindow.querySelector('#speedo');
	  if (sp) sp.style.display = 'none';
	  if (run.finishShown) return;
	  if (state.endReason !== 'DONE' && state.endReason !== 'STOPPED') return;
	  run.finishShown = true;

	  const deleted = state.delCount;
	  const failed = state.failCount;
	  const elapsedMs = Math.max(0, Date.now() - run.startTs);
	  const perMin = elapsedMs > 0 ? Math.round(deleted * 60000 / Math.max(elapsedMs, 1000)) : 0;
	  const throttles = Math.max(0, Number(stats?.throttledCount || 0) - run.throttleBase);
	  const preview = !!undiscordCore.options.previewMode;

	  if (ui.undiscordWindow.querySelector('#notifyDone')?.checked && document.hidden && window.Notification?.permission === 'granted') {
	    try { new Notification(`${BRAND_NAME}: ${state.endReason === 'DONE' ? 'done' : 'stopped'}`, { body: `☠ ${deleted} ${preview ? 'simulated' : 'deleted'}, ${failed} failed` }); } catch {}
	  }
	  const report = { deleted, failed, elapsedMs, perMin, throttles, oldestTs: run.oldestTs, preview, stopped: state.endReason === 'STOPPED' };
	  runDecay(() => { sfx.play('finish'); try { window.ReaperApp?.haptic?.(2); } catch {} udFinishScreen(report); });
	}

	function udFinishScreen({ deleted, failed, elapsedMs, perMin, throttles, oldestTs, preview, stopped }) {
	  ensureModalCss();
	  const packFinish = currentPack().finish;
	  const title = preview ? 'DRY RUN COMPLETE' : (stopped ? 'PURGE STOPPED' : (packFinish ? packFinish[0] : 'PURGE COMPLETE'));
	  const oldest = oldestTs ? new Date(oldestTs).toLocaleDateString() : 'n/a';
	  const overlay = document.createElement('div');
	  overlay.id = 'ud-overlay';
	  overlay.innerHTML = `
<div id="ud-modal" role="dialog" aria-modal="true" aria-labelledby="ud-title">
  <div class="ud-head">
    <div class="ud-skull">${packIconSvg(46)}</div>
    <div><h2 id="ud-title">${title}</h2><p class="ud-sub">${preview ? 'Nothing was actually deleted.' : (stopped ? "You pulled the plug. Here's the damage so far." : (packFinish ? packFinish[1] : "Target eliminated. Here's the damage report."))}</p></div>
  </div>
  <div class="ud-big"><b>${deleted}</b><span>${preview ? 'messages simulated' : 'messages deleted'}</span></div>
  <div class="ud-grid">
    <div class="ud-stat"><b>${escapeHTML(msToHMS(elapsedMs))}</b><span>time</span></div>
    <div class="ud-stat"><b>${perMin}</b><span>per minute</span></div>
    <div class="ud-stat"><b>${failed}</b><span>failed</span></div>
    <div class="ud-stat"><b>${throttles}</b><span>cooldowns hit</span></div>
    <div class="ud-stat" style="grid-column: span 2"><b>${escapeHTML(oldest)}</b><span>oldest message hit</span></div>
  </div>
  <div class="ud-actions"><button id="ud-close" class="ud-go">Close<kbd>Esc</kbd></button></div>
</div>`;
	  document.body.appendChild(overlay);
	  const close = () => { document.removeEventListener('keydown', onKey, true); overlay.remove(); };
	  const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); close(); } else e.stopPropagation(); };
	  document.addEventListener('keydown', onKey, true);
	  overlay.querySelector('#ud-close').onclick = close;
	  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
	  setTimeout(() => overlay.querySelector('#ud-close').focus(), 30);
	}


	// ---------- Running skeleton (12x18 pixel sprite, 4-frame run cycle) ----------
	const SK_BONE = '#ffe3e6', SK_FAR = '#a9767d', SK_EYE = '#ff2a44';
	const SK_HEAD = [
	  '...######...',
	  '..########..',
	  '..#ee##ee#..',
	  '..#ee##ee#..',
	  '..###..###..',
	  '...######...',
	  '...#.##.#...',
	];
	const SK_TORSO = [
	  '.....##.....',
	  '...######...',
	  '...#.##.#...',
	  '....####....',
	  '...#.##.#...',
	  '....####....',
	];
	const SK_LIMBS = {
	  armFwd:  [[9, 9], [10, 10], [10, 11]],
	  armBack: [[2, 9], [1, 10], [1, 11]],
	  armMidL: [[2, 9], [2, 10], [3, 11]],
	  armMidR: [[9, 9], [9, 10], [8, 11]],
	  legFwd:  [[7, 13], [8, 14], [9, 15], [9, 16], [9, 17], [10, 17]],
	  legBack: [[4, 13], [3, 14], [2, 15], [1, 16], [0, 16]],
	  legPlant:[[6, 13], [6, 14], [6, 15], [6, 16], [6, 17], [7, 17]],
	  legBent: [[5, 13], [5, 14], [4, 15], [3, 15]],
	};
	// each frame: [far limbs], [near limbs], vertical bob
	const SK_FRAMES = [
	  { far: ['legBack', 'armFwd'],  near: ['legFwd', 'armBack'],  dy: 0 },
	  { far: ['legBent', 'armMidR'], near: ['legPlant', 'armMidL'], dy: -1 },
	  { far: ['legFwd', 'armBack'],  near: ['legBack', 'armFwd'],  dy: 0 },
	  { far: ['legPlant', 'armMidL'], near: ['legBent', 'armMidR'], dy: -1 },
	];
	function skRows(rows, y0, dy) {
	  let out = '';
	  rows.forEach((row, y) => [...row].forEach((c, x) => {
	    if (c === '.') return;
	    out += `<rect x="${x}" y="${y + y0 + dy}" width="1" height="1" fill="${c === 'e' ? SK_EYE : SK_BONE}"/>`;
	  }));
	  return out;
	}
	function skLimbs(names, color, dy) {
	  return names.map(n => SK_LIMBS[n].map(([x, y]) => `<rect x="${x}" y="${y + dy}" width="1" height="1" fill="${color}"/>`).join('')).join('');
	}
	const RUNNER_SVG = `<svg viewBox="0 -1 12 19" width="24" height="38" shape-rendering="crispEdges">` +
	  SK_FRAMES.map((f, i) => `<g class="sk-f" style="animation-delay:${(-0.1 * (4 - i)).toFixed(1)}s">` +
	    skLimbs(f.far, SK_FAR, f.dy) + skRows(SK_HEAD, 0, f.dy) + skRows(SK_TORSO, 7, f.dy) + skLimbs(f.near, SK_BONE, f.dy) +
	  `</g>`).join('') + `</svg>`;
	function setRunner(frac) {
	  const r = ui.undiscordWindow?.querySelector('#runner');
	  if (!r) return;
	  if (!r.firstChild) r.innerHTML = currentRunnerSvg();
	  r.style.setProperty('--p', String(Math.max(0, Math.min(1, Number(frac) || 0))));
	}

	// ---------- Multi-target picker (DMs + servers) ----------
	let reaperTargets = []; // [{ kind: 'dm'|'server', id, name, avatar }]

	function fallbackAvatar(label) {
	  const t = String(label || '?').trim();
	  const initials = (t.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('') || '?').toUpperCase();
	  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="32" fill="#5a0a15"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Arial" font-size="24" font-weight="700" fill="#ffe3e6">${escapeHTML(initials)}</text></svg>`;
	  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
	}

	async function getTokenForPicker() {
	  const input = ui.undiscordWindow.querySelector('input#token');
	  let tok = input.value.trim();
	  if (!tok) {
	    tok = await fillToken();
	    if (tok) input.value = tok;
	  }
	  return tok;
	}

	async function fetchTargetLists(token) {
	  const H = { headers: { Authorization: token } };
	  const [dmResp, gResp] = await Promise.all([
	    fetch('https://discord.com/api/v10/users/@me/channels', H),
	    fetch('https://discord.com/api/v10/users/@me/guilds', H),
	  ]);
	  const dmsRaw = dmResp.ok ? await dmResp.json() : [];
	  const guildsRaw = gResp.ok ? await gResp.json() : [];
	  const dms = (Array.isArray(dmsRaw) ? dmsRaw : [])
	    .filter(c => c && (c.type === 1 || c.type === 3))
	    .sort((a, b) => {
	      try { return (BigInt(b.last_message_id || 0) > BigInt(a.last_message_id || 0)) ? 1 : -1; } catch { return 0; }
	    })
	    .map(c => {
	      const recips = Array.isArray(c.recipients) ? c.recipients : [];
	      let name = c.name || recips.map(r => r.global_name || r.username).filter(Boolean).join(', ') || 'Unknown DM';
	      let avatar = '';
	      if (c.type === 3 && c.icon) avatar = `https://cdn.discordapp.com/channel-icons/${c.id}/${c.icon}.png?size=64`;
	      else if (recips[0]?.avatar) avatar = `https://cdn.discordapp.com/avatars/${recips[0].id}/${recips[0].avatar}.png?size=64`;
	      return { kind: 'dm', id: String(c.id), name, avatar: avatar || fallbackAvatar(name), sub: c.type === 3 ? 'group' : 'dm' };
	    });
	  const servers = (Array.isArray(guildsRaw) ? guildsRaw : []).map(g => ({
	    kind: 'server', id: String(g.id), name: g.name || 'Server',
	    avatar: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64` : fallbackAvatar(g.name), sub: 'server',
	  })).sort((a, b) => a.name.localeCompare(b.name));
	  if (!dmResp.ok && !gResp.ok) throw new Error(`Discord refused the lists (${dmResp.status}/${gResp.status})`);
	  return { dms, servers };
	}

	function refreshTargetsUi() {
	  const win = ui.undiscordWindow;
	  const btn = win.querySelector('#targetsBtn');
	  const n = reaperTargets.length;
	  win.classList.toggle('has-targets', n > 0);
	  btn.textContent = n ? `🎯 ${n} target${n === 1 ? '' : 's'}` : '🎯 Targets';
	  btn.title = n ? reaperTargets.map(t => (t.kind === 'dm' ? 'DM: ' : 'Server: ') + t.name).join('\n') : 'Pick several DMs and servers to purge in one run';
	}

	async function openTargetPicker() {
	  if (undiscordCore.state.running) return udToast('Wait for the current run to finish first.', { type: 'warn' });
	  ensureModalCss();
	  const token = await getTokenForPicker();
	  if (!token) return udToast('No auth token found. Fill it in under Advanced settings.', { type: 'warn' });

	  const overlay = document.createElement('div');
	  overlay.id = 'ud-overlay';
	  overlay.innerHTML = `
<div id="ud-modal" class="ud-picker" role="dialog" aria-modal="true" aria-labelledby="ud-title">
  <div class="ud-head">
    <div class="ud-skull">${packIconSvg(46)}</div>
    <div><h2 id="ud-title">Choose targets</h2><p class="ud-sub">Pick any mix of DMs and servers. Only messages matching your Author ID and filters get deleted.</p></div>
  </div>
  <div class="ud-tabs"><button data-tab="dm" class="on">DMs</button><button data-tab="server">Servers</button></div>
  <div class="ud-search"><input id="ud-tsearch" placeholder="Search..." autocomplete="off" spellcheck="false"><button id="ud-tall">Select visible</button><button id="ud-tnone">Clear</button></div>
  <div class="ud-targets"><div class="ud-empty">Loading your DMs and servers...</div></div>
  <div class="ud-actions"><span class="ud-count"><b>0</b> selected</span><button id="ud-cancel">Cancel<kbd>Esc</kbd></button><button id="ud-go" class="ud-go">🎯 LOCK TARGETS</button></div>
</div>`;
	  document.body.appendChild(overlay);
	  const $m = sel => overlay.querySelector(sel);
	  const listEl = $m('.ud-targets');
	  const selected = new Map(reaperTargets.map(t => [t.kind + ':' + t.id, t]));
	  let data = { dms: [], servers: [] };
	  let tab = 'dm';

	  const updateCount = () => { $m('.ud-count b').textContent = String(selected.size); };
	  const visibleItems = () => {
	    const q = $m('#ud-tsearch').value.trim().toLowerCase();
	    const arr = tab === 'dm' ? data.dms : data.servers;
	    return q ? arr.filter(x => x.name.toLowerCase().includes(q)) : arr;
	  };
	  const render = () => {
	    const items = visibleItems();
	    if (!items.length) { listEl.innerHTML = '<div class="ud-empty">Nothing here.</div>'; return; }
	    listEl.innerHTML = items.map(x => {
	      const key = x.kind + ':' + x.id;
	      const on = selected.has(key);
	      return `<label class="ud-trow${on ? ' sel' : ''}" data-key="${escapeHTML(key)}"><input type="checkbox" ${on ? 'checked' : ''}><img src="${escapeHTML(x.avatar)}" alt="" loading="lazy"><span class="nm">${escapeHTML(x.name)}</span><span class="kd">${escapeHTML(x.sub)}</span></label>`;
	    }).join('');
	  };
	  const byKey = key => [...data.dms, ...data.servers].find(x => x.kind + ':' + x.id === key) || selected.get(key);

	  listEl.addEventListener('change', (e) => {
	    const row = e.target.closest('.ud-trow');
	    if (!row) return;
	    const key = row.dataset.key;
	    if (e.target.checked) selected.set(key, byKey(key)); else selected.delete(key);
	    row.classList.toggle('sel', e.target.checked);
	    sfx.play('click');
	    updateCount();
	  });
	  overlay.querySelectorAll('.ud-tabs button').forEach(b => b.addEventListener('click', () => {
	    tab = b.dataset.tab;
	    overlay.querySelectorAll('.ud-tabs button').forEach(x => x.classList.toggle('on', x === b));
	    render();
	  }));
	  $m('#ud-tsearch').addEventListener('input', render);
	  $m('#ud-tall').onclick = () => { visibleItems().forEach(x => selected.set(x.kind + ':' + x.id, x)); render(); updateCount(); };
	  $m('#ud-tnone').onclick = () => { selected.clear(); render(); updateCount(); };

	  const close = () => { document.removeEventListener('keydown', onKey, true); overlay.remove(); };
	  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } else e.stopPropagation(); };
	  document.addEventListener('keydown', onKey, true);
	  $m('#ud-cancel').onclick = close;
	  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
	  $m('#ud-go').onclick = () => {
	    reaperTargets = [...selected.values()].filter(Boolean);
	    refreshTargetsUi();
	    close();
	    if (reaperTargets.length) {
	      sfx.play('restore');
	      udToast(`${reaperTargets.length} target${reaperTargets.length === 1 ? '' : 's'} locked. Press DELETE to start.`, { ms: 3000 });
	    }
	  };
	  updateCount();
	  setTimeout(() => $m('#ud-tsearch').focus(), 30);

	  try {
	    data = await fetchTargetLists(token);
	    if (!overlay.isConnected) return;
	    render();
	  } catch (err) {
	    listEl.innerHTML = `<div class="ud-empty">Could not load your DMs/servers: ${escapeHTML(err.message || err)}</div>`;
	  }
	}

	async function countTargetMessages(token, target, f) {
	  const base = target.kind === 'dm'
	    ? `https://discord.com/api/v10/channels/${target.id}/messages/search?`
	    : `https://discord.com/api/v10/guilds/${target.id}/messages/search?`;
	  const qs = queryString([
	    ['author_id', f.authorId || undefined],
	    ['min_id', f.minId ? toSnowflake(f.minId) : undefined],
	    ['max_id', f.maxId ? toSnowflake(f.maxId) : undefined],
	    ['has', f.hasLink ? 'link' : undefined],
	    ['has', f.hasFile ? 'file' : undefined],
	    ['content', f.content || undefined],
	    ['include_nsfw', f.includeNsfw ? true : undefined],
	  ]);
	  for (let attempt = 0; attempt < 5; attempt++) {
	    let resp;
	    try { resp = await fetch(base + qs, { headers: { Authorization: token } }); } catch { return 0; }
	    if (resp.ok) { const d = await resp.json().catch(() => ({})); return Math.max(0, Number(d?.total_results || 0)); }
	    if (resp.status === 202 || resp.status === 429) {
	      const b = await resp.json().catch(() => ({}));
	      const ms = Math.max(800, Math.round((Number(b?.retry_after) || 1.5) * 1000));
	      if (resp.status === 429) signalLost.show(ms);
	      await wait(ms);
	      continue;
	    }
	    return 0;
	  }
	  return 0;
	}


	// ---------- Icon glitch loop ----------
	function startIconGlitchLoop() {
	  const fire = (el) => {
	    if (!el || prefersReducedMotion() || !fxOn()) return;
	    const kind = Math.random() < 0.55 ? 'ud-glitch' : 'ud-twitch';
	    el.classList.remove('ud-glitch', 'ud-twitch');
	    void el.getBoundingClientRect();
	    el.classList.add(kind);
	    setTimeout(() => el.classList.remove(kind), kind === 'ud-glitch' ? 750 : 340);
	  };
	  const loop = () => {
	    const btnSvg = ui.undiscordBtn;
	    const headSvg = ui.undiscordWindow?.querySelector('.header > svg.icon');
	    if (!document.hidden) {
	      fire(btnSvg);
	      if (ui.undiscordWindow?.style.display !== 'none' && Math.random() < 0.6) setTimeout(() => fire(headSvg), 120 + Math.random() * 300);
	    }
	    setTimeout(loop, 2500 + Math.random() * 4500);
	  };
	  setTimeout(loop, 1500 + Math.random() * 2000);
	}

	// ---------- Finish decay ----------
	function runDecay(done) {
	  const win = ui.undiscordWindow;
	  if (!fxOn() || prefersReducedMotion() || !win || win.style.display === 'none') { done(); return; }
	  const DUR = 1100;
	  win.classList.add('decaying');
	  sfx.play('decay');
	  // scramble the visible log text, then put it back exactly as it was
	  const targets = Array.from(win.querySelectorAll('#logArea .msgText, #logArea .author .authorText, #logArea .date span, #logArea .meta')).slice(-160);
	  const originals = targets.map(el => el.textContent);
	  const t0 = performance.now();
	  const step = (now) => {
	    const p = (now - t0) / DUR;
	    if (p >= 1) {
	      targets.forEach((el, i) => { if (el.isConnected) el.textContent = originals[i]; });
	      win.classList.remove('decaying');
	      done();
	      return;
	    }
	    const corruption = p < 0.7 ? Math.min(1, p / 0.45) : Math.max(0, 1 - (p - 0.7) / 0.2);
	    targets.forEach((el, i) => {
	      const src = originals[i];
	      let out = '';
	      for (let k = 0; k < src.length; k++) {
	        const ch = src[k];
	        out += (ch !== ' ' && Math.random() < corruption) ? DECAY_CHARS[(Math.random() * DECAY_CHARS.length) | 0] : ch;
	      }
	      el.textContent = out;
	    });
	    requestAnimationFrame(step);
	  };
	  requestAnimationFrame(step);
	}


	// ---------- Quick toggles shared by header, settings, floating menu and the app ----------
	function reaperHapticsOn() { try { return window.ReaperApp?.hapticsOn ? !!window.ReaperApp.hapticsOn() : false; } catch { return false; } }
	function reaperSetSound(on) {
	  sfx.on = !!on;
	  try { window.ReaperApp?.setFlag?.('sound', sfx.on); } catch {}
	  if (sfx.on) sfx.play('restore');
	  syncQuickToggles();
	}
	function reaperSetHaptics(on) {
	  try { window.ReaperApp?.setHaptics?.(!!on); if (on) window.ReaperApp?.haptic?.(1); } catch {}
	  syncQuickToggles();
	}
	function syncQuickToggles() {
	  const win = ui.undiscordWindow;
	  const vib = reaperHapticsOn();
	  const m = win?.querySelector('#muteBtn');
	  if (m) { m.textContent = sfx.on ? '🔊' : '🔇'; m.classList.toggle('off', !sfx.on); }
	  const v = win?.querySelector('#vibBtn');
	  if (v) { v.textContent = vib ? '📳' : '📴'; v.classList.toggle('off', !vib); }
	  const h = win?.querySelector('#hapticsOn');
	  if (h) h.checked = vib;
	  const menu = document.getElementById('reaper-fabmenu');
	  if (menu) {
	    const s = menu.querySelector('[data-act="sound"]');
	    if (s) { s.textContent = sfx.on ? '🔊' : '🔇'; s.classList.toggle('off', !sfx.on); }
	    const b = menu.querySelector('[data-act="vib"]');
	    if (b) { b.textContent = vib ? '📳' : '📴'; b.classList.toggle('off', !vib); }
	    const p = menu.querySelector('[data-act="panel"]');
	    if (p) p.textContent = win?.style.display === 'none' ? '☠' : '▾';
	  }
	}
	// called by the Android bubble menu
	window.__reaperSetSound = (on) => reaperSetSound(on);
	window.__reaperSoundOn = () => !!sfx.on;
	window.__reaperSync = () => syncQuickToggles();

	/** Full close: in the app it quits completely (after confirming if a run is active). */
	async function reaperQuit() {
	  if (IS_APP === 'android' && window.ReaperApp?.quit) {
	    const running = !!undiscordCore.state.running;
	    if (running) {
	      const ok = window.confirm('Stop the purge and fully close Reaper?');
	      if (!ok) return;
	      try { stopAction(); } catch {}
	    }
	    setTimeout(() => { try { window.ReaperApp.quit(); } catch {} }, running ? 350 : 0);
	    return;
	  }
	  // browser: just hide the panel
	  if (ui.undiscordWindow.style.display !== 'none') ui.undiscordBtn.click();
	}

	// ---------- Mobile mode + floating skull button + app hooks ----------
	const IS_APP = String(window.__REAPER_APP || '');
	const mobileQuery = window.matchMedia ? window.matchMedia('(max-width: 760px), (pointer: coarse) and (max-width: 1024px)') : null;
	function isMobileLayout() { return IS_APP === 'android' || !!mobileQuery?.matches; }

	function setupMobile(toggleWindow) {
	  const apply = () => document.body.classList.toggle('reaper-mobile', isMobileLayout());
	  apply();
	  mobileQuery?.addEventListener?.('change', () => { apply(); updateFab(); });

	  // floating, draggable skull button (phones, or whenever the toolbar slot can't be found)
	  const fab = document.createElement('div');
	  fab.id = 'reaper-fab';
	  fab.setAttribute('role', 'button');
	  fab.setAttribute('aria-label', 'Open ' + BRAND_NAME);
	  fab.innerHTML = packIconSvg(30);
	  document.body.appendChild(fab);
	  let drag = null;
	  fab.addEventListener('pointerdown', (e) => {
	    const r = fab.getBoundingClientRect();
	    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
	    fab.setPointerCapture(e.pointerId);
	  });
	  fab.addEventListener('pointermove', (e) => {
	    if (!drag || e.pointerId !== drag.id) return;
	    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
	    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
	    drag.moved = true;
	    const x = Math.max(6, Math.min(window.innerWidth - 62, drag.ox + dx));
	    const y = Math.max(6, Math.min(window.innerHeight - 62, drag.oy + dy));
	    fab.style.left = x + 'px'; fab.style.top = y + 'px'; fab.style.right = 'auto'; fab.style.bottom = 'auto';
	  });
	  const menu = document.createElement('div');
	  menu.id = 'reaper-fabmenu';
	  const items = [['panel', '☠', 'Open / hide Reaper'], ['sound', '🔊', 'Sound on/off']];
	  if (IS_APP === 'android') items.push(['vib', '📳', 'Vibration on/off'], ['quit', '✕', 'Close Reaper completely']);
	  menu.innerHTML = items.map(([a, t, l]) => `<button data-act="${a}" aria-label="${l}" title="${l}"${a === 'quit' ? ' class="danger"' : ''}>${t}</button>`).join('');
	  document.body.appendChild(menu);
	  let armTimer = null;
	  const closeMenu = () => {
	    menu.classList.remove('show');
	    const q = menu.querySelector('[data-act="quit"]');
	    if (q) { q.classList.remove('armed'); q.textContent = '✕'; }
	  };
	  const openMenu = () => {
	    const r = fab.getBoundingClientRect();
	    const n = items.length;
	    const h = n * 46 + (n - 1) * 10;
	    const top = r.top - h - 12 > 8 ? r.top - h - 12 : r.bottom + 12;
	    menu.style.left = (r.left + r.width / 2 - 23) + 'px';
	    menu.style.top = top + 'px';
	    syncQuickToggles();
	    menu.classList.add('show');
	  };
	  menu.addEventListener('click', (e) => {
	    const b = e.target.closest('button');
	    if (!b) return;
	    e.stopPropagation();
	    const act = b.dataset.act;
	    if (act === 'panel') { closeMenu(); toggleWindow(); syncQuickToggles(); }
	    else if (act === 'sound') reaperSetSound(!sfx.on);
	    else if (act === 'vib') reaperSetHaptics(!reaperHapticsOn());
	    else if (act === 'quit') {
	      if (!b.classList.contains('armed')) {            // tap twice to quit (no accidental closes)
	        b.classList.add('armed'); b.textContent = '?';
	        clearTimeout(armTimer);
	        armTimer = setTimeout(() => { b.classList.remove('armed'); b.textContent = '✕'; }, 2500);
	      } else { closeMenu(); reaperQuit(); }
	    }
	  });
	  document.addEventListener('pointerdown', (e) => {
	    if (!menu.classList.contains('show')) return;
	    if (e.target.closest('#reaper-fabmenu') || e.target.closest('#reaper-fab')) return;
	    closeMenu();
	  }, true);

	  const end = (e) => {
	    if (!drag || e.pointerId !== drag.id) return;
	    const wasTap = !drag.moved;
	    drag = null;
	    if (wasTap) { if (menu.classList.contains('show')) closeMenu(); else openMenu(); }
	    else if (menu.classList.contains('show')) openMenu();
	  };
	  fab.addEventListener('pointerup', end);
	  fab.addEventListener('pointercancel', () => { drag = null; });

	  const toolbarMounted = () => !!ui.undiscordBtn?.isConnected && ui.undiscordBtn.getBoundingClientRect().width > 0;
	  const fabBoot = Date.now();
	  let toolbarMissingSince = 0;
	  function updateFab() {
	    const mounted = toolbarMounted();
	    const now = Date.now();
	    if (mounted) toolbarMissingSince = 0;
	    else if (!toolbarMissingSince) toolbarMissingSince = now;
	    // Desktop: only fall back to the floating skull once Discord has had 20s to load,
	    // and the toolbar spot has been missing for 5s+ (not just a quick re-render)
	    const fallback = !mounted && now - fabBoot > 20000 && now - toolbarMissingSince > 5000;
	    fab.classList.toggle('show', isMobileLayout() || IS_APP === 'android' || fallback);
	  }
	  updateFab();
	  setInterval(updateFab, 3000);
	  if (IS_APP === 'android') document.body.classList.add('reaper-app');
	  if (IS_APP === 'windows') document.body.classList.add('reaper-desktop');
	  new MutationObserver(() => {
	    document.body.classList.toggle('reaper-open', ui.undiscordWindow.style.display !== 'none');
	    syncQuickToggles();
	  }).observe(ui.undiscordWindow, { attributes: true, attributeFilter: ['style'] });
	  window.__reaperUpdateFab = updateFab;

	  // Android app only: switch Discord between its mobile site and desktop site
	  if (IS_APP === 'android' && window.ReaperApp) {
	    const fx = ui.undiscordWindow.querySelector('#fxMode')?.closest('.sectionDescription');
	    if (fx) {
	      const row = document.createElement('div');
	      row.className = 'sectionDescription';
	      row.innerHTML = '<label class="row"><input id="desktopSite" type="checkbox"> Desktop site mode (if Discord won\'t load)</label>';
	      fx.parentNode.insertBefore(row, fx);
	      const cb = row.querySelector('input');
	      try { cb.checked = !!window.ReaperApp.isDesktop(); } catch {}
	      cb.addEventListener('change', () => { try { window.ReaperApp.setDesktop(cb.checked); } catch {} });
	      const hrow = document.createElement('div');
	      hrow.className = 'sectionDescription';
	      hrow.innerHTML = '<label class="row"><input id="hapticsOn" type="checkbox"> Vibration on deletes</label>';
	      fx.parentNode.insertBefore(hrow, row);
	      const hcb = hrow.querySelector('input');
	      try { hcb.checked = window.ReaperApp.hapticsOn ? !!window.ReaperApp.hapticsOn() : true; } catch { hcb.checked = true; }
	      hcb.addEventListener('change', () => reaperSetHaptics(hcb.checked));
	      const brow = document.createElement('div');
	      brow.className = 'sectionDescription';
	      brow.innerHTML = '<label class="row"><input id="bubbleOn" type="checkbox"> Floating bubble over other apps (YouTube, Twitch...)</label>';
	      fx.parentNode.insertBefore(brow, hrow);
	      const bcb = brow.querySelector('input');
	      try { bcb.checked = !!window.ReaperApp.bubbleOn() && !!window.ReaperApp.overlayGranted(); } catch {}
	      bcb.addEventListener('change', () => { try { window.ReaperApp.setBubble(bcb.checked); } catch {} });
	      document.addEventListener('visibilitychange', () => { try { if (!document.hidden) bcb.checked = !!window.ReaperApp.bubbleOn() && !!window.ReaperApp.overlayGranted(); } catch {} });
	    }
	  }

	  // on phones, tapping the log area closes the settings drawer
	  ui.undiscordWindow.querySelector('.main').addEventListener('click', (e) => {
	    if (!document.body.classList.contains('reaper-mobile')) return;
	    if (e.target.closest('#toggleSidebar')) return;
	    ui.undiscordWindow.classList.add('hide-sidebar');
	  });

	  // Android back button: close dialog -> close drawer -> close window
	  window.__reaperBack = () => {
	    if (document.getElementById('ud-overlay')) {
	      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	      document.getElementById('ud-overlay')?.remove();
	      return true;
	    }
	    const win = ui.undiscordWindow;
	    if (win.style.display !== 'none') {
	      if (document.body.classList.contains('reaper-mobile') && !win.classList.contains('hide-sidebar')) { win.classList.add('hide-sidebar'); return true; }
	      toggleWindow();
	      return true;
	    }
	    return false;
	  };
	}

	// ---------- Controls: mute, speed presets, theme, notifications ----------
	const SPEED_PRESETS = {
	  safe: { searchDelay: 35000, deleteDelay: 1500 },
	  normal: { searchDelay: 30000, deleteDelay: 1000 },
	  fast: { searchDelay: 10000, deleteDelay: 400 },
	};
	const THEMES = { red: 0, toxic: 130, ice: 200, void: 275 };

	function applyTheme(name) {
	  const hue = THEMES[name] ?? 0;
	  if (!hue) {
	    delete document.body.dataset.udTheme;
	    document.body.style.removeProperty('--ud-hue');
	  } else {
	    document.body.dataset.udTheme = name;
	    document.body.style.setProperty('--ud-hue', hue + 'deg');
	  }
	  ui.undiscordWindow.querySelectorAll('button.swatch').forEach(b => b.classList.toggle('active', b.dataset.theme === name));
	}

	function setupReaperControls() {
	  const win = ui.undiscordWindow;

	  win.querySelector('#targetsBtn').addEventListener('click', openTargetPicker);
	  win.querySelector('#leaveServersBtn').addEventListener('click', openLeaveServersPicker);
	  win.querySelector('#convBadge').addEventListener('click', openTargetPicker);
	  win.querySelector('#convBadge').title = 'Click to choose multiple DMs/servers';

	  const muteBtn = win.querySelector('#muteBtn');
	  const vibBtn = win.querySelector('#vibBtn');
	  try { const v = window.ReaperApp?.getFlag?.('sound', true); if (typeof v === 'boolean') sfx.on = v; } catch {}
	  const toggleMute = () => reaperSetSound(!sfx.on);
	  const toggleVib = () => reaperSetHaptics(!reaperHapticsOn());
	  [[muteBtn, toggleMute], [vibBtn, toggleVib]].forEach(([b, fn]) => {
	    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
	    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
	  });
	  syncQuickToggles();

	  const presetBtns = win.querySelectorAll('button.preset');
	  presetBtns.forEach(btn => btn.addEventListener('click', () => {
	    const cfg = SPEED_PRESETS[btn.dataset.preset];
	    if (!cfg) return;
	    win.querySelector('input#searchDelay').value = cfg.searchDelay;
	    win.querySelector('input#deleteDelay').value = cfg.deleteDelay;
	    win.querySelector('div#searchDelayValue').textContent = cfg.searchDelay + 'ms';
	    win.querySelector('div#deleteDelayValue').textContent = cfg.deleteDelay + 'ms';
	    undiscordCore.options.searchDelay = cfg.searchDelay;
	    undiscordCore.options.deleteDelay = cfg.deleteDelay;
	    presetBtns.forEach(b => b.classList.toggle('active', b === btn));
	    udToast(`Speed preset: ${btn.textContent}`, { ms: 1800 });
	  }));
	  // Moving a slider by hand means "custom": clear the highlighted preset.
	  ['searchDelay', 'deleteDelay'].forEach(id => win.querySelector('input#' + id).addEventListener('input', () => presetBtns.forEach(b => b.classList.remove('active'))));
	  win.querySelector('div#searchDelayValue').textContent = win.querySelector('input#searchDelay').value + 'ms';
	  win.querySelector('div#deleteDelayValue').textContent = win.querySelector('input#deleteDelay').value + 'ms';

	  const grid = win.querySelector('#packGrid');
	  grid.innerHTML = Object.entries(PACKS).map(([id, p]) =>
	    `<button class="packTile${id === currentPackId ? ' active' : ''}" data-pack="${id}" title="${escapeHTML(p.name)}">${tileIconSvg(p)}<span>${escapeHTML(p.name)}</span></button>`).join('');
	  grid.addEventListener('click', (e) => {
	    const b = e.target.closest('button.packTile');
	    if (!b) return;
	    applyPack(b.dataset.pack);
	    sfx.play('zap');
	  });
	  try { const saved = window.ReaperApp?.getPack?.(); if (saved && PACKS[saved]) currentPackId = saved; } catch {}
	  grid.querySelectorAll('button.packTile').forEach(b => b.classList.toggle('active', b.dataset.pack === currentPackId));
	  applyPack(currentPackId);

	  const notify = win.querySelector('#notifyDone');
	  notify.addEventListener('change', async () => {
	    if (!notify.checked) return;
	    if (!window.Notification) { notify.checked = false; return udToast('Your browser does not support notifications.', { type: 'warn' }); }
	    if (Notification.permission === 'default') {
	      try { await Notification.requestPermission(); } catch {}
	    }
	    if (Notification.permission !== 'granted') {
	      notify.checked = false;
	      udToast('Notifications are blocked for Discord in your browser settings.', { type: 'warn' });
	    } else {
	      udToast('You\'ll get a notification when a run finishes in the background.', { ms: 2500 });
	    }
	  });

	  win.querySelector('#fxMode').addEventListener('change', (e) => { if (!e.target.checked) rain.stop(); else if (undiscordCore.state.running) rain.start(); });

	}

	// ====================================================================
	// ---------- Leave Servers (mass-leave guilds) ----------
	// A separate tool from the purge engine above. It never reads, searches
	// or deletes a single message - it only removes YOUR membership from
	// servers you pick, via Discord's own official "leave guild" endpoint
	// (the same thing the normal "Leave Server" button in Discord's UI
	// calls). This block is intentionally self-contained so it can't
	// regress the purge engine, and the purge engine can't regress this.
	// ====================================================================
	const sleep = ms => new Promise(r => setTimeout(r, ms));

	/** Lightweight server-only fetch (no DMs) for the Leave tool. */
	async function fetchGuildListOnly(token) {
	  const resp = await fetch('https://discord.com/api/v10/users/@me/guilds', { headers: { Authorization: token } });
	  if (!resp.ok) throw new Error(`Discord refused the server list (${resp.status})`);
	  const raw = await resp.json().catch(() => []);
	  return (Array.isArray(raw) ? raw : []).map(g => ({
	    kind: 'server', id: String(g.id), name: g.name || 'Server', owner: !!g.owner,
	    avatar: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64` : fallbackAvatar(g.name),
	    sub: g.owner ? 'you own this' : 'member',
	  })).sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Leave one guild via the official endpoint. Never throws - always
	 * resolves to a result object so a mass-run can keep going past one
	 * failure. Retries once after a 429 cooldown (never lowers the delay,
	 * same spirit as the purge engine's rate-limit handling).
	 */
	async function leaveGuildApi(token, guildId, { retried = false } = {}) {
	  try {
	    const resp = await fetch(`https://discord.com/api/v10/users/@me/guilds/${encodeURIComponent(guildId)}`, {
	      method: 'DELETE',
	      headers: { Authorization: token },
	    });
	    if (resp.status === 429 && !retried) {
	      const body = await resp.json().catch(() => ({}));
	      const waitMs = Math.max(800, Math.round((Number(body?.retry_after) || 1.5) * 1000));
	      signalLost.show(waitMs);
	      await sleep(waitMs);
	      return leaveGuildApi(token, guildId, { retried: true });
	    }
	    // 204 = left successfully. 404 = you were already not in it (treat as success, nothing to do).
	    return { ok: resp.ok || resp.status === 404, status: resp.status };
	  } catch (err) {
	    return { ok: false, status: 0, error: err?.message || String(err) };
	  }
	}

	/** Themed confirm step. Requires typing LEAVE - this is harder to undo than a purge run. */
	function udConfirmLeave(servers) {
	  ensureModalCss();
	  const MAX_SHOWN = 150;
	  const shown = servers.slice(0, MAX_SHOWN);
	  const rows = shown.map(s => `<div><em>${escapeHTML(s.name)}</em></div>`).join('') || '<div><em>(nothing selected)</em></div>';
	  const moreCount = servers.length - shown.length;

	  return new Promise((resolve) => {
	    const overlay = document.createElement('div');
	    overlay.id = 'ud-overlay';
	    overlay.innerHTML = `
<div id="ud-modal" role="dialog" aria-modal="true" aria-labelledby="ud-leave-title">
  <div class="ud-head">
    <div class="ud-skull">${packIconSvg(46)}</div>
    <div>
      <h2 id="ud-leave-title">Leave ${escapeHTML(String(servers.length))} server${servers.length === 1 ? '' : 's'}?</h2>
      <p class="ud-sub">This can't be undone from here - you'll need a new invite to get back in.</p>
    </div>
  </div>
  <div class="ud-list">${rows}</div>
  ${moreCount > 0 ? `<div class="ud-more">…and ${moreCount} more not shown.</div>` : ''}
  <label class="ud-type">Type <b>LEAVE</b> to confirm<input id="ud-leave-input" autocomplete="off" spellcheck="false" placeholder="LEAVE"></label>
  <div class="ud-actions">
    <button id="ud-leave-cancel">Cancel<kbd>Esc</kbd></button>
    <button id="ud-leave-go" class="ud-go" disabled>🚪 LEAVE</button>
  </div>
</div>`;
	    document.body.appendChild(overlay);
	    const goBtn = overlay.querySelector('#ud-leave-go');
	    const cancelBtn = overlay.querySelector('#ud-leave-cancel');
	    const typeInput = overlay.querySelector('#ud-leave-input');
	    const prevFocus = document.activeElement;

	    const finish = (val) => {
	      document.removeEventListener('keydown', onKey, true);
	      overlay.remove();
	      try { prevFocus?.focus?.(); } catch {}
	      resolve(val);
	    };
	    const onKey = (e) => {
	      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); return; }
	      if (e.key === 'Enter' && document.activeElement === typeInput) {
	        e.preventDefault(); e.stopPropagation();
	        if (!goBtn.disabled) finish(true);
	        return;
	      }
	      e.stopPropagation();
	    };
	    document.addEventListener('keydown', onKey, true);
	    typeInput.addEventListener('input', () => { goBtn.disabled = typeInput.value.trim().toUpperCase() !== 'LEAVE'; });
	    goBtn.onclick = () => finish(true);
	    cancelBtn.onclick = () => finish(false);
	    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) finish(false); });
	    setTimeout(() => typeInput.focus(), 30);
	  });
	}

	/** Runs the leave loop with its own progress overlay + Stop button. */
	async function runLeaveServers(token, servers) {
	  ensureModalCss();
	  const overlay = document.createElement('div');
	  overlay.id = 'ud-overlay';
	  overlay.innerHTML = `
<div id="ud-modal" role="dialog" aria-modal="true" aria-labelledby="ud-leaverun-title">
  <div class="ud-head">
    <div class="ud-skull">${packIconSvg(46)}</div>
    <div><h2 id="ud-leaverun-title">Leaving servers…</h2><p class="ud-sub" id="ud-leaverun-sub">Starting…</p></div>
  </div>
  <div class="ud-list" id="ud-leaverun-log"></div>
  <div class="ud-actions"><span class="ud-count"><b id="ud-leaverun-count">0</b> / ${servers.length}</span><button id="ud-leaverun-stop">🛑 Stop</button></div>
</div>`;
	  document.body.appendChild(overlay);
	  const logEl = overlay.querySelector('#ud-leaverun-log');
	  const subEl = overlay.querySelector('#ud-leaverun-sub');
	  const countEl = overlay.querySelector('#ud-leaverun-count');
	  let stopped = false;
	  overlay.querySelector('#ud-leaverun-stop').onclick = () => { stopped = true; subEl.textContent = 'Stopping after the current one…'; };

	  let okCount = 0, failCount = 0;
	  for (let i = 0; i < servers.length; i++) {
	    if (stopped) break;
	    const s = servers[i];
	    subEl.textContent = `Leaving "${s.name}"…`;
	    const res = await leaveGuildApi(token, s.id);
	    if (res.ok) { okCount++; log.success(`[REAPER-LEAVE] Left "${s.name}"`); }
	    else { failCount++; log.error(`[REAPER-LEAVE] Could not leave "${s.name}" (status ${res.status}${res.error ? ': ' + res.error : ''})`); }
	    logEl.insertAdjacentHTML('beforeend', `<div><em>${res.ok ? '✅' : '❌'} ${escapeHTML(s.name)}</em></div>`);
	    logEl.scrollTop = logEl.scrollHeight;
	    countEl.textContent = String(i + 1);
	    if (i < servers.length - 1 && !stopped) await sleep(1500); // gentle pace - same spirit as the purge engine's own delays
	  }
	  const skipped = servers.length - okCount - failCount;
	  overlay.querySelector('.ud-actions').innerHTML = `<button id="ud-leaverun-close" class="ud-go">Done</button>`;
	  overlay.querySelector('#ud-leaverun-close').onclick = () => overlay.remove();
	  subEl.textContent = stopped
	    ? `Stopped. Left ${okCount}, failed ${failCount}, skipped ${skipped}.`
	    : `Done. Left ${okCount}, failed ${failCount}.`;
	  udToast(
	    stopped ? `Stopped: left ${okCount} of ${servers.length}.` : `Left ${okCount} of ${servers.length} server${servers.length === 1 ? '' : 's'}.`,
	    { ms: 5000, type: failCount ? 'warn' : 'info' }
	  );
	}

	/** Entry point: wired to the toolbar's 🚪 Leave button. */
	async function openLeaveServersPicker() {
	  if (undiscordCore.state.running) return udToast('Wait for the current purge run to finish first.', { type: 'warn' });
	  ensureModalCss();
	  const token = await getTokenForPicker();
	  if (!token) return udToast('No auth token found. Fill it in under Advanced settings.', { type: 'warn' });

	  const overlay = document.createElement('div');
	  overlay.id = 'ud-overlay';
	  overlay.innerHTML = `
<div id="ud-modal" class="ud-picker" role="dialog" aria-modal="true" aria-labelledby="ud-leavepick-title">
  <div class="ud-head">
    <div class="ud-skull">${packIconSvg(46)}</div>
    <div><h2 id="ud-leavepick-title">Leave servers</h2><p class="ud-sub">Pick which servers to leave. Separate from message purging - this never deletes anything, it just removes your membership.</p></div>
  </div>
  <div class="ud-search"><input id="ud-lsearch" placeholder="Search..." autocomplete="off" spellcheck="false"><button id="ud-lall">Select visible</button><button id="ud-lnone">Clear</button></div>
  <div class="ud-targets"><div class="ud-empty">Loading your servers...</div></div>
  <div class="ud-actions"><span class="ud-count"><b>0</b> selected</span><button id="ud-lcancel">Cancel<kbd>Esc</kbd></button><button id="ud-lgo" class="ud-go">🚪 LEAVE SELECTED</button></div>
</div>`;
	  document.body.appendChild(overlay);
	  const $m = sel => overlay.querySelector(sel);
	  const listEl = $m('.ud-targets');
	  const selected = new Map();
	  let data = [];

	  const updateCount = () => { $m('.ud-count b').textContent = String(selected.size); };
	  const visibleItems = () => {
	    const q = $m('#ud-lsearch').value.trim().toLowerCase();
	    return q ? data.filter(x => x.name.toLowerCase().includes(q)) : data;
	  };
	  const render = () => {
	    const items = visibleItems();
	    if (!items.length) { listEl.innerHTML = '<div class="ud-empty">Nothing here.</div>'; return; }
	    listEl.innerHTML = items.map(x => {
	      const on = selected.has(x.id);
	      return `<label class="ud-trow${on ? ' sel' : ''}" data-key="${escapeHTML(x.id)}"><input type="checkbox" ${on ? 'checked' : ''}><img src="${escapeHTML(x.avatar)}" alt="" loading="lazy"><span class="nm">${escapeHTML(x.name)}</span><span class="kd">${escapeHTML(x.sub)}</span></label>`;
	    }).join('');
	  };
	  const byId = id => data.find(x => x.id === id) || selected.get(id);

	  listEl.addEventListener('change', (e) => {
	    const row = e.target.closest('.ud-trow');
	    if (!row) return;
	    const id = row.dataset.key;
	    if (e.target.checked) selected.set(id, byId(id)); else selected.delete(id);
	    row.classList.toggle('sel', e.target.checked);
	    sfx.play('click');
	    updateCount();
	  });
	  $m('#ud-lsearch').addEventListener('input', render);
	  $m('#ud-lall').onclick = () => { visibleItems().forEach(x => selected.set(x.id, x)); render(); updateCount(); };
	  $m('#ud-lnone').onclick = () => { selected.clear(); render(); updateCount(); };

	  const close = () => { document.removeEventListener('keydown', onKey, true); overlay.remove(); };
	  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } else e.stopPropagation(); };
	  document.addEventListener('keydown', onKey, true);
	  $m('#ud-lcancel').onclick = close;
	  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
	  $m('#ud-lgo').onclick = async () => {
	    const picked = [...selected.values()].filter(Boolean);
	    if (!picked.length) return udToast('Pick at least one server first.', { type: 'warn' });
	    close();
	    const confirmed = await udConfirmLeave(picked);
	    if (confirmed) runLeaveServers(token, picked);
	  };
	  updateCount();
	  setTimeout(() => $m('#ud-lsearch').focus(), 30);

	  try {
	    data = await fetchGuildListOnly(token);
	    if (!overlay.isConnected) return;
	    render();
	  } catch (err) {
	    listEl.innerHTML = `<div class="ud-empty">Could not load your servers: ${escapeHTML(err.message || err)}</div>`;
	  }
	}

	// ---- END Undiscord ----

initUI();

})();