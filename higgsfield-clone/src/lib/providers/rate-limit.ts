// Kostenbremse für kostenpflichtige Anbieter: maximal N Bilder pro Stunde (Zähler im Speicher,
// wird beim Neustart des Servers zurückgesetzt).
export function createLimiter(envName: string, defaultMax: number) {
  const recent: number[] = [];
  return function check() {
    const max = Number(process.env[envName]) || defaultMax;
    const cutoff = Date.now() - 3_600_000;
    while (recent.length && recent[0] < cutoff) recent.shift();
    if (recent.length >= max) throw new Error(`Limit von ${max} Bildern pro Stunde erreicht (${envName})`);
    recent.push(Date.now());
  };
}
