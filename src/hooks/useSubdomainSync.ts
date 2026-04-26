import { useEffect, useRef } from "react";
import { useAppMode } from "./useAppMode";

/**
 * Production domains recognized by the app.
 * The hook only attempts to correct the subdomain on these hosts.
 */
const KNOWN_HOSTS = new Set([
  "meuestoque.apenasgabs.dev",
  "nossoestoque.apenasgabs.dev",
  // Localhost aliases for development
  "meuestoque.localhost",
  "nossoestoque.localhost",
]);

/**
 * Hook that synchronizes the subdomain (URL) with the current app mode
 * using `window.history.replaceState`, without causing a page reload.
 *
 * Workflow:
 * 1. On mount or when `mode` changes, it checks if the current hostname
 *    is one of the known production domains.
 * 2. If it's on the wrong domain for the current mode, it performs a
 *    `replaceState` updating only the hostname.
 * 3. It also reactively updates `document.title`.
 *
 * The hook does not interfere with the URL on unknown hosts (like Vercel preview domains).
 */
export const useSubdomainSync = (): void => {
  const { appTitle, targetDomain, mode } = useAppMode();
  const lastSyncedMode = useRef(mode);

  useEffect(() => {
    // Always keep document.title updated
    document.title = appTitle;
  }, [appTitle]);

  useEffect(() => {
    // Avoid unnecessary re-runs if mode hasn't actually changed
    if (lastSyncedMode.current === mode) return;
    lastSyncedMode.current = mode;

    const currentHost = window.location.hostname;

    // Only synchronize on recognized production/local hosts
    if (!KNOWN_HOSTS.has(currentHost)) return;

    // If already on the correct domain, nothing to do
    if (currentHost === targetDomain) return;

    // Build the new URL preserving path, search, and hash
    const newUrl = `${window.location.protocol}//${targetDomain}${window.location.pathname}${window.location.search}${window.location.hash}`;

    // replaceState doesn't trigger a reload — it just updates the address bar
    window.history.replaceState(window.history.state, "", newUrl);
  }, [mode, targetDomain]);
}
