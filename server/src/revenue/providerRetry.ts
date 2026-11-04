/** Only idempotent reads retry temporary network/provider failures. */
export async function fetchProviderReport(url:string, init:RequestInit={}, options:{fetcher?:typeof fetch;wait?:(ms:number)=>Promise<void>}={}) {
 const fetcher=options.fetcher??fetch,wait=options.wait??(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
 const attempts=(init.method??'GET').toUpperCase()==='GET'?3:1;
 for(let attempt=0;attempt<attempts;attempt++) {
  init.signal?.throwIfAborted();
  try {
   const response=await fetcher(url,{...init,signal:init.signal??AbortSignal.timeout(25000)});
   if(attempt===attempts-1||![408,429,500,502,503,504].includes(response.status))return response;
   const raw=response.headers.get('retry-after');
   const delay=raw?(/^\d+$/.test(raw)?Number(raw)*1000:Date.parse(raw)-Date.now()):NaN;
   if(Number.isFinite(delay)&&delay>5000)return response;
   await response.body?.cancel();
   await wait(Number.isFinite(delay)?Math.max(0,delay):500*2**attempt);
  } catch(error) {
   if(init.signal?.aborted||attempt===attempts-1||!(error instanceof TypeError||error instanceof DOMException&&error.name==='TimeoutError'))throw error;
   await wait(500*2**attempt);
  }
 }
 throw new Error('Provider request did not complete');
}
