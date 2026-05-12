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
    final palette = _AdvisorPalette.of(context);
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
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            itemCount: _messages.length,
            itemBuilder: (context, index) {
              final message = _messages[index];
              return _messageBubble(context, message.role, message.text);
            },
          ),
        ),
        SafeArea(
          top: false,
          child: Container(
            decoration: BoxDecoration(
              color: palette.inputBarBackground,
              border: Border(top: BorderSide(color: palette.divider)),
            ),
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
            child: Row(
              children: [
                _CircleIconButton(
                  icon: Icons.add,
                  background: palette.actionButtonBackground,
                  foreground: palette.actionButtonForeground,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _controller,
                    style: TextStyle(color: palette.inputText),
                    decoration: InputDecoration(
                      hintText: '输入你现在最想问的问题',
                      hintStyle: TextStyle(color: palette.inputHint),
                      filled: true,
                      fillColor: palette.inputBackground,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(22),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                _CircleIconButton(
                  icon: Icons.mic_none_rounded,
                  background: palette.actionButtonBackground,
                  foreground: palette.actionButtonForeground,
                ),
                const SizedBox(width: 8),
                _CircleIconButton(
                  onPressed: _sendMessage,
                  icon: Icons.arrow_upward_rounded,
                  background: palette.sendButtonBackground,
                  foreground: palette.sendButtonForeground,
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
    final palette = _AdvisorPalette.of(context);

    final bubble = Container(
      margin: const EdgeInsets.only(bottom: 12),
      constraints: BoxConstraints(
        maxWidth: MediaQuery.of(context).size.width * 0.72,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: isUser
            ? palette.userBubbleBackground
            : palette.advisorBubbleBackground,
        borderRadius: BorderRadius.circular(16),
        border: isUser ? null : Border.all(color: palette.bubbleBorder),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: isUser ? palette.userBubbleText : palette.advisorBubbleText,
          fontSize: 16,
          height: 1.45,
        ),
      ),
    );

    if (isUser) {
      return Align(alignment: Alignment.centerRight, child: bubble);
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            margin: const EdgeInsets.only(top: 4, right: 10),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: [palette.avatarStart, palette.avatarEnd],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child:
                const Icon(Icons.auto_awesome, size: 16, color: Colors.white),
          ),
          Flexible(child: bubble),
        ],
      ),
    );
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

class _CircleIconButton extends StatelessWidget {
  const _CircleIconButton({
    required this.icon,
    required this.background,
    required this.foreground,
    this.onPressed,
  });

  final IconData icon;
  final Color background;
  final Color foreground;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: background,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onPressed,
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: 36,
          height: 36,
          child: Icon(icon, size: 20, color: foreground),
        ),
      ),
    );
  }
}

class _AdvisorPalette {
  const _AdvisorPalette({
    required this.advisorBubbleBackground,
    required this.advisorBubbleText,
    required this.userBubbleBackground,
    required this.userBubbleText,
    required this.bubbleBorder,
    required this.divider,
    required this.inputBarBackground,
    required this.inputBackground,
    required this.inputText,
    required this.inputHint,
    required this.actionButtonBackground,
    required this.actionButtonForeground,
    required this.sendButtonBackground,
    required this.sendButtonForeground,
    required this.avatarStart,
    required this.avatarEnd,
  });

  final Color advisorBubbleBackground;
  final Color advisorBubbleText;
  final Color userBubbleBackground;
  final Color userBubbleText;
  final Color bubbleBorder;
  final Color divider;
  final Color inputBarBackground;
  final Color inputBackground;
  final Color inputText;
  final Color inputHint;
  final Color actionButtonBackground;
  final Color actionButtonForeground;
  final Color sendButtonBackground;
  final Color sendButtonForeground;
  final Color avatarStart;
  final Color avatarEnd;

  factory _AdvisorPalette.of(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return _AdvisorPalette(
      advisorBubbleBackground: colorScheme.surfaceContainerLow,
      advisorBubbleText: colorScheme.onSurface,
      userBubbleBackground: colorScheme.surfaceContainerHighest,
      userBubbleText: colorScheme.onSurface,
      bubbleBorder: colorScheme.outlineVariant.withValues(alpha: 0.5),
      divider: colorScheme.outlineVariant.withValues(alpha: 0.4),
      inputBarBackground: colorScheme.surface,
      inputBackground: colorScheme.surfaceContainerHigh,
      inputText: colorScheme.onSurface,
      inputHint: colorScheme.onSurfaceVariant,
      actionButtonBackground: colorScheme.surfaceContainerHigh,
      actionButtonForeground: colorScheme.onSurfaceVariant,
      sendButtonBackground: colorScheme.surfaceContainerHighest,
      sendButtonForeground: colorScheme.onSurface,
      avatarStart: const Color(0xFF7B6BFF),
      avatarEnd: const Color(0xFF5B77FF),
    );
  }
}
