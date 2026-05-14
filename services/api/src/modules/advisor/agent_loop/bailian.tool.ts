type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

function joinChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${trimmed}/chat/completions`;
}

function extractJsonArray(text: string): unknown[] | null {
  const trimmed = text.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      // fallback below
    }
  }
  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start >= 0 && end > start) {
    const candidate = trimmed.slice(start, end + 1);
    try {
      const parsed = JSON.parse(candidate);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function runBailianSearch(params: {
  query: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  maxResults?: number;
}): Promise<string> {
  const baseUrl =
    params.baseUrl?.trim() || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const model = params.model?.trim() || 'qwen3.5-flash';
  const maxResults = Math.min(Math.max(params.maxResults ?? 3, 1), 8);
  const res = await fetch(joinChatCompletionsUrl(baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      enable_search: true,
      extra_body: {
        enable_search: true,
      },
      messages: [
        {
          role: 'system',
          content:
            '你是联网检索助手。只输出 JSON 数组，每项包含 title/url/content 三个字段。',
        },
        {
          role: 'user',
          content: `请围绕问题联网检索，返回最多 ${maxResults} 条结果。\n问题：${params.query}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`bailian_http_${res.status}:${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as ChatCompletionResponse;
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    return 'no-search-results';
  }

  const array = extractJsonArray(raw);
  if (!array) {
    return raw.slice(0, 800);
  }
  const lines = array
    .slice(0, maxResults)
    .map((item, idx) => {
      const value =
        item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const title =
        typeof value.title === 'string' && value.title.trim()
          ? value.title.trim()
          : `result-${idx + 1}`;
      const url =
        typeof value.url === 'string' && value.url.trim()
          ? value.url.trim()
          : 'unknown-url';
      const content =
        typeof value.content === 'string' && value.content.trim()
          ? value.content.trim().slice(0, 320)
          : 'no-content';
      return `${idx + 1}. ${title}\n${url}\n${content}`;
    })
    .filter(Boolean);

  if (lines.length === 0) {
    return 'no-search-results';
  }
  return lines.join('\n\n');
}
