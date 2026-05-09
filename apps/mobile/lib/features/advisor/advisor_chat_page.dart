import 'package:flutter/material.dart';

class AdvisorChatPage extends StatefulWidget {
  const AdvisorChatPage({
    super.key,
    this.fromTodayContext,
    this.onBackToToday,
  });

  /// When non-null, the user arrived from Today with structured challenge context.
  final Map<String, String>? fromTodayContext;

  /// Shown only when [fromTodayContext] is also non-null.
  final VoidCallback? onBackToToday;

  @override
  State<AdvisorChatPage> createState() => _AdvisorChatPageState();
}

class _AdvisorChatPageState extends State<AdvisorChatPage> {
  final TextEditingController _controller = TextEditingController();
  final List<_ChatMessage> _messages = [
    _ChatMessage(role: 'advisor', text: '问问你的顾问'),
  ];
  bool _isThinking = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (widget.fromTodayContext?.isNotEmpty ?? false) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '我已看到你今天的挑战方向，想先拆解执行步骤，还是先排除阻碍？',
                ),
                if (widget.onBackToToday != null) ...[
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: widget.onBackToToday,
                    child: const Text('返回今日'),
                  ),
                ],
              ],
            ),
          ),
        ],
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 12, 16, 6),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text('你可以这样开始：'),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Wrap(
            spacing: 8,
            children: [
              ActionChip(
                label: const Text('帮我拆解今天最重要的一步'),
                onPressed: () => _controller.text = '帮我拆解今天最重要的一步',
              ),
              ActionChip(
                label: const Text('我卡住了，给我一个最小行动'),
                onPressed: () => _controller.text = '我卡住了，给我一个最小行动',
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: _messages.length + (_isThinking ? 1 : 0),
            itemBuilder: (context, index) {
              if (_isThinking && index == _messages.length) {
                return _messageBubble(context, 'advisor', '思考中...');
              }
              final message = _messages[index];
              return _messageBubble(context, message.role, message.text);
            },
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    decoration: const InputDecoration(
                      hintText: '输入你现在最想问的问题',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _sendMessage,
                  child: const Text('发送'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _messageBubble(BuildContext context, String role, String text) {
    final isUser = role == 'user';
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isUser
              ? Theme.of(context).colorScheme.primaryContainer
              : Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(text),
      ),
    );
  }

  Future<void> _sendMessage() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _isThinking) {
      return;
    }

    setState(() {
      _messages.add(_ChatMessage(role: 'user', text: text));
      _isThinking = true;
    });
    _controller.clear();

    await Future<void>.delayed(const Duration(milliseconds: 800));
    if (!mounted) {
      return;
    }

    setState(() {
      _isThinking = false;
      _messages.add(const _ChatMessage(role: 'advisor', text: '收到，我来帮你拆解。'));
    });
  }
}

class _ChatMessage {
  const _ChatMessage({required this.role, required this.text});

  final String role;
  final String text;
}
