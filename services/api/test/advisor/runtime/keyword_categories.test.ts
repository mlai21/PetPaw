import { classifyKeywords } from '../../../src/modules/advisor/runtime/keyword_categories';

describe('classifyKeywords', () => {
  it('returns null for empty / non-matching text', () => {
    expect(classifyKeywords('')).toBeNull();
    expect(classifyKeywords('随便聊一聊')).toBeNull();
  });

  it('returns weather for 天气 / 下雨', () => {
    expect(classifyKeywords('明天上海会下雨吗')).toBe('weather');
    expect(classifyKeywords('北京今天的天气怎么样')).toBe('weather');
  });

  it('returns current_affairs for 时事关键词', () => {
    expect(classifyKeywords('习近平今天访华了吗')).toBe('current_affairs');
  });

  it('returns tech for 科技/编程关键词', () => {
    expect(classifyKeywords('react 18 的新特性')).toBe('tech');
  });

  it('picks the category with the highest cumulative weight on conflict', () => {
    // "搜索" 在 explicit_search 的 weight 高
    expect(classifyKeywords('帮我搜索一下天气')).toBe('explicit_search');
  });
});
