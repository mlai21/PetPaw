// 防止本地或 CI 意外注入的密钥触发真实外网请求；单测始终走占位回答路径。
delete process.env.DASHSCOPE_API_KEY;
delete process.env.OPENAI_API_KEY;
