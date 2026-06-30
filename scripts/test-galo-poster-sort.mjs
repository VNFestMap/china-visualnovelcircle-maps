import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const poster = readFileSync(new URL('../Galgame_events/galo_poster.html', import.meta.url), 'utf8');
const api = readFileSync(new URL('../api/galonly.php', import.meta.url), 'utf8');
const submit = readFileSync(new URL('../Galgame_events/Shanghai_GalOnly_submit.html', import.meta.url), 'utf8');

assert.match(
  api,
  /SELECT id, booth_name, is_joint, joint_name, notes, image_path, display_image, created_at/,
  'participant API must expose submission time'
);
assert.match(
  poster,
  /Number\(b\.vote_count \|\| 0\) - Number\(a\.vote_count \|\| 0\)/,
  'poster must sort vote counts descending'
);
assert.match(
  poster,
  /submittedA < submittedB \? -1 : 1/,
  'equal-vote participants must sort by submission time ascending'
);
assert.match(
  poster,
  /\.slice\(\)\.sort\(compareParticipants\)/,
  'participants must be sorted before initial render'
);
assert.match(
  poster,
  /sortRenderedBooths\(\);/,
  'a successful vote must re-sort rendered cards'
);
assert.match(
  api,
  /display_thumbnail.*galonlyPosterThumbnailPath/s,
  'participant API must prefer generated poster thumbnails'
);
assert.match(
  poster,
  /app\.display_thumbnail \|\| app\.display_image/,
  'poster cards must use thumbnails before original uploads'
);
assert.match(
  poster,
  /fetchpriority="high"/,
  'first-row poster images must load with high priority'
);
assert.match(
  submit,
  /image\/webp', 0\.82/,
  'new display images must be encoded as compressed WebP'
);

console.log('galo poster sort contract: ok');
