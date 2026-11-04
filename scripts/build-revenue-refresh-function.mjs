import {createRequire} from 'node:module';
const require=createRequire(new URL('../server/package.json',import.meta.url));
const {build}=require('esbuild');
await build({entryPoints:['supabase/functions/app-revenue-refresh/index.ts'],bundle:true,format:'esm',platform:'neutral',target:'es2022',external:['npm:*'],outfile:'/private/tmp/app-revenue-refresh-bundle.ts'});
