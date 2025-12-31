import { TeXBridge } from './bridge.js'; 
import type { CompileJob, CompileResult, EmscriptenModuleFactory } from './types.js'; 

// Placeholder: In the real build, this import points to the generated glue code. 
// We declare it simply here. The bundler handles imports. 
// import TikZModuleFactory from './tex_engine.js'; 

const bridge = new TeXBridge(); 
let initialized = false; 

// We allow passing the factory via global or binding for testing
// In production, this would be imported directly. 
declare global { 
  var TikZModuleFactory: EmscriptenModuleFactory; 
} 

self.onmessage = async (e: MessageEvent<CompileJob>) => { 
  const { id, source } = e.data; 
  const result: CompileResult = { 
    id, 
    success: false, 
    logs: [], 
  }; 

  try { 
    if (!initialized) { 
      if (typeof self.TikZModuleFactory !== 'function') { 
        throw new Error('WASM Module Factory not found.'); 
      } 
      await bridge.init(self.TikZModuleFactory); 
      initialized = true; 
    } 

    // 1. Write Input
    bridge.writeFile('input.tex', source); 

    // 2. Run Engine (assuming defaults output to input.dvi) 
    const success = bridge.runTeX('input.tex'); 

    // 3. Harvest Result
    result.logs = bridge.getLogs(); 
    result.success = success; 

    if (success) { 
      // TeX output usually matches input basename
      result.dvi = bridge.readFile('input.dvi'); 
    } 

  } catch (err: any) { 
    result.error = err.message || 'Unknown Worker Error'; 
  } 

  self.postMessage(result); 
};