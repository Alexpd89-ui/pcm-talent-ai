import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?<attributes>[^>]*)>(?<code>[\s\S]*?)<\/script>/gi)];

if (scripts.length === 0) {
  throw new Error('Nenhum script foi encontrado no index.html.');
}

for (const [index, script] of scripts.entries()) {
  if (/\bsrc\s*=/.test(script.groups.attributes)) continue;

  const codeWithoutImports = script.groups.code.replace(/^\s*import\s+.*?;\s*$/gm, '');
  new vm.Script(codeWithoutImports, { filename: `index.html#script-${index + 1}` });
}

const forbiddenPatterns = [
  ['autocadastro Firebase', /createUserWithEmailAndPassword/],
  ['regra Firestore aberta no HTML', /allow\s+read\s*,\s*write\s*:\s*if\s+(true|request\.time)/],
];

for (const [label, pattern] of forbiddenPatterns) {
  if (pattern.test(html)) throw new Error(`Padrão inseguro encontrado: ${label}.`);
}

console.log(`HTML válido: ${scripts.length} blocos de script verificados.`);
