'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/math.js');
for (const method of ['gauss', 'jacobi', 'seidel']) for (const n of [5, 10, 20]) for (const d of [1, 0.1]) {
  test(`${method}: n=${n}, d=${d}`, () => {
    const { A, b, exact } = M.buildSystem(n, d);
    const r = method === 'gauss' ? M.gauss(A, b) : M.iterative(A, b, method);
    assert.ok(r.converged); assert.ok(M.errorInf(r.x, exact) < 1e-9);
    assert.ok(r.residuals.at(-1) <= 1e-10);
  });
}
test('Формули варіанта та індекси від 1', () => {
  const { A, b, exact } = M.buildSystem(5);
  assert.deepEqual(exact, [.2, .8, 1.8, 3.2, 5]);
  assert.ok(Math.abs(A[0][0] - 37 / 12) < 1e-14);
  assert.ok(Math.abs(b[0] - 139 / 30) < 1e-14);
  assert.equal(A[0][4], 1 / 4);
});
test('Нульовий головний елемент: без вибору помилка, з вибором розв’язок', () => {
  assert.throws(() => M.gauss([[0, 1], [2, 3]], [2, 8], { pivot: false }));
  assert.deepEqual(M.gauss([[0, 1], [2, 3]], [2, 8]).x, [1, 2]);
});
test('Вибір головного елемента за модулем', () => assert.deepEqual(M.gauss([[0, 1], [-2, 3]], [2, 4]).x, [1, 2]));
test('Вироджена матриця', () => assert.throws(() => M.gauss([[1, 2], [2, 4]], [3, 6])));
test('Перший крок Якобі та Зейделя різний', () => {
  assert.deepEqual(M.iterative([[4, 1], [2, 3]], [1, 2], 'jacobi', { maxIter: 1 }).x, [.25, 2 / 3]);
  assert.deepEqual(M.iterative([[4, 1], [2, 3]], [1, 2], 'seidel', { maxIter: 1 }).x, [.25, .5]);
});
test('Перевірка строгої переваги', () => {
  assert.ok(M.dominance(M.buildSystem(20, .1).A).strict);
  assert.equal(M.dominance([[1, 2], [2, 1]]).strict, false);
  assert.equal(M.dominance([[1, 1], [1, 1]]).strict, false);
});
test('Ліміт повертає converged=false', () => {
  const { A, b } = M.buildSystem(); assert.equal(M.iterative(A, b, 'jacobi', { maxIter: 1 }).converged, false);
});
test('Нульова діагональ у двох ітераційних методах', () => {
  for (const method of ['jacobi', 'seidel']) assert.throws(() => M.iterative([[0, 1], [2, 3]], [2, 8], method));
});
test('Форма, NaN та нечислові значення', () => {
  for (const A of [[[1, 2], [3]], [[NaN, 1], [1, 2]], [['1', 2], [3, 4]]]) assert.throws(() => M.validate(A, [1, 2]));
});
test('Некоректні параметри', () => {
  for (const opts of [{ eps: 0 }, { eps: NaN }, { maxIter: 0 }, { maxIter: 1.5 }]) assert.throws(() => M.iterative([[4, 1], [1, 4]], [1, 1], 'jacobi', opts));
  assert.throws(() => M.buildSystem(7)); assert.throws(() => M.buildSystem(5, 0));
});
test('Нульова права частина: нуль ітерацій', () => assert.equal(M.iterative([[4, 1], [1, 4]], [0, 0]).iterations, 0));
test('Малий масштаб не дорівнює виродженості', () => assert.deepEqual(M.gauss([[1e-20, 0], [0, 1e-20]], [1e-20, 2e-20]).x, [1, 2]));
test('Розбіжність завершується контрольовано', () => assert.equal(M.iterative([[1, 2], [2, 1]], [1, 1], 'jacobi', { maxIter: 400 }).converged, false));
test('JSON та розширена матриця', () => {
  assert.deepEqual(M.parseSystem('4 1 | 1\n2 3 | 2'), { A: [[4, 1], [2, 3]], b: [1, 2] });
  assert.deepEqual(M.parseSystem('{"A":[[4,1],[2,3]],"b":[1,2]}').b, [1, 2]);
});
test('Порожній, пошкоджений ввід та exact', () => {
  for (const text of ['', '4 x 1\n2 3 2', '{bad}', '{"A":[[4,1],[2,3]],"b":[1,2],"exact":[1]}', '{"A":[[4,null],[2,3]],"b":[1,2]}']) assert.throws(() => M.parseSystem(text));
});
test('Вхідні дані не змінюються, кадри є окремими копіями', () => {
  const { A, b } = M.buildSystem(); const before = JSON.stringify({ A, b });
  const g = M.gauss(A, b, { record: true });
  const j = M.iterative(A, b, 'jacobi', { record: true });
  assert.equal(JSON.stringify({ A, b }), before);
  assert.notDeepEqual(g.frames[0].matrix, g.frames.at(-1).matrix);
  assert.equal(j.frames.length, j.iterations + 1);
  assert.notStrictEqual(j.frames[0], j.frames[1]);
});
