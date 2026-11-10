import React from "react";
import {createRoot} from "react-dom/client";
import {act} from "react-dom/test-utils";
import {StudioLogos} from "./StudioLogos";
test("only animation studios appear and logo links filter Discovery with the studio ID",async()=>{
 const original=global.fetch;
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({id:8888,logo:"https://image.tmdb.org/t/p/original/studio.png"})});
 const node=document.createElement("div");document.body.append(node);const root=createRoot(node);const select=jest.fn();
 try {
 await act(async()=>root.render(<StudioLogos studios={[{id:8888,name:"Studio",isAnimationStudio:true},{id:9,name:"Distributor",isAnimationStudio:false}]} onSelect={select}/>));
 expect(node.querySelectorAll("a")).toHaveLength(1);
 expect(node.querySelector("img")?.alt).toBe("Studio");
 expect(node.querySelector("a")?.getAttribute("href")).toContain("studio=8888");
 act(()=>node.querySelector("a")!.click());expect(select).toHaveBeenCalledWith(8888,"Studio");
 act(()=>node.querySelector("img")!.dispatchEvent(new Event("error")));expect(node.textContent).toBe("Studio");
 } finally {act(()=>root.unmount());node.remove();global.fetch=original;}
});
