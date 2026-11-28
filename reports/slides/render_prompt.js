const { chromium } = require('playwright');
const fs = require('fs');
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function hl(line){
  let h = esc(line);
  h = h.replace(/(\{&quot;|\{"[^}]*\})/g, m=>m); 
  h = h.replace(/(\{"falha"[^}]*\})/g,'<span class="json">$1</span>');
  h = h.replace(/(-&gt;)/g,'<span class="arrow">$1</span>');
  h = h.replace(/^(Exemplos rotulados.*|Leituras rotuladas.*|Classifique esta leitura:|Atributos.*:|Mecanismos de falha.*:|Responda SOMENTE.*)$/,'<span class="hdr">$1</span>');
  h = h.replace(/(Tipo: [LMH])/g,'<span class="key">$1</span>');
  return h;
}
async function render(src, out, opts){
  const raw = fs.readFileSync(src,'utf8').replace(/\r/g,'').trimEnd();
  const [sys, user] = raw.split(/\n\s*\[USER\]\n/);
  const sysBody = sys.replace('[SYSTEM]\n','');
  let userLines = user.split('\n');
  if (opts.maxEx){ // truncate example list
    const ex = userLines.filter(l=>l.startsWith('- '));
    if (ex.length>opts.maxEx){
      let kept=0, out2=[];
      for(const l of userLines){ if(l.startsWith('- ')){ kept++; if(kept<=opts.maxEx) out2.push(l); else if(kept===opts.maxEx+1) out2.push(`  (... mais ${ex.length-opts.maxEx} exemplos no mesmo formato ...)`);} else out2.push(l);}
      userLines=out2;
    }
  }
  const block = (t, cls, lines) => `<div class="msg ${cls}"><div class="role">${t}</div><pre>${lines.map(hl).join('\n')}</pre></div>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#1B2631;font-family:'DejaVu Sans Mono',monospace;}
  .win{width:${opts.w}px;background:#16202A;border-radius:14px;overflow:hidden;}
  .bar{height:34px;background:#0F171F;display:flex;align-items:center;padding:0 14px;gap:8px;color:#8FA3B3;font:13px 'DejaVu Sans',sans-serif}
  .dot{width:12px;height:12px;border-radius:50%} .t{margin-left:12px}
  .msg{margin:14px 16px;border-radius:10px;padding:10px 14px 12px}
  .system{background:#1F2E3B} .user{background:#22323A}
  .role{font:bold 13px 'DejaVu Sans',sans-serif;letter-spacing:1px;margin-bottom:6px}
  .system .role{color:#F0A04B} .user .role{color:#4FC1B0}
  pre{margin:0;white-space:pre-wrap;word-break:break-word;color:#DCE5EC;font-size:${opts.fs}px;line-height:1.38}
  .json{color:#F7C873;font-weight:bold} .arrow{color:#8FA3B3} .hdr{color:#9CC7FF;font-weight:bold} .key{color:#B9E6D8}
  .resp{margin:0 16px 16px;display:flex;align-items:center;gap:10px;color:#8FA3B3;font:13px 'DejaVu Sans',sans-serif}
  .resp code{background:#0F171F;color:#F7C873;padding:6px 10px;border-radius:6px;font:${opts.fs}px 'DejaVu Sans Mono',monospace}
  </style></head><body><div class="win" id="w">
  <div class="bar"><span class="dot" style="background:#E5604F"></span><span class="dot" style="background:#E8B04A"></span><span class="dot" style="background:#5BB974"></span><span class="t">${opts.title}</span></div>
  ${block('SYSTEM', 'system', sysBody.split('\n'))}
  ${block('USER', 'user', userLines)}
  <div class="resp">formato da resposta (exemplo) &rarr; <code>{"falha": 0, "probabilidade": 0.1}</code></div>
  </div></body></html>`;
  const b = await chromium.launch(); const p = await b.newPage({deviceScaleFactor:2, viewport:{width:opts.w+20,height:800}});
  await p.setContent(html); const el = await p.$('#w'); await el.screenshot({path:out}); await b.close();
}
(async()=>{
  await render('v1_k3.txt','prompt_v1_k3.png',{w:1300,fs:17,title:'deepseek-chat · prompt v1 · few-shot k=3 · src/llm/prompts.py'});
  await render('v2_regras_knn10.txt','prompt_v2.png',{w:1760,fs:16,maxEx:3,title:'deepseek-chat · prompt v2 (EXTRA) · regras + 10 vizinhos · src/llm/prompts_domain.py'});
})();
