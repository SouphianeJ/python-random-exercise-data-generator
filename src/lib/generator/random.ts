export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next() {
    this.state += 0x6d2b79f5;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min: number, max: number, digits = 2) {
    const value = min + (max - min) * this.next();
    return Number(value.toFixed(digits));
  }

  chance(probability: number) {
    return this.next() < probability;
  }

  choice<T>(items: readonly T[]) {
    return items[this.int(0, items.length - 1)];
  }

  weightedChoice<T>(items: readonly T[], weights: number[]) {
    const total = weights.reduce((sum, value) => sum + value, 0);
    const target = this.next() * total;
    let cursor = 0;
    for (let index = 0; index < items.length; index += 1) {
      cursor += weights[index] ?? 0;
      if (target <= cursor) {
        return items[index];
      }
    }
    return items[items.length - 1];
  }

  sampleUnique<T>(items: readonly T[], count: number) {
    const copy = [...items];
    const result: T[] = [];
    while (copy.length > 0 && result.length < count) {
      const index = this.int(0, copy.length - 1);
      result.push(copy[index]);
      copy.splice(index, 1);
    }
    return result;
  }

  normal(mean: number, deviation: number) {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + z * deviation;
  }
}
