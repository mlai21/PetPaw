export type AdvisorTool = {
  name: 'tavily-search';
  description: string;
  requiredEnv: 'TAVILY_API_KEY';
  inputSchema: {
    query: 'string';
    maxResults: 'number';
  };
};

export const toolRegistryFile =
  'services/api/src/modules/advisor/agent_loop/tool.registry.ts';

export const advisorToolRegistry: AdvisorTool[] = [
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
