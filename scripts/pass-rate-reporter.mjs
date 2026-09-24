// Reporter de Vitest que guarda en test-summary.json lo que necesita
// scripts/check-test-pass-rate.mjs: cuántos tests pasaron/fallaron y los
// errores "estructurales" (archivo que no carga, hook beforeAll/beforeEach
// roto, errores no controlados). El reporter JSON de Vitest no sirve para
// esto: marca igual un test.skip y un test que no corrió por un hook roto.
import { rmSync, writeFileSync } from "node:fs";

const OUTPUT_FILE = "test-summary.json";

export default class PassRateReporter {
  // Borra el resumen de una corrida anterior para no leer datos viejos
  // si esta corrida se cae antes de terminar.
  onInit() {
    rmSync(OUTPUT_FILE, { force: true });
  }

  onTestRunEnd(testModules, unhandledErrors) {
    const counts = { passed: 0, failed: 0, skipped: 0 };
    const structuralErrors = unhandledErrors.map(
      (error) => `Error no controlado: ${error.message}`,
    );

    for (const testModule of testModules) {
      const file = testModule.moduleId;
      const suites = [testModule, ...testModule.children.allSuites()];
      for (const suite of suites) {
        for (const error of suite.errors()) {
          const where = suite === testModule ? file : `${file} > ${suite.fullName}`;
          structuralErrors.push(`${where}: ${error.message}`);
        }
      }
      for (const test of testModule.children.allTests()) {
        const { state } = test.result();
        if (state in counts) counts[state] += 1;
      }
    }

    writeFileSync(
      OUTPUT_FILE,
      JSON.stringify({ ...counts, structuralErrors }, null, 2),
    );
  }
}
