/* Числові методи. Спільний код для браузера та Node.js. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SlarMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  class SolverResult {
    constructor(x, iterations, residuals, frames = [], converged = true, reason = 'Точність досягнуто') {
      Object.assign(this, { x, iterations, residuals, frames, converged, reason });
    }
  }
  function validate(A, b) {
    if (!Array.isArray(A) || A.length < 2 || A.length > 50 || !Array.isArray(b) || b.length !== A.length ||
        A.some(row => !Array.isArray(row) || row.length !== A.length)) {
      throw new Error('Потрібна квадратна матриця 2…50 та вектор b тієї самої довжини.');
    }
    if (A.some(row => row.some(v => typeof v !== 'number' || !Number.isFinite(v))) ||
        b.some(v => typeof v !== 'number' || !Number.isFinite(v))) {
      throw new Error('Усі коефіцієнти мають бути скінченними числами.');
    }
  }
  const matVec = (A, x) => A.map(row => row.reduce((sum, a, j) => sum + a * x[j], 0));
  const norm2 = x => Math.hypot(...x);
  const residual = (A, x, b) => norm2(matVec(A, x).map((v, i) => v - b[i]));
  const errorInf = (x, exact) => Math.max(...x.map((v, i) => Math.abs(v - exact[i])));
  function buildSystem(n = 5, d = 1) {
    if (![5, 10, 20].includes(n) || !Number.isFinite(d) || d <= 0) throw new Error('n = 5, 10 або 20; d > 0.');
    const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 0 : 1 / Math.abs(i - j)));
    A.forEach((row, i) => { row[i] = row.reduce((sum, v) => sum + v, 0) + d; });
    const exact = Array.from({ length: n }, (_, i) => (i + 1) ** 2 / n);
    return { A, b: matVec(A, exact), exact };
  }
  function dominance(A) {
    const margins = A.map((row, i) => Math.abs(row[i]) - row.reduce((s, v, j) => s + (j !== i ? Math.abs(v) : 0), 0));
    const q = Math.max(...A.map((row, i) => row[i] === 0 ? Infinity : row.reduce((s, v, j) => s + (j !== i ? Math.abs(v) : 0), 0) / Math.abs(row[i])));
    return { strict: margins.every(v => v > 0), margins, q };
  }
  function gauss(A, b, { pivot = true, record = false } = {}) {
    validate(A, b);
    const n = A.length, M = A.map((row, i) => [...row, b[i]]), frames = [];
    const tolerance = 1e-14 * Math.max(...A.flat().map(Math.abs));
    const snapshot = (row, column, label) => {
      if (record) frames.push({ matrix: M.map(r => [...r]), row, column, label });
    };
    for (let k = 0; k < n; k++) {
      let p = k;
      if (pivot) for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
      if (Math.abs(M[p][k]) <= tolerance) throw new Error('Нульовий або чисельно малий головний елемент.');
      snapshot(p, k, `Стовпець ${k + 1}: вибрано головний елемент у рядку ${p + 1}`);
      [M[k], M[p]] = [M[p], M[k]];
      if (p !== k) snapshot(k, k, `Переставлено рядки ${k + 1} і ${p + 1}`);
      for (let i = k + 1; i < n; i++) {
        const factor = M[i][k] / M[k][k];
        M[i][k] = 0;
        for (let j = k + 1; j <= n; j++) M[i][j] -= factor * M[k][j];
        snapshot(k, k, `Рядок ${i + 1}: віднято ${factor.toPrecision(4)} × рядок ${k + 1}`);
      }
    }
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) sum += M[i][j] * x[j];
      x[i] = (M[i][n] - sum) / M[i][i];
    }
    if (!x.every(Number.isFinite)) throw new Error('Переповнення під час обчислення.');
    return new SolverResult(x, 0, [residual(A, x, b)], frames);
  }
  function iterative(A, b, method = 'jacobi', { eps = 1e-10, maxIter = 20000, record = false } = {}) {
    validate(A, b);
    if (!['jacobi', 'seidel'].includes(method) || !Number.isFinite(eps) || eps <= 0 || !Number.isSafeInteger(maxIter) || maxIter < 1) {
      throw new Error('Некоректна точність, метод або ліміт ітерацій.');
    }
    if (A.some((row, i) => row[i] === 0)) throw new Error('Нульовий діагональний елемент.');
    const n = b.length, x = Array(n).fill(0), history = [residual(A, x, b)];
    const frames = record ? [[...x]] : [];
    if (history[0] <= eps) return new SolverResult(x, 0, history, frames);
    for (let k = 1; k <= maxIter; k++) {
      const old = [...x];
      for (let i = 0; i < n; i++) {
        const source = method === 'jacobi' ? old : x;
        let sum = 0;
        for (let j = 0; j < n; j++) if (j !== i) sum += A[i][j] * source[j];
        x[i] = (b[i] - sum) / A[i][i];
      }
      const r = residual(A, x, b);
      history.push(r);
      if (record) frames.push([...x]);
      if (!Number.isFinite(r) || x.some(v => Math.abs(v) > 1e100)) return new SolverResult(x, k, history, frames, false, 'Розбіжність / переповнення');
      if (r <= eps) return new SolverResult(x, k, history, frames);
    }
    return new SolverResult(x, maxIter, history, frames, false, 'Досягнуто ліміт ітерацій');
  }
  function parseSystem(text) {
    if (!text.trim()) throw new Error('Введіть матрицю або JSON.');
    let data;
    if (text.trim().startsWith('{')) {
      try { data = JSON.parse(text); } catch { throw new Error('Некоректний JSON.'); }
    } else {
      const rows = text.trim().split(/\r?\n/).map((line, i) => {
        const tokens = line.trim().replace(/\|/g, ' ').split(/\s+/);
        if (tokens.some(v => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v))) throw new Error(`Некоректне число у рядку ${i + 1}.`);
        return tokens.map(Number);
      });
      data = { A: rows.map(r => r.slice(0, -1)), b: rows.map(r => r.at(-1)) };
    }
    validate(data.A, data.b);
    if (data.exact !== undefined && (!Array.isArray(data.exact) || data.exact.length !== data.A.length || !data.exact.every(v => typeof v === 'number' && Number.isFinite(v)))) {
      throw new Error('Поле exact має містити n скінченних чисел.');
    }
    return data;
  }
  return { SolverResult, validate, matVec, norm2, residual, errorInf, buildSystem, dominance, gauss, iterative, parseSystem };
});
