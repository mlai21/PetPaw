import 'package:flutter/material.dart';
import 'package:pet_paw_app/features/advisor/advisor_chat_page.dart';
import 'package:pet_paw_app/features/manifesto/manifesto_page.dart';
import 'package:pet_paw_app/features/today/today_page.dart';

class PetPawApp extends StatelessWidget {
  const PetPawApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      debugShowCheckedModeBanner: false,
      home: _HomeShell(),
    );
  }
}

class _HomeShell extends StatefulWidget {
  const _HomeShell();

  @override
  State<_HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<_HomeShell> {
  int _currentIndex = 0;
  Offset? _petPosition;
  Map<String, String>? _todayContext;

  static const _titles = ['今日', '宣言书', '顾问', '历史记录', '设置'];

  @override
  Widget build(BuildContext context) {
    const petWidth = 104.0;
    const petHeight = 44.0;

    return Scaffold(
      appBar: AppBar(title: Text(_titles[_currentIndex])),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final defaultPos = Offset(
            constraints.maxWidth - petWidth - 16,
            constraints.maxHeight - petHeight - 20,
          );
          final currentPos = _petPosition ?? defaultPos;
          final maxLeft = constraints.maxWidth - petWidth;
          final maxTop = constraints.maxHeight - petHeight;

          return Stack(
            children: [
              Positioned.fill(child: _buildCurrentPage()),
              if (_currentIndex != 4)
                Positioned(
                  left: currentPos.dx.clamp(0, maxLeft),
                  top: currentPos.dy.clamp(0, maxTop),
                  child: _FloatingPet(
                    onDragUpdate: (delta) {
                      setState(() {
                        final base = _petPosition ?? defaultPos;
                        final next = base + delta;
                        _petPosition = Offset(
                          next.dx.clamp(0, maxLeft),
                          next.dy.clamp(0, maxTop),
                        );
                      });
                    },
                  ),
                ),
            ],
          );
        },
      ),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            if (index == 2) {
              _todayContext = null;
            }
            _currentIndex = index;
          });
        },
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.wb_sunny), label: '今日'),
          BottomNavigationBarItem(icon: Icon(Icons.flag), label: '宣言书'),
          BottomNavigationBarItem(icon: Icon(Icons.chat_bubble), label: '顾问'),
          BottomNavigationBarItem(icon: Icon(Icons.history), label: '历史记录'),
          BottomNavigationBarItem(icon: Icon(Icons.settings), label: '设置'),
        ],
      ),
    );
  }

  Widget _buildCurrentPage() {
    switch (_currentIndex) {
      case 0:
        return TodayPage(
          onAskAdvisor: (payload) {
            setState(() {
              _todayContext = Map<String, String>.from(payload);
              _currentIndex = 2;
            });
          },
        );
      case 1:
        return const ManifestoPage();
      case 2:
        return AdvisorChatPage(
          fromTodayContext: _todayContext,
          onBackToToday: _todayContext == null
              ? null
              : () {
                  setState(() => _currentIndex = 0);
                },
        );
      case 3:
        return const _HistoryPage();
      case 4:
        return const _SettingsPage();
      default:
        return const SizedBox.shrink();
    }
  }
}

class _FloatingPet extends StatefulWidget {
  const _FloatingPet({required this.onDragUpdate});

  final ValueChanged<Offset> onDragUpdate;

  @override
  State<_FloatingPet> createState() => _FloatingPetState();
}

class _FloatingPetState extends State<_FloatingPet>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _scale = Tween(begin: 0.96, end: 1.04).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onPanUpdate: (details) => widget.onDragUpdate(details.delta),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          key: const Key('floating_pet'),
          borderRadius: BorderRadius.circular(24),
          onTap: () {},
          child: ScaleTransition(
            scale: _scale,
            child: Ink(
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.08),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.pets, size: 18),
                    SizedBox(width: 6),
                    Text('分身顾问'),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HistoryPage extends StatelessWidget {
  const _HistoryPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Text('历史记录（即将上线）'),
    );
  }
}

class _SettingsPage extends StatelessWidget {
  const _SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        _ShellSettingCard(
          title: '分身形象管理',
          subtitle: '切换分身外观、人格展示样式与动态反馈',
        ),
        SizedBox(height: 12),
        _ShellSettingCard(
          title: '账户登录',
          subtitle: '登录后同步可跨设备共享的成长层数据',
        ),
      ],
    );
  }
}

class _ShellSettingCard extends StatelessWidget {
  const _ShellSettingCard({
    required this.title,
    required this.subtitle,
  });

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
      ),
    );
  }
}
