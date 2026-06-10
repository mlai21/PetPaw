import { performance } from 'node:perf_hooks';
import { AdvisorService } from '../src/modules/advisor/advisor.service';

const messages = [
  '你好',
  '帮我把今天的任务拆成可执行的下一步',
  '宝可梦新作发售时间',
  '最新天气如何',
];

async function run(label: string, iterations = 5): Promise<void> {
  const svc = new AdvisorService();
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    for (const m of messages) {
      const start = performance.now();
      try {
        await svc.chat({ userId: 'perf', message: m, allowSearch: true });
      } catch {
        // perf 统计忽略单次错误
      }
      samples.push(performance.now() - start);
    }
  }
  samples.sort((a, b) => a - b);
  const p50 = samples[Math.floor(samples.length * 0.5)];
  const p95 = samples[Math.floor(samples.length * 0.95)];
  console.log(
    `[perf:${label}] samples=${samples.length} p50=${p50.toFixed(0)}ms p95=${p95.toFixed(0)}ms`,
  );
}

async function main(): Promise<void> {
  console.log('Baseline (RUNTIME disabled):');
  delete process.env.ADVISOR_RUNTIME_ENABLED;
  await run('baseline');
  console.log('\nE.1 (RUNTIME enabled):');
  process.env.ADVISOR_RUNTIME_ENABLED = 'true';
  await run('e1');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
