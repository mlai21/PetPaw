type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

function isDashscopeBaseUrl(baseUrl: string): boolean {
  const normalized = baseUrl.toLowerCase();
  return (
    normalized.includes('dashscope') ||
    normalized.includes('aliyuncs.com/compatible-mode')
  );
}

function joinChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${trimmed}/chat/completions`;
}

export async function completeChatCompletions(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  enableThinking?: boolean;
}): Promise<string> {
  const payload: Record<string, unknown> = {
    model: params.model,
    temperature: 0.6,
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user },
    ],
  };
  if (isDashscopeBaseUrl(params.baseUrl) && params.enableThinking === false) {
    payload.enable_thinking = false;
    payload.extra_body = {
      enable_thinking: false,
    };
  }
  const res = await fetch(joinChatCompletionsUrl(params.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`chat_http_${res.status}:${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('chat_empty_content');
  }
  return content;
}
