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
  static const Duration _skeletonHold = Duration(milliseconds: 220);
  static const Duration _streamTickFast = Duration(milliseconds: 18);
  static const Duration _streamTickNormal = Duration(milliseconds: 24);
  static const int _fastTickChars = 12;
  static const String _focusKickoffChip = '帮我拆成 15 分钟起步动作';
  static const String _procrastinationChip = '先帮我识别当前最大阻碍';
  static const String _fitnessChip = '给我一个今天可执行的最低标准';
  static const String _reviewChip = '先帮我列出今天最关键的1条复盘点';
  static const String _fallbackContextChip = '结合我今天的挑战给我一个起步动作';

  final TextEditingController _controller = TextEditingController();
  late final List<_ChatMessage> _messages;
  bool _isStreaming = false;
  int _streamSessionId = 0;
  bool _thinkingDetailsExpanded = false;

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
        const _AdvisorHeader(),
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
            itemCount: _messages.length + (_isStreaming ? 1 : 0),
            itemBuilder: (context, index) {
              if (_isStreaming && index == _messages.length) {
                return _buildThinkingCard();
              }
              final message = _messages[index];
              return _messageBubble(context, message.role, message.text);
            },
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 12, 12),
            child: Row(
              children: [
                _InputIconButton(icon: Icons.add, onPressed: () {}),
                const SizedBox(width: 8),
                Expanded(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: const Color(0xFFE9E9EC)),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _controller,
                              decoration: const InputDecoration(
                                hintText: '输入你的问题或需求...',
                                border: InputBorder.none,
                              ),
                            ),
                          ),
                          _InputIconButton(icon: Icons.mic_none, onPressed: () {}),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                _InputIconButton(
                  key: const Key('advisor_send_button'),
                  icon: Icons.north,
                  onPressed: _sendMessage,
                  fillColor: const Color(0xFFE5E5EA),
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
        margin: const EdgeInsets.only(bottom: 12),
        constraints: const BoxConstraints(maxWidth: 320),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE9E9EC)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0C000000),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Text(text),
      ),
    );
  }

  Widget _buildThinkingCard() {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE9E9EC)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  '... 正在思考 ...',
                  style: TextStyle(color: Color(0xFF7A7A82)),
                ),
              ),
              IconButton(
                key: const Key('advisor_thinking_toggle'),
                onPressed: () => setState(
                  () => _thinkingDetailsExpanded = !_thinkingDetailsExpanded,
                ),
                icon: Icon(
                  _thinkingDetailsExpanded
                      ? Icons.keyboard_arrow_up
                      : Icons.keyboard_arrow_down,
                ),
              ),
            ],
          ),
          if (_thinkingDetailsExpanded)
            const Padding(
              padding: EdgeInsets.only(top: 4, left: 2, right: 2),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('检索来源'),
                  SizedBox(height: 4),
                  Text('- wikipedia.org'),
                  Text('- productivityist.com'),
                  SizedBox(height: 8),
                  Text('关键词'),
                  SizedBox(height: 4),
                  Text('- 时间管理'),
                  Text('- 夜间效率'),
                ],
              ),
            ),
        ],
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
    if (challenge.contains('拖延') ||
        challenge.contains('卡住') ||
        challenge.contains('开始不了')) {
      return _procrastinationChip;
    }
    if (challenge.contains('运动') ||
        challenge.contains('跑步') ||
        challenge.contains('训练')) {
      return _fitnessChip;
    }
    if (challenge.contains('复盘') || challenge.contains('总结')) {
      return _reviewChip;
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
      _thinkingDetailsExpanded = false;
    });
    _controller.clear();

    await Future<void>.delayed(_skeletonHold);
    if (!mounted || sessionId != _streamSessionId) {
      return;
    }

    for (var end = _skeletonReply.length + 1; end <= _fullReply.length; end++) {
      final step = end - _skeletonReply.length;
      await Future<void>.delayed(
        step <= _fastTickChars ? _streamTickFast : _streamTickNormal,
      );
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

class _AdvisorHeader extends StatelessWidget {
  const _AdvisorHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFEFEFF1))),
      ),
      child: Row(
        children: const [
          Icon(Icons.menu, size: 22),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '我的顾问',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                ),
                SizedBox(height: 2),
                Text(
                  '随时在线，专为你',
                  style: TextStyle(fontSize: 12, color: Color(0xFF888892)),
                ),
              ],
            ),
          ),
          Icon(Icons.edit_outlined, size: 22),
        ],
      ),
    );
  }
}

class _InputIconButton extends StatelessWidget {
  const _InputIconButton({
    super.key,
    required this.icon,
    required this.onPressed,
    this.fillColor = Colors.white,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final Color fillColor;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: fillColor,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onPressed,
        child: SizedBox(
          width: 38,
          height: 38,
          child: Icon(icon, size: 20),
        ),
      ),
    );
  }
}
