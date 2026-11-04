import { createClient } from "npm:@supabase/supabase-js@2.105.3";
import { mergeSharedRefresh } from "../../../web/src/revenue/mergeRefresh.ts";
import { fetchMissingRevenueRates, mergeFetchedRevenueRates } from "../../../web/src/revenue/fxRates.ts";
import { verifyRefreshProof } from "./verify.ts";
import publicKey from "./public-key.json" with { type: "json" };

const OWNER = "cf985c51-f258-494f-8a29-8cdcd490ebd6";
const cors = {"Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply = (data: unknown, status=200) => Response.json(data,{status,headers:cors});
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:cors});
  if (req.method !== "POST") return reply({error:"POST required"},405);
  const authorization=req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return reply({error:"로그인이 필요합니다."},401);
  const url=Deno.env.get("SUPABASE_URL")!;
  const userClient=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data:userData,error:authError}=await userClient.auth.getUser(authorization.slice(7));
  if(authError || !userData.user || userData.user.is_anonymous) return reply({error:"로그인을 확인해 주세요."},401);
  const viewer=userData.user.id;
  const grant=async()=> {
    const {data,error}=await userClient.from("app_revenue_viewers").select("owner_id,can_refresh").eq("viewer_id",viewer).eq("owner_id",OWNER).eq("can_refresh",true).maybeSingle();
    return !error && !!data;
  };
  if(!await grant()) return reply({error:"공유 새로고침 권한이 없습니다."},403);
  try {
    const {jobId}=await req.json();
    if(typeof jobId!=="string" || !/^[0-9a-f-]{36}$/i.test(jobId)) return reply({error:"수집 기록을 확인해 주세요."},400);
    const {data:stored,error}=await userClient.from("app_revenue_jobs").select("id,state,result").eq("id",jobId).eq("user_id",viewer).maybeSingle();
    if(error || !stored || stored.state!=="done") return reply({error:"완료된 수집 기록이 없습니다."},409);
    const job={...stored.result,id:stored.id,state:stored.state};
    await verifyRefreshProof(job,viewer,OWNER,publicKey);
    // This key is provided only inside the Edge runtime. It is never read by the browser or returned.
    const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
    for(let retry=0;retry<3;retry++) {
      const {data:snapshot,error:readError}=await admin.from("app_revenue_snapshots").select("payload,updated_at").eq("user_id",OWNER).single();
      if(readError || !snapshot) throw new Error("공유 원본을 읽지 못했습니다.");
      if(snapshot.payload.logs?.some((log: {id:string})=>log.id===`shared-refresh:${jobId}`)) return reply({ok:true});
      const next=await mergeSharedRefresh(snapshot.payload,job);
      const fxErrors: string[]=[];
      const rates=await fetchMissingRevenueRates(next.rows,next.rates,issue=>fxErrors.push(issue.message));
      next.rates=mergeFetchedRevenueRates(next.rates,rates,snapshot.payload.rates);
      if(fxErrors.length) {
        next.logs[0]={...next.logs[0],status:"partial",detail:{...next.logs[0].detail,errors:[...(next.logs[0].detail?.errors || []),...fxErrors]}};
      }
      // Re-check live membership immediately before the write; compare-and-swap preserves concurrent owner edits.
      if(!await grant()) return reply({error:"공유 권한이 변경되었습니다."},403);
      const {data:updated,error:saveError}=await admin.from("app_revenue_snapshots").update({payload:next,updated_at:next.meta.updatedAt})
        .eq("user_id",OWNER).eq("updated_at",snapshot.updated_at).select("updated_at").maybeSingle();
      if(saveError) throw new Error("공유 자료를 저장하지 못했습니다.");
      if(updated) return reply({ok:true,updatedAt:updated.updated_at,message:next.logs[0].message,errors:next.logs[0].detail?.errors || []});
    }
    return reply({error:"다른 기기에서 자료를 수정 중입니다. 잠시 뒤 새로고침해 주세요."},409);
  } catch(e) { return reply({error:e instanceof Error ? e.message : "새로고침 실패"},400); }
});
