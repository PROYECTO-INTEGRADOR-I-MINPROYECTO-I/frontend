// Lee el resumen que genera scripts/pass-rate-reporter.mjs y falla si el
// porcentaje de tests que pasan queda por debajo del umbral
// (TEST_PASS_THRESHOLD, 80 por defecto).
//
// Uso: node scripts/check-test-pass-rate.mjs [ruta-al-resumen.json]
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const summaryPath = process.argv[2] ?? "test-summary.json";
const threshold = Number(process.env.TEST_PASS_THRESHOLD ?? 80);

function report(message, ok) {
  const line = `${ok ? "✅" : "❌"} ${message}`;
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Tests\n\n${line}\n`);
  }
  if (ok) {
    console.log(line);
  } else {
    console.error(line);
    process.exit(1);
  }
}

if (!existsSync(summaryPath)) {
  report(`No se encontró ${summaryPath}: Vitest no llegó a terminar.`, false);
}

const { passed, failed, structuralErrors } = JSON.parse(
  readFileSync(summaryPath, "utf8"),
);

// Un archivo que no carga o un hook roto hace que sus tests no se ejecuten
// y desaparezcan del conteo, así que se trata siempre como fallo.
if (structuralErrors.length > 0) {
  const list = structuralErrors.map((error) => `- ${error}`).join("\n");
  report(`Errores fuera de los tests (archivo o hook roto):\n\n${list}`, false);
}

const executed = passed + failed; // los tests skip/todo no cuentan
if (executed === 0) {
  report("No se ejecutó ningún test.", false);
}

const passRate = (passed / executed) * 100;
report(
  `${passed}/${executed} tests pasaron (${passRate.toFixed(1)}%). ` +
    `Mínimo requerido: ${threshold}%.`,
  passRate >= threshold,
);
