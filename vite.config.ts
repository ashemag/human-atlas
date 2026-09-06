import {fileURLToPath} from 'node:url';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
const path=(relative:string)=>fileURLToPath(new URL(relative,import.meta.url));

/** Serve the anatomy assistant during `vite dev`.
 * In production the same handler runs as a Vercel function; this only bridges
 * Node request/response to the Fetch API shapes that handler expects. */
function anatomyApi(mode:string):Plugin{
 const env=loadEnv(mode,path('.'),'');
 const apiKey=env.API_KEY??env.GEMMA_API_KEY??'';
 return {
  name:'anatomy-api',
  configureServer(server){
   server.middlewares.use('/api/ask',async(req,res)=>{
    if(req.method!=='POST'){res.statusCode=405;res.end('Method not allowed');return;}
    if(!apiKey){res.statusCode=500;res.setHeader('content-type','application/json');res.end(JSON.stringify({error:'API_KEY is not set in .env.'}));return;}
    try{
     const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(chunk as Buffer);
     // Absolute: the dev server root is web/, so a root-relative path misses.
     const {handleAsk}=await server.ssrLoadModule(path('./api/ask.ts').replace(/\\/g,'/')) as typeof import('./api/ask');
     const response=await handleAsk(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'),apiKey);
     res.statusCode=response.status;
     response.headers.forEach((value,key)=>res.setHeader(key,value));
     if(!response.body){res.end();return;}
     const reader=response.body.getReader();
     for(;;){const {done,value}=await reader.read();if(done)break;res.write(Buffer.from(value));}
     res.end();
    }catch(error){
     server.config.logger.error(`anatomy-api: ${error instanceof Error?error.stack??error.message:String(error)}`);
     if(!res.headersSent){res.statusCode=500;res.setHeader('content-type','application/json');}
     res.end(JSON.stringify({error:'The anatomy assistant failed.'}));
    }
   });
  },
 };
}

export default defineConfig(({mode})=>({root:path('./web'),publicDir:path('./public'),plugins:[react(),anatomyApi(mode)],resolve:{alias:{'@':path('./')}},css:{postcss:{plugins:[tailwindcss()]}},server:{watch:{usePolling:true}},build:{outDir:path('./dist'),emptyOutDir:true}}));
