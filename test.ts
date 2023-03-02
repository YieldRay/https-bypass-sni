import tryFetch from "./src/fetch";
import { writeFileSync } from "node:fs";

tryFetch(
    {
        timeout: 5000,
        ips: [
            "210.140.92.145",
            "210.140.139.136",
            "210.140.92.142",
            "210.140.92.148",
            "210.140.92.143",
            "210.140.92.147",
            "210.140.92.141",
            "210.140.92.146",
            "210.140.92.144",
        ],
        notConcurrent: false, // default is false, which can be faster but will establish more connection
    },
    "https://i.pximg.net/img-original/img/2023/01/25/00/03/22/104786411_p0.jpg",
    {
        headers: {
            Referer: "https://www.pixiv.net/",
            "User-Agent": "PixivIOSApp/6.7.1 (iOS 10.3.1; iPhone8,1)",
        },
    }
)
    .then((res) => res.arrayBuffer())
    .then(Buffer.from)
    .then((buf) => writeFileSync("./104786411_p0.jpg", buf));

// use a custom dns server (DoH for example)
// tryFetch(
//     {
//         timeout: 10000,
//         resolve: (domain) => resolve(domain, "https://d-o-h.v6.rocks/dns-query"),
//     },
//     "https://i.pximg.net/img-original/img/2023/01/25/00/03/22/104786411_p0.jpg",
//     {
//         headers: {
//             Referer: "https://www.pixiv.net/",
//             "User-Agent": "PixivIOSApp/6.7.1 (iOS 10.3.1; iPhone8,1)",
//         },
//     }
// )
//     .then((res) => res.arrayBuffer())
//     .then(Buffer.from)
//     .then((buf) => writeFileSync("./104786411_p0.jpg", buf));
