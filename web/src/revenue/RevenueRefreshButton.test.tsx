import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {it,expect} from "vitest";
import {RevenueRefreshButton} from "./RevenueRefreshButton";
const noop=()=>{};
it("shows an enabled refresh button for an explicit family refresh grant",()=>{
 const html=renderToStaticMarkup(createElement(RevenueRefreshButton,{allowed:true,busy:false,blocked:false,health:"online",onRefresh:noop,onRetry:noop}));
 expect(html).toContain("자료 새로고침");expect(html).not.toContain("disabled");
});
it("hides refresh without a grant and disables duplicate collection",()=>{
 const props={allowed:false,busy:false,blocked:false,health:"online" as const,onRefresh:noop,onRetry:noop};
 expect(renderToStaticMarkup(createElement(RevenueRefreshButton,props))).toBe("");
 expect(renderToStaticMarkup(createElement(RevenueRefreshButton,{...props,allowed:true,busy:true}))).toContain("disabled");
});
