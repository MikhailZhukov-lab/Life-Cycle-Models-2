'use strict';
(() => {
  const M = window.SlarMath, { Chart } = window.SlarCharts;
  const $ = id => document.getElementById(id);
  const names = { gauss: 'Гаусс', jacobi: 'Якобі', seidel: 'Зейдель' };
  const colors = { gauss: '#6282ab', jacobi: '#c66f44', seidel: '#20765e' };
  const fmt = value => Number.isFinite(value) ? (Math.abs(value) !== 0 && (Math.abs(value) < .0001 || Math.abs(value) > 1e5) ? value.toExponential(3) : value.toFixed(6).replace(/\.?0+$/, '')) : '—';
  class Application {
    constructor() {
      this.state = { custom: null, method: 'gauss', frame: 0, playing: false };
      this.charts = { convergence: new Chart($('convergence')), solution: new Chart($('solution')), iteration: new Chart($('iteration')) };
      this.gallery = [];
      $('controls').addEventListener('submit', e => { e.preventDefault(); this.recalculate(); });
      for (const id of ['size', 'margin']) $(id).addEventListener('change', () => { this.state.custom = null; this.recalculate(); });
      $('method').addEventListener('change', () => { this.state.method = $('method').value; this.resetAnimation(); });
      $('reset').addEventListener('click', () => { this.state.custom = null; this.recalculate(); });
      $('apply').addEventListener('click', () => this.applyInput());
      $('file').addEventListener('change', async e => { try { if (e.target.files[0]) { $('input').value = await e.target.files[0].text(); this.applyInput(); } } catch (err) { this.message(err.message, true); } });
      $('save-system').addEventListener('click', () => this.download('system.json', JSON.stringify(this.system, null, 2), 'application/json'));
      $('export').addEventListener('click', () => this.download('results.csv', '\uFEFF' + this.csv(), 'text/csv'));
      $('play').addEventListener('click', () => { if (this.state.frame >= this.lastFrame()) this.seek(0); this.state.playing = !this.state.playing; this.updatePlayer(); });
      $('step').addEventListener('click', () => { this.pause(); this.seek(this.state.frame + 1); });
      $('start').addEventListener('click', () => { this.pause(); this.seek(0); });
      $('progress').addEventListener('input', () => { this.pause(); this.seek(Number($('progress').value)); });
      window.addEventListener('resize', () => { this.drawCharts(); this.drawFrame(); this.drawGallery(); });
      this.recalculate(); this.createGallery(); this.lastTick = 0;
      const tick = now => { if (this.state.playing && now - this.lastTick >= 160) { this.lastTick = now; this.seek(this.state.frame + 1); if (this.state.frame >= this.lastFrame()) this.pause(); } requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
    message(text, error = false) { $('status').textContent = text; $('status').className = error ? 'error' : ''; }
    applyInput() { try { const data = M.parseSystem($('input').value); this.state.custom = data; this.recalculate(); } catch (err) { this.message(err.message, true); } }
    recalculate() {
      try {
        const eps = Number($('eps').value), maxIter = Number($('limit').value);
        if (!$('eps').value.trim() || !Number.isFinite(eps) || eps < 1e-15 || eps > 1 || !Number.isSafeInteger(maxIter) || maxIter < 20000 || maxIter > 100000) throw new Error('Точність: 10⁻¹⁵…1; цілий ліміт: 20 000…100 000.');
        this.pause();
        this.system = this.state.custom || M.buildSystem(Number($('size').value), Number($('margin').value));
        const { A, b } = this.system; this.runs = {}; this.errors = {}; this.times = {};
        for (const method of Object.keys(names)) {
          try {
            const solve = record => method === 'gauss' ? M.gauss(A, b, { record }) : M.iterative(A, b, method, { eps, maxIter, record });
            const start = performance.now(); solve(false); this.times[method] = performance.now() - start;
            this.runs[method] = solve(true);
          } catch (err) { this.errors[method] = err.message; }
        }
        const dom = M.dominance(A), label = this.state.custom ? 'Власна система' : `Варіант 2 · n = ${A.length} · d = ${$('margin').value}`;
        const issues = Object.entries(this.errors).map(([m,e]) => `${names[m]}: ${e}`);
        for (const [m,r] of Object.entries(this.runs)) if (!r.converged) issues.push(`${names[m]}: ${r.reason}`);
        this.message(`${label} · ${dom.strict ? 'Строга діагональна перевага' : 'Діагональної переваги немає: збіжність не гарантована'}` + (issues.length ? ' · ' + issues.join(' ') : ''), issues.length > 0);
        $('input').value = JSON.stringify(this.system, null, 2); $('size-badge').textContent = `${A.length} невідомих`;
        this.renderTables(); this.drawCharts(); this.resetAnimation();
      } catch (err) { this.message(err.message, true); }
    }
    series(runs, exact) {
      const series = exact ? [{ name: 'Точний', points: exact.map((v,i) => [i+1,v]), color: '#26312b', width: 2.2 }] : [];
      for (const [method,r] of Object.entries(runs)) series.push({ name: names[method], color: colors[method], points: r.x.map((v,i) => [i+1,v]), dash: method === 'gauss' ? [5,3] : [], markers: method === 'jacobi' ? 3 : method === 'seidel' ? 1.8 : 0 });
      return series;
    }
    convergence(runs) { return ['jacobi','seidel'].filter(m => runs[m]).map(m => ({ name: names[m], color: colors[m], points: runs[m].residuals.map((r,i) => [i,r]) })); }
    drawCharts() {
      this.charts.convergence.draw(this.convergence(this.runs), { log: true, xLabel: 'Ітерація k', yLabel: '‖Ax − b‖₂' });
      this.charts.solution.draw(this.series(this.runs, this.system.exact));
    }
    row(target, values) { const row = document.createElement('tr'); for (const value of values) { const c = document.createElement('td'); c.textContent = value; row.append(c); } target.append(row); }
    renderTables() {
      $('metrics').replaceChildren(); $('components').replaceChildren();
      for (const method of Object.keys(names)) {
        const r = this.runs[method];
        this.row($('metrics'), r ? [names[method], method === 'gauss' ? '—' : r.iterations, fmt(r.residuals.at(-1)), this.system.exact ? fmt(M.errorInf(r.x,this.system.exact)) : '—', this.times[method].toFixed(4), r.reason] : [names[method],'—','—','—','—',this.errors[method]]);
      }
      for (let i=0;i<this.system.b.length;i++) this.row($('components'), [i+1,fmt(this.system.b[i]),fmt(this.system.exact?.[i]),...Object.keys(names).map(m=>fmt(this.runs[m]?.x[i]))]);
    }
    lastFrame() { return Math.max(0,(this.runs[this.state.method]?.frames.length || 1)-1); }
    pause() { this.state.playing=false; this.updatePlayer(); }
    updatePlayer() { $('play').textContent=this.state.playing ? 'Ⅱ Пауза' : '▶ Відтворити'; }
    resetAnimation() { this.pause(); $('progress').max=this.lastFrame(); this.seek(0); }
    seek(frame) { this.state.frame=Math.max(0,Math.min(frame,this.lastFrame())); $('progress').value=this.state.frame; this.drawFrame(); }
    drawFrame() {
      const { method,frame } = this.state, r=this.runs[method];
      $('frame-number').textContent=`${frame} / ${this.lastFrame()}`;
      $('animation-title').textContent=method==='gauss'?'Прямий хід Гаусса':`Наближення: ${names[method]}`;
      $('matrix-wrap').hidden=method!=='gauss';$('iteration').hidden=method==='gauss';
      for (const id of ['play','step','start','progress']) $(id).disabled=!r || !r.frames.length;
      if (!r || !r.frames.length) { $('frame-label').textContent=this.errors[method] || 'Немає кадрів'; $('matrix-wrap').replaceChildren(); if(method!=='gauss')this.charts.iteration.draw([]); return; }
      const value=r.frames[frame];
      if (method==='gauss') {
        $('frame-label').textContent=value.label+' · Зелена клітинка - головний елемент';
        const table=document.createElement('table');table.className='matrix-table';
        const head=document.createElement('tr');for(let j=0;j<=this.system.A.length;j++){const th=document.createElement('th');th.textContent=j===this.system.A.length?'b':`x${j+1}`;head.append(th);}table.append(head);
        value.matrix.forEach((row,i)=>{const tr=document.createElement('tr');row.forEach((v,j)=>{const td=document.createElement('td');td.textContent=Math.abs(v)<1e-12?'0':v.toPrecision(4);if(j===row.length-1)td.classList.add('rhs');if(i===value.row&&j===value.column)td.classList.add('pivot');tr.append(td);});table.append(tr);});
        $('matrix-wrap').replaceChildren(table);
      } else {
        $('frame-label').textContent=`Ітерація ${frame} · нев’язка ${fmt(r.residuals[frame])}`;
        const s=this.system.exact?[{name:'Точний',color:'#26312b',points:this.system.exact.map((v,i)=>[i+1,v]),dash:[5,3]}]:[];
        s.push({name:`${names[method]} · k=${frame}`,color:colors[method],points:value.map((v,i)=>[i+1,v]),markers:3});
        this.charts.iteration.draw(s);
      }
    }
    createGallery() {
      for(const n of [5,10,20]){
        const {A,b,exact}=M.buildSystem(n);const runs={gauss:M.gauss(A,b),jacobi:M.iterative(A,b,'jacobi'),seidel:M.iterative(A,b,'seidel')};
        for(const type of ['convergence','solution']){
          const card=document.createElement('article');card.className='panel';
          const head=document.createElement('div');head.className='panel-heading';head.innerHTML=`<div><p class="eyebrow">n = ${n} · d = 1</p><h2>${type==='convergence'?'Збіжність':'Компоненти розв’язку'}</h2></div>`;
          const canvas=document.createElement('canvas');canvas.id=`${type}-${n}`;canvas.setAttribute('aria-label',`${type}, n=${n}`);card.append(head,canvas);$('gallery').append(card);
          this.gallery.push({chart:new Chart(canvas),type,runs,exact});
        }
      }this.drawGallery();
    }
    drawGallery(){for(const g of this.gallery)g.chart.draw(g.type==='convergence'?this.convergence(g.runs):this.series(g.runs,g.exact),g.type==='convergence'?{log:true,xLabel:'Ітерація k',yLabel:'‖Ax − b‖₂'}:{});}
    csv(){const lines=[['method','iterations','residual_L2','error_Linf','time_ms','converged']];for(const [m,r]of Object.entries(this.runs))lines.push([m,r.iterations,r.residuals.at(-1),this.system.exact?M.errorInf(r.x,this.system.exact):'',this.times[m],r.converged]);return lines.map(r=>r.join(',')).join('\n');}
    download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }
  window.slarApp=new Application();
})();
