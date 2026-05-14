export type AdvisorTool = {
  name: 'bailian-search' | 'x-search' | 'tavily-search';
  description: string;
  requiredEnv: 'DASHSCOPE_API_KEY' | 'X_BEARER_TOKEN' | 'TAVILY_API_KEY';
  inputSchema: {
    query: 'string';
    maxResults: 'number';
  };
};

export const toolRegistryFile =
  'services/api/src/modules/advisor/agent_loop/tool.registry.ts';

export const advisorToolRegistry: AdvisorTool[] = [
  {
    name: 'bailian-search',
    description:
      'Search with Alibaba Bailian (DashScope compatible chat + enable_search).',
    requiredEnv: 'DASHSCOPE_API_KEY',
    inputSchema: {
      query: 'string',
      maxResults: 'number',
    },
  },
  {
    name: 'x-search',
    description: 'Search recent posts via X API v2.',
    requiredEnv: 'X_BEARER_TOKEN',
    inputSchema: {
      query: 'string',
      maxResults: 'number',
    },
  },
  {
    name: 'tavily-search',
    description: 'Search fresh web information via Tavily API.',
    requiredEnv: 'TAVILY_API_KEY',
    inputSchema: {
      query: 'string',
      maxResults: 'number',
    },
  },
];
