import { Resolver } from "node:dns/promises";

function dnsResolve(domain: string, servers = ["185.222.222.222", "45.11.45.11"]) {
    const resolver = new Resolver();
    resolver.setServers(servers);
    return resolver.resolve4(domain);
}

async function doh(server: string, domain: string, type = "A") {
    const url = new URL(server);
    url.searchParams.set("name", domain);
    url.searchParams.set("type", type);
    const res = await fetch(url, {
        headers: {
            "content-type": "application/dns-message",
            accept: "application/dns-json",
        },
    });
    if (!res.ok) throw new Error(`fetch is not OK. make sure you are using a DoH server with json support`);
    const txt = await res.text();
    try {
        return JSON.parse(txt);
    } catch {
        throw new Error(`make sure you are using a DoH server with json support. response: ${txt}`);
    }
}

/**
 * @description though this is problematic as it only ask for 'A' record, but can cover most cases
 * https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-6
 */
async function dohResolve(domain: string, server = "https://cloudflare-dns.com/dns-query") {
    const resp = await doh(server, domain);
    if (resp.Status !== 0) throw new Error(`Error code ${resp.Status} from DoH server`);
    return resp.Answer.filter((a: any) => a.type === 1).map((a: any) => a.data) as string[];
}

/**
 * Make sure you provide a correct server!
 * @param servers if is `string[]`, use normal dns. if is `string`, use doh
 */
export function resolve(domain: string, servers: string[] | string = ["8.8.8.8"]) {
    const resolve = typeof servers === "string" ? dohResolve : dnsResolve;
    return resolve(domain, servers as any);
}

let cacheTable: Record<string, string[]> = {};
export async function cacheResolve(domain: string, servers: string[] | string, table?: Record<string, string[]>) {
    cacheTable = Object.assign(cacheTable, table);
    if (domain in cacheTable) return cacheTable[domain];
    return await resolve(domain, servers);
}
