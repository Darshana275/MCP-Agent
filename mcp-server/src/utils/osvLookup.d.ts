/** Basic in-memory cache with TTL (ms). */
type VulnSummary = {
    id: string;
    summary?: string;
    severity?: number;
    url?: string;
};
type OsvResult = {
    vulnerable: boolean;
    vulns: VulnSummary[];
};
/**
 * Infer ecosystem from a package name (very rough heuristic).
 * You can pass an explicit ecosystem instead.
 */
export declare function inferEcosystem(pkg: string): "npm" | "PyPI";
export declare function getFromCache(pkg: string, eco: string): OsvResult | undefined;
export declare function setCache(pkg: string, eco: string, data: OsvResult, ttlMs?: number): void;
/**
 * Query OSV.dev for known vulnerabilities in a package.
 * Uses cache-first strategy; sets a timeout to avoid hanging requests.
 */
export declare function queryOSV(pkg: string, eco?: "npm" | "PyPI"): Promise<OsvResult>;
export {};
//# sourceMappingURL=osvLookup.d.ts.map