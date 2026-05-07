export function parseLapTimeMs(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("empty lap time");
  const parts = trimmed.split(":");
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => Number.isNaN(n))) {
    throw new Error(`unrecognized lap time format: ${input}`);
  }
  if (nums.length === 1) return Math.round(nums[0]! * 1000);
  if (nums.length === 2) return Math.round((nums[0]! * 60 + nums[1]!) * 1000);
  if (nums.length === 3) {
    return Math.round((nums[0]! * 3600 + nums[1]! * 60 + nums[2]!) * 1000);
  }
  throw new Error(`unrecognized lap time format: ${input}`);
}

export function formatLapTime(ms: number): string {
  if (ms < 0) throw new Error("negative duration");
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  if (minutes === 0) return seconds.toFixed(3);
  return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
}
