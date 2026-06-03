#!/usr/bin/env node
/**
 * Patch idempotente para o expo-modules-jsi (SDK 56) compilar com o Xcode 26.
 *
 * O Swift 6 do Xcode 26:
 *   - rejeita `weak let`        -> exige `weak var`
 *   - rejeita `weak var` mutavel em classe `Sendable` -> exige `nonisolated(unsafe)`
 *
 * O expo-modules-jsi@56.0.x ainda usa `weak let`, entao o build nativo falha
 * (xcodebuild error 65). Este script reescreve as declaracoes afetadas para
 *   `nonisolated(unsafe) [modificador] weak var ...`
 * — exatamente o padrao que o proprio Expo usa para o campo `pointee`.
 *
 * Roda no `postinstall` (cwd = apps/mobile). E idempotente: se ja estiver
 * aplicado, nao faz nada. Remover quando o Expo publicar um expo-modules-jsi
 * compativel com o Xcode 26 (ate la, manter).
 */
const fs = require('fs');
const path = require('path');

function findModuleRoot() {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'expo-modules-jsi'),
    path.join(__dirname, '..', '..', '..', 'node_modules', 'expo-modules-jsi'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith('.swift')) acc.push(full);
  }
  return acc;
}

const moduleRoot = findModuleRoot();
if (!moduleRoot) {
  // Sem o modulo instalado ainda — nada a fazer (ex.: install parcial).
  process.exit(0);
}

const sourcesDir = path.join(moduleRoot, 'apple', 'Sources', 'ExpoModulesJSI');
if (!fs.existsSync(sourcesDir)) process.exit(0);

let patchedFiles = 0;
for (const file of walk(sourcesDir)) {
  const original = fs.readFileSync(file, 'utf8');
  const out = original
    .split('\n')
    .map((line) => {
      // Ja patchado nesta linha.
      if (line.includes('nonisolated(unsafe)') && /weak\s+var/.test(line)) return line;
      // weak let -> weak var ; e prefixa nonisolated(unsafe).
      const m = line.match(/^(\s*)((?:private |internal |public |fileprivate )?)weak (?:let|var) (.*)$/);
      if (!m) return line;
      return `${m[1]}nonisolated(unsafe) ${m[2]}weak var ${m[3]}`;
    })
    .join('\n');
  if (out !== original) {
    fs.writeFileSync(file, out);
    patchedFiles++;
  }
}

if (patchedFiles > 0) {
  console.log(`[patch-expo-modules-jsi] Xcode 26 fix aplicado em ${patchedFiles} arquivo(s).`);
}
