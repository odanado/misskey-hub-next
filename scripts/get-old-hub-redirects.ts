import { redirects } from './../assets/data/old-hub-redirects';
import { localesConst, localePathRegex } from './../assets/data/locales';
import type { LocaleCodes } from './../assets/data/locales';
import type { PartialRecord } from './../types/others';
import { joinURL } from 'ufo';
import { readFileSync, writeFileSync, promises as fsp } from 'fs';
import { mkdir, access } from 'fs/promises';
import { constants } from 'fs';

// 旧Hub時代の各言語のプレフィックス
const hubLocales: PartialRecord<LocaleCodes, string> = {
    ja: '/',
    en: '/en',
    id: '/id',
    ko: '/ko',
    it: '/it',
    pl: '/pl',
    fr: '/fr',
    cn: '/zh-CN',
    tw: '/zh-TW',
};

export async function generateOldHubRedirects() {
    const out = new Map<string, string>();

    localesConst.filter((v) => hubLocales.hasOwnProperty(v.code)).forEach((locale) => {
        redirects.forEach((route) => {
            if (route[0].startsWith('/ns') || ['/', '/index.html'].includes(route[0])) return;

            let destination = route[1];

            if (!localePathRegex.test(destination)) {
                destination = joinURL(`/${locale.code}`, destination);
            }

            if (route[0].endsWith('.md')) return;

            out.set(joinURL(hubLocales[locale.code] ?? '/', route[0]), destination);
        });
    });



    function getRedirectHtml(destination: string) {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="0; url=${destination}">
    <link rel="canonical" href="${destination}">
</head>
<body></body>
</html>`;
    }

    const redirectsDir = './.output/public';
    if (process.env.CF_PAGES === '1') {
        const template = readFileSync('./public/_redirects_template', 'utf8');
        const markdown = redirects.filter(([source]) => source.endsWith('.md')).map(([source, target]) => `${source} ${target} 301`);
        await fsp.writeFile(`${redirectsDir}/_redirects`, template + '\n' + markdown.join('\n'));
    }

    for (const [src, dest] of out.entries()) {
        let srcPath = src;

        if (srcPath.endsWith('/')) {
            srcPath += 'index.html';
        } else if (srcPath.endsWith('.md')) {
            srcPath = srcPath.slice(0, -3) + '.html';
        }

        const filePath = redirectsDir + srcPath;

        try {
            // ディレクトリを作成（存在しない場合のみ）
            await mkdir(filePath.substring(0, filePath.lastIndexOf('/')), { recursive: true });

            // ファイルが既に存在するか確認
            await access(filePath, constants.F_OK);

        } catch {
            // ファイルが存在しない場合は作成
            await fsp.writeFile(filePath, getRedirectHtml(dest));

        }
    }
}
