import { runSimulation, summarizeSimulations } from './simulation-core.js';

const args = process.argv.slice(2);
const runsIndex = args.indexOf('--runs');
const runs = runsIndex >= 0 ? Math.max(1, Number(args[runsIndex + 1]) || 1000) : 1000;
const profiles = ['balanced', 'aggressive', 'funding', 'rest'];

for (const profile of profiles) {
  const results = Array.from({ length: runs }, (_, index) => runSimulation(index + 1, profile));
  console.log(`\n[${profile}]`);
  console.log(JSON.stringify(summarizeSimulations(results), null, 2));
}
