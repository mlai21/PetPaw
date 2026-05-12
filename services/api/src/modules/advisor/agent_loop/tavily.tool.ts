type TavilySearchResult = {
  title?: string;
  url?: string;
  content?: string;
};

type TavilyResponse = {
  results?: TavilySearchResult[];
};

export async function runTavilySearch(params: {
  query: string;
  apiKey: string;
  maxResults?: number;
}): Promise<string> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: params.apiKey,
      query: params.query,
      max_results: params.maxResults ?? 3,
      search_depth: 'basic',
      include_answer: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`tavily_http_${response.status}:${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as TavilyResponse;
  const top = (data.results ?? [])
    .slice(0, params.maxResults ?? 3)
    .map((item, idx) => {
      const title = item.title?.trim() || `result-${idx + 1}`;
      const url = item.url?.trim() || 'unknown-url';
      const content = item.content?.trim()?.slice(0, 220) || 'no-content';
      return `${idx + 1}. ${title}\n${url}\n${content}`;
    });

  if (top.length === 0) {
    return 'no-search-results';
  }
  return top.join('\n\n');
}
