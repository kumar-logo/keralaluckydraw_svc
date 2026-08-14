function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface RaceItem {
  point: number;
  speedModulus: number;
}

interface RaceFrameEntry {
  speed: number;
  point: number;
  speedStatus: number;
}

interface RunnerFrameData {
  items: RaceItem[];
  frameData: RaceFrameEntry[];
  endFrame: number;
  endSec: number;
  rank: number;
  number: number;
}

export function generateRaceResult(runnerCount = 6): {
  positions: number[];
  drawResult: string;
  champion: number;
  second: number;
  third: number;
  top3: string;
  runnerCount: number;
} {
  const runners = Array.from({ length: runnerCount }, (_, i) => i + 1);
  const positions = shuffleArray(runners);
  const drawResult = positions.join(',');

  return {
    positions,
    drawResult,
    champion: positions[0],
    second: positions[1],
    third: positions[2],
    top3: `${positions[0]},${positions[1]},${positions[2]}`,
    runnerCount,
  };
}

export function generateRaceFrames(positions: number[]): RunnerFrameData[] {
  const runnerCount = positions.length;
  const FPS = 30;
  const finishLine = 1100 + Math.random() * 120;
  const winnerTargetFrame = 390 + Math.floor(Math.random() * 15);

  const runners: RunnerFrameData[] = [];

  for (let runnerNum = 1; runnerNum <= runnerCount; runnerNum++) {
    const rank = positions.indexOf(runnerNum) + 1;
    const frameGap = rank === 1 ? 0 : (rank - 1) * (3 + Math.random() * 5);
    const targetEndFrame = Math.round(winnerTargetFrame + frameGap);

    const itemCount = Math.random() < 0.4 ? 2 : 1;
    const items: RaceItem[] = [];
    for (let i = 0; i < itemCount; i++) {
      const pt = Math.round(200 + Math.random() * 700);
      let mod = 0.65 + Math.random() * 0.7;
      if (mod > 0.95 && mod < 1.05) mod = mod < 1 ? 0.9 : 1.1;
      items.push({ point: pt, speedModulus: round2(mod) });
    }
    items.sort((a, b) => a.point - b.point);

    let weightedDist = 0;
    let prevPt = 0;
    let prevMod = 1;
    for (const item of items) {
      if (item.point < finishLine) {
        weightedDist += (item.point - prevPt) / prevMod;
        prevPt = item.point;
        prevMod = item.speedModulus;
      }
    }
    weightedDist += (finishLine - prevPt) / prevMod;

    const baseSpeed = (FPS * weightedDist) / targetEndFrame;

    let speed = baseSpeed;
    let point = 0;
    let speedStatus = 0;
    let itemIdx = 0;
    const frameData: RaceFrameEntry[] = [];
    let endFrame = -1;

    for (let f = 0; f < 600; f++) {
      frameData.push({
        speed: round2(speed),
        point: round2(point),
        speedStatus,
      });

      if (point >= finishLine) {
        endFrame = f;
        break;
      }

      point += speed / FPS;

      while (itemIdx < items.length && point >= items[itemIdx].point) {
        const mod = items[itemIdx].speedModulus;
        speed = baseSpeed * mod;
        speedStatus = mod > 1 ? 1 : mod < 1 ? -1 : 0;
        itemIdx++;
      }
    }

    if (endFrame === -1) endFrame = frameData.length - 1;

    runners.push({
      items,
      frameData,
      endFrame,
      endSec: round2(endFrame / FPS),
      rank,
      number: runnerNum,
    });
  }

  return runners;
}
