type XPost = {
  id?: string;
  text?: string;
  author_id?: string;
  created_at?: string;
};

type XUser = {
  id?: string;
  username?: string;
  name?: string;
};

type XRecentSearchResponse = {
  data?: XPost[];
  includes?: {
    users?: XUser[];
  };
};

function buildPostUrl(postId: string, username: string): string {
  return `https://x.com/${username}/status/${postId}`;
}

export async function runXSearch(params: {
  query: string;
  bearerToken: string;
  maxResults?: number;
}): Promise<string> {
  const maxResults = Math.min(Math.max(params.maxResults ?? 5, 10), 100);
  const url = new URL('https://api.x.com/2/tweets/search/recent');
  url.searchParams.set('query', params.query);
  url.searchParams.set('max_results', String(maxResults));
  url.searchParams.set('tweet.fields', 'created_at,author_id,lang');
  url.searchParams.set('expansions', 'author_id');
  url.searchParams.set('user.fields', 'username,name');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${params.bearerToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`x_http_${response.status}:${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as XRecentSearchResponse;
  const posts = data.data ?? [];
  const users = new Map<string, XUser>();
  for (const user of data.includes?.users ?? []) {
    if (user.id) {
      users.set(user.id, user);
    }
  }

  const top = posts.slice(0, 5).map((post, idx) => {
    const author = (post.author_id && users.get(post.author_id)) || undefined;
    const username = author?.username?.trim() || 'unknown';
    const postId = post.id?.trim() || `unknown-${idx + 1}`;
    const title = `Post by @${username}`;
    const url = buildPostUrl(postId, username);
    const content = post.text?.trim()?.slice(0, 320) || 'no-content';
    return `${idx + 1}. ${title}\n${url}\n${content}`;
  });

  if (top.length === 0) {
    return 'no-search-results';
  }
  return top.join('\n\n');
}
