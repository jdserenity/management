#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tauriIcons = path.join(root, 'src-tauri/icons');
const companionPublic = path.join(root, 'apps/companion/public');
const publicDir = path.join(root, 'public');

const BRAND_COLOR = '#0047AB';
const CORNER_RATIO = 0.2237;
// ~8% inset on each side so the icon floats within the canvas like other macOS dock icons.
const ICON_PADDING_RATIO = 0.08;

function appIconSvg(size) {
  const pad = Math.round(size * ICON_PADDING_RATIO);
  const inner = size - pad * 2;
  const r = Math.round(inner * CORNER_RATIO);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="${r}" ry="${r}" fill="${BRAND_COLOR}"/></svg>`;
}

function trayIconSvg(size, fill, insetRatio = 0.0625, opacity = 1) {
  const inset = Math.round(size * insetRatio);
  const edge = size - inset * 2;
  const r = Math.round(edge * CORNER_RATIO);
  const opacityAttr = opacity < 1 ? ` fill-opacity="${opacity}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect x="${inset}" y="${inset}" width="${edge}" height="${edge}" rx="${r}" ry="${r}" fill="${fill}"${opacityAttr}/></svg>`;
}

function writeSvg(filePath, svg) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, svg);
}

function svgToPng(svgPath, pngPath, size) {
  execFileSync('magick', ['-background', 'none', svgPath, '-resize', `${size}x${size}`, pngPath], { stdio: 'inherit' });
}

function svgToPngOpaque(svgPath, pngPath, size, bg) {
  execFileSync('magick', ['-background', bg, svgPath, '-resize', `${size}x${size}`, pngPath], { stdio: 'inherit' });
}

const appSvg = path.join(tauriIcons, 'app-icon.svg');
const traySvg = path.join(tauriIcons, 'tray-icon.svg');
const monitoringOffSvg = path.join(tauriIcons, 'monitoring-off.svg');
const appPng1024 = path.join(tauriIcons, 'app-icon.png');

writeSvg(appSvg, appIconSvg(1024));
writeSvg(traySvg, trayIconSvg(1024, '#FFFFFF'));
writeSvg(monitoringOffSvg, trayIconSvg(1024, '#FFFFFF', 0.0625, 0.45));
// Transparent background is required — opaque corners turn the icon into a flat square.
svgToPng(appSvg, appPng1024, 1024);

execFileSync('npx', ['tauri', 'icon', appPng1024, '-o', tauriIcons], { cwd: root, stdio: 'inherit' });

const trayPng = path.join(tauriIcons, 'tray.png');
const monitoringOffPng = path.join(tauriIcons, 'monitoring_off.png');
svgToPng(traySvg, trayPng, 64);
svgToPng(monitoringOffSvg, monitoringOffPng, 64);

const companionSvg = path.join(companionPublic, 'icon.svg');
writeSvg(companionSvg, appIconSvg(512));
writeSvg(path.join(publicDir, 'icon.svg'), appIconSvg(512));

for (const [out, size] of [[path.join(companionPublic, 'apple-touch-icon.png'), 180], [path.join(companionPublic, 'icon-192.png'), 192], [path.join(companionPublic, 'icon-512.png'), 512]]) {
  svgToPngOpaque(appSvg, out, size, BRAND_COLOR);
}

console.log('Icons generated in src-tauri/icons, apps/companion/public, and public/');
