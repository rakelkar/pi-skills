#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const useProfile = process.argv[2] === "--profile";

if (process.argv[2] && process.argv[2] !== "--profile") {
	console.log("Usage: browser-start.js [--profile]");
	console.log("\nOptions:");
	console.log("  --profile  Copy your default Edge profile (cookies, logins)");
	process.exit(1);
}

const WIN_USER = execSync('cmd.exe /c "echo %USERNAME%"', { stdio: ["ignore", "pipe", "ignore"] })
	.toString()
	.trim();
const WIN_HOME_WSL = `/mnt/c/Users/${WIN_USER}`;
const WIN_HOME = `C:\\Users\\${WIN_USER}`;

const SCRAPING_DIR = `${WIN_HOME_WSL}/AppData/Local/Temp/browser-tools`;
const SCRAPING_DIR_WIN = `${WIN_HOME}\\AppData\\Local\\Temp\\browser-tools`;

// Check if already running on :9222
try {
	const browser = await puppeteer.connect({
		browserURL: "http://127.0.0.1:9222",
		defaultViewport: null,
	});
	await browser.disconnect();
	console.log("✓ Edge already running on :9222");
	process.exit(0);
} catch {}

// Setup profile directory
execSync(`cmd.exe /c "if not exist ${SCRAPING_DIR_WIN} mkdir ${SCRAPING_DIR_WIN}"`, { stdio: "ignore" });

// Remove SingletonLock to allow new instance
try {
	execSync(`rm -f "${SCRAPING_DIR}/SingletonLock" "${SCRAPING_DIR}/SingletonSocket" "${SCRAPING_DIR}/SingletonCookie"`, { stdio: "ignore" });
} catch {}

// Edge profile path on Windows (accessed via WSL)
const WINDOWS_EDGE_PROFILE = `${WIN_HOME_WSL}/AppData/Local/Microsoft/Edge/User Data`;

if (useProfile) {
	// console.log("Syncing Edge profile...");
	// execSync(
	// 	`rsync -a --delete \
	// 		--exclude='SingletonLock' \
	// 		--exclude='SingletonSocket' \
	// 		--exclude='SingletonCookie' \
	// 		--exclude='*/Sessions/*' \
	// 		--exclude='*/Current Session' \
	// 		--exclude='*/Current Tabs' \
	// 		--exclude='*/Last Session' \
	// 		--exclude='*/Last Tabs' \
	// 		"${WINDOWS_EDGE_PROFILE}/" "${SCRAPING_DIR}/"`,
	// 	{ stdio: "pipe" },
	// );
}

// Start Edge with flags to force new instance (Windows Edge via WSL)
const EDGE_PATH = "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
spawn(
	EDGE_PATH,
	[
		"--remote-debugging-port=9222",
		`--user-data-dir=${SCRAPING_DIR_WIN}`,
		"--no-first-run",
		"--no-default-browser-check",
	],
	{ detached: true, stdio: "ignore" },
).unref();

// Wait for Edge to be ready
let connected = false;
for (let i = 0; i < 30; i++) {
	try {
		const browser = await puppeteer.connect({
			browserURL: "http://127.0.0.1:9222",
			defaultViewport: null,
		});
		await browser.disconnect();
		connected = true;
		break;
	} catch {
		await new Promise((r) => setTimeout(r, 500));
	}
}

if (!connected) {
	// If Edge is already running without remote debugging, restart it once.
	console.log("! DevTools not reachable. Restarting Edge with remote debugging...");
	try {
		execSync("/mnt/c/Windows/System32/taskkill.exe /IM msedge.exe /F", { stdio: "ignore" });
	} catch {}

	spawn(
		EDGE_PATH,
		[
			"--remote-debugging-port=9222",
			`--user-data-dir=${SCRAPING_DIR_WIN}`,
			"--no-first-run",
			"--no-default-browser-check",
		],
		{ detached: true, stdio: "ignore" },
	).unref();

	for (let i = 0; i < 30; i++) {
		try {
			const browser = await puppeteer.connect({
				browserURL: "http://127.0.0.1:9222",
				defaultViewport: null,
			});
			await browser.disconnect();
			connected = true;
			break;
		} catch {
			await new Promise((r) => setTimeout(r, 500));
		}
	}
}

if (!connected) {
	console.error("✗ Failed to connect to Edge");
	process.exit(1);
}

console.log(`✓ Edge started on :9222${useProfile ? " with your profile" : ""}`);
