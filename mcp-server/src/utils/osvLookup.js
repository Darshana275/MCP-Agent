import axios from "axios";
const cache = new Map();
/** 24h default TTL; tweak as you like */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * Infer ecosystem from a package name (very rough heuristic).
 * You can pass an explicit ecosystem instead.
 */
export function inferEcosystem(pkg) {
    // If it contains a dot or underscore and looks pythonic, treat as PyPI.
    // Otherwise default to npm.
    return /[A-Z]/.test(pkg) || pkg.includes("_") || pkg.includes(".")
        ? "PyPI"
        : "npm";
}
function getCacheKey(pkg, eco) {
    return `${eco}:${pkg.toLowerCase()}`;
}
export function getFromCache(pkg, eco) {
    const key = getCacheKey(pkg, eco);
    const hit = cache.get(key);
    if (!hit)
        return undefined;
    if (Date.now() > hit.expiry) {
        cache.delete(key);
        return undefined;
    }
    return hit.data;
}
export function setCache(pkg, eco, data, ttlMs = DEFAULT_TTL_MS) {
    const key = getCacheKey(pkg, eco);
    cache.set(key, { expiry: Date.now() + ttlMs, data });
}
/**
 * Query OSV.dev for known vulnerabilities in a package.
 * Uses cache-first strategy; sets a timeout to avoid hanging requests.
 */
export async function queryOSV(pkg, eco) {
    const ecosystem = eco || inferEcosystem(pkg);
    // cache hit?
    const cached = getFromCache(pkg, ecosystem);
    if (cached)
        return cached;
    try {
        const resp = await axios.post("https://api.osv.dev/v1/query", { package: { name: pkg, ecosystem } }, { timeout: 5000 } // 5s timeout
        );
        const vulns = (resp.data?.vulns || []).map((v) => ({
            id: v.id,
            summary: v.summary,
            severity: v.severity?.[0]?.score ? parseFloat(v.severity[0].score) : undefined,
            url: v.references?.find((r) => typeof r?.url === "string")?.url
        }));
        const result = { vulnerable: vulns.length > 0, vulns };
        setCache(pkg, ecosystem, result);
        return result;
    }
    catch (err) {
        // On failure, cache a negative result briefly to avoid hammering
        const fallback = { vulnerable: false, vulns: [] };
        setCache(pkg, ecosystem, fallback, 5 * 60 * 1000); // 5 min negative cache
        return fallback;
    }
}
//# sourceMappingURL=osvLookup.js.map