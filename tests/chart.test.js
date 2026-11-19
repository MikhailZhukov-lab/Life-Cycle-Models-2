'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {range}=require('../js/chart.js');
test('Автомасштаб містить min та max',()=>{const [a,b]=range([-10,2,30]);assert.ok(a < -10 && b > 30);});
test('Стала серія має ненульовий діапазон',()=>{const [a,b]=range([0,0]);assert.ok(a<0&&b>0);});
test('Логарифмічна шкала: нуль, NaN, Infinity',()=>{const bounds=range([0,1e-10,100,NaN,Infinity],true);assert.ok(bounds.every(Number.isFinite));assert.ok(bounds[0]<-300&&bounds[1]>2);});
test('Порожній графік має коректні межі',()=>{const [a,b]=range([]);assert.ok(Number.isFinite(a)&&b>a);});
test('Довга історія не переповнює стек аргументів',()=>{const [a,b]=range(Array.from({length:200002},(_,i)=>i));assert.ok(a<0&&b>200001);});
