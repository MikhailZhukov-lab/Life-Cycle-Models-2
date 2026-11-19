// Вимірювання виконуються тим самим модулем, який підключено до index.html.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const M = require('../js/math.js');
const out = path.join(__dirname, '..', 'results');
fs.mkdirSync(out, { recursive: true });
const metrics = [], runs = {};
for (const n of [5, 10, 20]) for (const d of [1, 0.1]) {
  const { A, b, exact } = M.buildSystem(n, d);
  runs[`${n}_${d}`] = {};
  for (const method of ['gauss', 'jacobi', 'seidel']) {
    const run = () => method === 'gauss' ? M.gauss(A, b) : M.iterative(A, b, method);
    for (let i = 0; i < 3; i++) run(); // Прогрів JIT перед вимірюванням.
    const times = [];
    let result;
    for (let i = 0; i < 7; i++) {
      const start = performance.now(); result = run(); times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const row = { n, d, method, iterations: result.iterations, residual: M.residual(A, result.x, b), error: M.errorInf(result.x, exact), time_ms: times[3], converged: result.converged };
    metrics.push(row); runs[`${n}_${d}`][method] = { x: result.x, residuals: result.residuals };
  }
}
const system = M.buildSystem(5, 1);
system.A[0][0] = 0; system.b = M.matVec(system.A, system.exact);
let failure;
try { M.gauss(system.A, system.b, { pivot: false }); } catch (e) { failure = e.message; }
const fixed = M.gauss(system.A, system.b);
const critical = { no_pivot: failure, pivot_x: fixed.x, pivot_error: M.errorInf(fixed.x, system.exact), pivot_residual: M.residual(system.A, fixed.x, system.b) };
const systems = Object.fromEntries([5,10,20].flatMap(n=>[1,.1].map(d=>[`${n}_${d}`,M.buildSystem(n,d)])));
for (const [file, data] of Object.entries({ metrics, runs, critical, systems, example_system: system, environment: { node: process.version, platform: process.platform, arch: process.arch, repeats: 7, warmup: 3, eps: 1e-10, maxIter: 20000 } })) {
  fs.writeFileSync(path.join(out, file + '.json'), JSON.stringify(data, null, 2));
}
const columns = Object.keys(metrics[0]);
fs.writeFileSync(path.join(out, 'metrics.csv'), '\uFEFF' + [columns.join(','), ...metrics.map(r => columns.map(k => r[k]).join(','))].join('\n'));
console.table(metrics); console.log(critical);
