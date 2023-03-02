import { buffer } from "node:stream/consumers";
import httpRequest from "./http";
import { dnsResolve } from "./resolve";

/**
 * This is a incomplete function to meet web `fetch` function, some trait are missing, but can meet common usage
 * @param input make sure url is `https` as SNI has no effect to `http`
 * @param init can provide a special config `ip` to avoid wrong default dns resolve result
 * @example
 * const html = await fetch("https://pixiv.net/", {ip: "x.x.x.x"}).then(res=>res.text())
 */
async function fetchSNI(input: RequestInfo | URL, init?: RequestInit & { ip?: string }): Promise<Response> {
    const req = new Request(input, init);
    const { method, body: reqBody, signal } = req;
    const url = new URL(req.url);
    const { pathname, search, hostname, port } = url;
    const path = pathname + search;
    const reqHeaders = Object.fromEntries(req.headers.entries());
    const host = init?.ip || hostname;

    const { statusCode, statusMessage, headers, body } = await httpRequest({
        host,
        servername: hostname,
        port: Number(port), // this will never be NaN if http response is corrrect
        path,
        method,
        headers: reqHeaders,
        body: reqBody ? await buffer(reqBody as any as NodeJS.ReadableStream) : undefined,
        signal,
    });

    return new Response(body, {
        headers,
        status: Number(statusCode),
        statusText: statusMessage,
    });
}

function timeoutSignal(ms: number) {
    if (typeof ms !== "number") throw new Error("timeout should be Number!");
    // just because ts-node has some error with AbortSignal.timeout
    const ab = new AbortController();
    setTimeout(() => ab.abort(), ms);
    return ab.signal;
}

export default async function tryFetch(
    conf: {
        ips?: string[];
        resolve?: (domain: string) => Promise<string[]>;
        timeout?: number;
        notConcurrent?: boolean; // default is false, which can be faster but will establish more connection at the same time
    },
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response> {
    const req = new Request(input, init);
    const { hostname } = new URL(req.url);
    const ips = conf.ips || []; // use provided ips
    const signal = conf.timeout ? timeoutSignal(conf.timeout) : undefined;
    conf.resolve ? ips.concat(await conf.resolve(hostname)) : null; // use resolve func

    if (ips.length === 0) {
        console.warn("Use default DNS server, make sure it can resolve correct ip(s)!");
        ips.concat(await dnsResolve(hostname));
    }

    const promise = conf.notConcurrent
        ? new Promise<Response>(async (resolve, reject) => {
              // this is in order
              for (let ip of ips) {
                  try {
                      const res = await fetchSNI(req, {
                          ip,
                          signal,
                      });
                      resolve(res);
                      return;
                  } catch {
                      console.info(ip + " is unable to connect");
                  }
                  reject(new Error("No avaiable IP (make sure the resolved ips are correct): " + JSON.stringify(ips)));
              }
          })
        : Promise.any(
              // this is concurrent
              ips.map((ip) =>
                  fetchSNI(req, {
                      ip,
                      signal,
                  })
              )
          );

    try {
        return await promise;
    } catch (e) {
        console.warn(e); // this is for debug
        throw new Error("No avaiable IP (make sure the resolved ips are correct): " + JSON.stringify(ips));
    }
}
