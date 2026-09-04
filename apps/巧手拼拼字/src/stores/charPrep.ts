import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { inspectChar, issueLabel, type CharIssue } from '@/lib/charIssues';
import { loadChar, prefetchChars } from '@/lib/charData';

export const useCharPrep = defineStore('charPrep', () => {
  const running = ref(false);
  const done = ref(0);
  const total = ref(0);
  const issues = ref<CharIssue[]>([]);
  const lastChars = ref<string[]>([]);

  const progressText = computed(() => {
    if (!running.value || total.value <= 0) return '';
    return `正在認字 ${done.value}／${total.value}…`;
  });

  let runId = 0;

  async function reinspect(chars: string[]): Promise<void> {
    const found: CharIssue[] = [];
    for (const ch of chars) {
      const data = await loadChar(ch);
      if (!data) {
        found.push({ char: ch, kind: 'missing', detail: '找不到筆順資料' });
        continue;
      }
      const issue = inspectChar(data);
      if (issue) found.push(issue);
    }
    issues.value = found;
  }

  async function prepare(chars: string[]): Promise<void> {
    const unique = [...new Set(chars.filter((c) => c.length === 1))];
    const my = (runId += 1);
    lastChars.value = unique;
    running.value = true;
    done.value = 0;
    total.value = unique.length;
    try {
      await prefetchChars(unique, (d, t) => {
        if (my === runId) {
          done.value = d;
          total.value = t;
        }
      });
      if (my !== runId) return;
      await reinspect(unique);
    } finally {
      if (my === runId) running.value = false;
    }
  }

  async function refreshIssues(): Promise<void> {
    if (!lastChars.value.length) return;
    await reinspect(lastChars.value);
  }

  function reset() {
    issues.value = [];
    lastChars.value = [];
    running.value = false;
    done.value = 0;
    total.value = 0;
  }

  return { running, done, total, issues, progressText, prepare, refreshIssues, reset, issueLabel };
});
