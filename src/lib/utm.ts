/**
 * Persistência de parâmetros de tracking (spec Meta Ads da campanha).
 *
 * No carregamento, captura da URL: utm_source, utm_medium, utm_campaign,
 * utm_content, utm_term, fbclid e gclid, e persiste cada um em
 * localStorage E cookie (90 dias, path=/, SameSite=Lax). Se vier fbclid e
 * não existir cookie _fbc, cria `fb.1.{timestamp_s}.{fbclid}`.
 * Na leitura, prioriza localStorage com fallback para cookie — o lead que
 * navega entre etapas/páginas não perde a atribuição.
 */

export type TrackingParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
};

const TRACKING_KEYS: (keyof TrackingParams)[] = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
];

const COOKIE_DAYS = 90;

function setCookie(name: string, value: string, days = COOKIE_DAYS) {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${
    days * 86400
  }; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** Captura os parâmetros da URL e persiste (localStorage + cookie). */
export function captureUtms(): TrackingParams {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);

  for (const key of TRACKING_KEYS) {
    const value = params.get(key);
    if (!value) continue;
    try {
      localStorage.setItem(key, value);
    } catch {
      // storage indisponível — o cookie cobre
    }
    setCookie(key, value);
  }

  // _fbc a partir do fbclid (formato oficial da Meta), sem sobrescrever
  const fbclid = params.get("fbclid");
  if (fbclid && !getCookie("_fbc")) {
    setCookie("_fbc", `fb.1.${Math.floor(Date.now() / 1000)}.${fbclid}`);
  }

  return getStoredUtms();
}

/** Lê os parâmetros persistidos (localStorage → fallback cookie). */
export function getStoredUtms(): TrackingParams {
  if (typeof window === "undefined") return {};
  const result: TrackingParams = {};
  for (const key of TRACKING_KEYS) {
    let value: string | null | undefined;
    try {
      value = localStorage.getItem(key);
    } catch {
      value = undefined;
    }
    value = value ?? getCookie(key);
    if (value) result[key] = value;
  }
  return result;
}

/** Anexa apenas as UTMs (não fbclid/gclid) a uma URL de destino. */
export function appendUtmsToUrl(url: string): string {
  const utms = getStoredUtms();
  const entries = Object.entries(utms).filter(
    ([key, value]) => key.startsWith("utm_") && Boolean(value)
  );
  if (entries.length === 0) return url;
  try {
    const target = new URL(url);
    for (const [key, value] of entries) {
      if (!target.searchParams.has(key)) target.searchParams.set(key, value);
    }
    return target.toString();
  } catch {
    return url;
  }
}
