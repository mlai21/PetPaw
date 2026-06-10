export type V6Sample = {
  keywordCategory: string | null;
  messageLengthBucket: 'short' | 'medium' | 'long';
  verifyChangedOutput: boolean; // verify 是否改写了草稿
};

export type V6Policy = {
  scope: 'shouldSkipVerify';
  conditions: { keyword_category: string; message_length_bucket: string };
  actions: { skip_verify: boolean };
};

const MIN_SAMPLES_PER_GROUP = 20;
const REWRITE_THRESHOLD = 0.05;

export function learnV6VerifySkip(samples: V6Sample[]): V6Policy[] {
  const groups = new Map<string, V6Sample[]>();
  for (const s of samples) {
    if (!s.keywordCategory) continue;
    const key = `${s.keywordCategory}::${s.messageLengthBucket}`;
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }

  const policies: V6Policy[] = [];
  for (const [key, list] of groups.entries()) {
    if (list.length < MIN_SAMPLES_PER_GROUP) continue;
    const [category, bucket] = key.split('::');
    const rewriteRate = list.filter((s) => s.verifyChangedOutput).length / list.length;
    if (rewriteRate < REWRITE_THRESHOLD) {
      policies.push({
        scope: 'shouldSkipVerify',
        conditions: { keyword_category: category, message_length_bucket: bucket },
        actions: { skip_verify: true },
      });
    }
  }
  return policies;
}
