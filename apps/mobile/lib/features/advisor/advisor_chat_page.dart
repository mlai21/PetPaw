import 'package:flutter/material.dart';

class AdvisorChatPage extends StatefulWidget {
  const AdvisorChatPage({super.key, this.fromTodayContext, this.onBackToToday});

  final Map<String, String>? fromTodayContext;
  final VoidCallback? onBackToToday;

  @override
  State<AdvisorChatPage> createState() => _AdvisorChatPageState();
}

class _AdvisorChatPageState extends State<AdvisorChatPage> {
  static const String _skeletonReply = '收到，我来帮你拆解。';
  static const String _fullReply = '收到，我来帮你拆解。先从最小行动开始：把任务缩小到10分钟内可完成的一步。';
  static const Duration _skeletonHold = Duration(milliseconds: 300);
  static const Duration _streamTick = Duration(milliseconds: 20);
  static const String _focusKickoffChip = '帮我拆成 15 分钟起步动作';
  static const String _fallbackContextChip = '结合我今天的挑战给我一个起步动作';

  final TextEditingController _controller = TextEditingController();
  late final List<_ChatMessage> _messages;
  bool _isStreaming = false;
  int _streamSessionId = 0;

  @override
  void initState() {
    super.initState();
    _messages = [_ChatMessage(role: 'advisor', text: '问问你的顾问')];
    if (widget.fromTodayContext != null) {
      _messages.add(
        const _ChatMessage(
          role: 'advisor',
          text: '我已看到你今天的挑战方向，想先拆解执行步骤，还是先排除阻碍？',
        ),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final suggestionChips = _buildSuggestionChips();
    return Column(
      children: [
        if (widget.fromTodayContext != null && widget.onBackToToday != null)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: widget.onBackToToday,
              child: const Text('返回今日'),
            ),
          ),
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
              for (final chipText in suggestionChips)
                ActionChip(
                  label: Text(chipText),
                  onPressed: () => _controller.text = chipText,
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: _messages.length,
            itemBuilder: (context, index) {
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

  List<String> _buildSuggestionChips() {
    final rawChips = <String>[
      if (_resolveContextChip() case final contextChip?) contextChip,
      '帮我拆解今天最重要的一步',
      '我卡住了，给我一个最小行动',
    ];
    final seen = <String>{};
    return [
      for (final chip in rawChips)
        if (seen.add(chip)) chip,
    ];
  }

  String? _resolveContextChip() {
    final challenge = widget.fromTodayContext?['challenge']?.trim();
    if (challenge == null || challenge.isEmpty) {
      return null;
    }
    if (challenge.contains('深度工作') || challenge.contains('专注')) {
      return _focusKickoffChip;
    }
    return _fallbackContextChip;
  }

  Future<void> _sendMessage() async {
    final text = _controller.text.trim();
    if (text.isEmpty) {
      return;
    }
    final sessionId = ++_streamSessionId;

    setState(() {
      if (_isStreaming &&
          _messages.isNotEmpty &&
          _messages.last.role == 'advisor') {
        _messages.removeLast();
      }
      _messages.add(_ChatMessage(role: 'user', text: text));
      _messages.add(const _ChatMessage(role: 'advisor', text: _skeletonReply));
      _isStreaming = true;
    });
    _controller.clear();

    await Future<void>.delayed(_skeletonHold);
    if (!mounted || sessionId != _streamSessionId) {
      return;
    }

    for (var end = _skeletonReply.length + 1; end <= _fullReply.length; end++) {
      await Future<void>.delayed(_streamTick);
      if (!mounted || sessionId != _streamSessionId) {
        return;
      }

      setState(() {
        _messages[_messages.length - 1] = _ChatMessage(
          role: 'advisor',
          text: _fullReply.substring(0, end),
        );
      });
    }

    if (!mounted || sessionId != _streamSessionId) {
      return;
    }
    setState(() {
      _isStreaming = false;
    });
  }
}

class _ChatMessage {
  const _ChatMessage({required this.role, required this.text});

  final String role;
  final String text;
}
