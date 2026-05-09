export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export function round7(v: number): number {
  return Math.round(v * 1e7) / 1e7;
}
