export async function verifyRefreshProof(job: any, viewerId: string, ownerId: string, key: JsonWebKey) {
  const fail=()=>{throw new Error("수집 결과의 서버 서명을 확인할 수 없습니다. 다시 수집해 주세요.");};
  if(typeof job.refreshProof!=="string") return fail();
  const parts=job.refreshProof.split(".");
  if(parts.length!==2) return fail();
  const bytes=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
  const publicKey=await crypto.subtle.importKey("jwk",key,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",publicKey,bytes(parts[1]),new TextEncoder().encode(parts[0]))) return fail();
  const proof=JSON.parse(new TextDecoder().decode(bytes(parts[0])));
  if(proof.viewerId!==viewerId || proof.ownerId!==ownerId || proof.jobId!==job.id || !Number.isFinite(proof.exp) || proof.exp< Date.now()/1000 || proof.exp>Date.now()/1000+3700) return fail();
  const contents=JSON.stringify({apps:job.apps,documents:job.documents,errors:job.errors,completed:job.completed});
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(contents))),b=>b.toString(16).padStart(2,"0")).join("");
  if(proof.digest!==digest) return fail();
}
