import axios from "axios";

/** Basic in-memory cache with TTL (ms). */
type VulnSummary = { id: string; summary?: string; severity?: number; url?: string };
type OsvResult = { vulnerable: boolean; vulns: VulnSummary[] };

const cache = new Map<string, { expiry: number; data: OsvResult }>();

/** 24h default TTL; tweak as you like */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Infer ecosystem from a package name (very rough heuristic).
 * You can pass an explicit ecosystem instead.
 */
export function inferEcosystem(pkg: string): "npm" | "PyPI" {
  // If it contains a dot or underscore and looks pythonic, treat as PyPI.
  // Otherwise default to npm.
  return /[A-Z]/.test(pkg) || pkg.includes("_") || pkg.includes(".")
    ? "PyPI"
    : "npm";
}

function getCacheKey(pkg: string, eco: string) {
  return `${eco}:${pkg.toLowerCase()}`;
}

export function getFromCache(pkg: string, eco: string): OsvResult | undefined {
  const key = getCacheKey(pkg, eco);
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiry) {
    cache.delete(key);
    return undefined;
  }
  return hit.data;
}

export function setCache(pkg: string, eco: string, data: OsvResult, ttlMs = DEFAULT_TTL_MS) {
  const key = getCacheKey(pkg, eco);
  cache.set(key, { expiry: Date.now() + ttlMs, data });
}

/**
 * Query OSV.dev for known vulnerabilities in a package.
 * Uses cache-first strategy; sets a timeout to avoid hanging requests.
 */
export async function queryOSV(pkg: string, eco?: "npm" | "PyPI"): Promise<OsvResult> {
  const ecosystem = eco || inferEcosystem(pkg);

  // cache hit?
  const cached = getFromCache(pkg, ecosystem);
  if (cached) return cached;

  try {
    const resp = await axios.post(
      "https://api.osv.dev/v1/query",
      { package: { name: pkg, ecosystem } },
      { timeout: 5000 } // 5s timeout
    );

    const vulns = (resp.data?.vulns || []).map((v: any) => ({
      id: v.id,
      summary: v.summary,
      severity: v.severity?.[0]?.score ? parseFloat(v.severity[0].score) : undefined,
      url: v.references?.find((r: any) => typeof r?.url === "string")?.url
    })) as VulnSummary[];

    const result: OsvResult = { vulnerable: vulns.length > 0, vulns };
    setCache(pkg, ecosystem, result);
    return result;
  } catch (err: any) {
    // On failure, cache a negative result briefly to avoid hammering
    const fallback: OsvResult = { vulnerable: false, vulns: [] };
    setCache(pkg, ecosystem, fallback, 5 * 60 * 1000); // 5 min negative cache
    return fallback;
  }
}
