import 'package:flutter/material.dart';
import 'package:pet_paw_app/data/remote/advisor_chat_repository.dart';
import 'package:pet_paw_app/features/advisor/advisor_chat_page.dart';
import 'package:pet_paw_app/features/history/history_page.dart';
import 'package:pet_paw_app/features/manifesto/manifesto_page.dart';
import 'package:pet_paw_app/features/settings/settings_page.dart';
import 'package:pet_paw_app/features/today/today_page.dart';

class PetPawApp extends StatelessWidget {
  const PetPawApp({super.key, this.advisorRepository});

  /// 测试注入 [StubAdvisorChatRepository]；生产环境省略，由 [AdvisorChatPage] 默认走 HTTP。
  final AdvisorChatRepository? advisorRepository;

  @override
  Widget build(BuildContext context) {
    final lightScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF10A37F),
      brightness: Brightness.light,
    );
    final darkScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF10A37F),
      brightness: Brightness.dark,
    );

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.system,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: lightScheme,
        scaffoldBackgroundColor: Colors.white,
        appBarTheme: AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: lightScheme.onSurface,
          elevation: 0,
          centerTitle: false,
          titleTextStyle: TextStyle(
            color: lightScheme.onSurface,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorScheme: darkScheme,
        scaffoldBackgroundColor: darkScheme.surface,
        appBarTheme: AppBarTheme(
          backgroundColor: darkScheme.surface,
          foregroundColor: darkScheme.onSurface,
          elevation: 0,
          centerTitle: false,
          titleTextStyle: TextStyle(
            color: darkScheme.onSurface,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      home: _HomeShell(advisorRepository: advisorRepository),
    );
  }
}

class _HomeShell extends StatefulWidget {
  const _HomeShell({this.advisorRepository});

  final AdvisorChatRepository? advisorRepository;

  @override
  State<_HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<_HomeShell> {
  int _currentIndex = 0;
  Offset? _petPosition;
  int _petSnapVersion = 0;
  Map<String, String>? _todayContextForAdvisor;
  static const _petHorizontalPadding = 12.0;
  static const _petSnapDuration = Duration(milliseconds: 180);
  static const _petSnapCurve = Curves.easeOutBack;

  static const _titles = ['今日', '宣言书', '顾问', '历史记录', '设置'];

  Future<void> _snapPetToEdge({
    required Offset from,
    required Offset to,
    required int snapVersion,
  }) async {
    const steps = 6;
    for (var i = 1; i <= steps; i++) {
      await Future<void>.delayed(_petSnapDuration ~/ steps);
      if (!mounted || snapVersion != _petSnapVersion) return;
      final t = _petSnapCurve.transform(i / steps);
      setState(() => _petPosition = Offset.lerp(from, to, t));
    }
  }

  @override
  Widget build(BuildContext context) {
    const petWidth = 104.0;
    const petHeight = 44.0;

    final pages = <Widget>[
      TodayPage(
        onAskAdvisor: (payload) {
          setState(() {
            _todayContextForAdvisor = payload;
            _currentIndex = 2;
          });
        },
      ),
      const ManifestoPage(),
      AdvisorChatPage(
        advisorRepository: widget.advisorRepository,
        fromTodayContext: _todayContextForAdvisor,
        onBackToToday: () {
          setState(() => _currentIndex = 0);
        },
      ),
      const HistoryPage(),
      const SettingsPage(),
    ];

    return Scaffold(
      appBar: _buildAppBar(context),
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
              Positioned.fill(child: pages[_currentIndex]),
              if (_currentIndex != 4)
                Positioned(
                  left: currentPos.dx.clamp(0, maxLeft),
                  top: currentPos.dy.clamp(0, maxTop),
                  child: _FloatingPet(
                    onTap: () {},
                    onDragUpdate: (delta) {
                      _petSnapVersion++;
                      setState(() {
                        final base = _petPosition ?? defaultPos;
                        final next = base + delta;
                        _petPosition = Offset(
                          next.dx.clamp(0, maxLeft),
                          next.dy.clamp(0, maxTop),
                        );
                      });
                    },
                    onDragEnd: () {
                      final snapVersion = ++_petSnapVersion;
                      final base = _petPosition ?? defaultPos;
                      final snappedX = base.dx <= maxLeft / 2
                          ? _petHorizontalPadding
                          : maxLeft - _petHorizontalPadding;
                      final snapped = Offset(
                        snappedX,
                        base.dy.clamp(0, maxTop),
                      );
                      _snapPetToEdge(
                        from: base,
                        to: snapped,
                        snapVersion: snapVersion,
                      );
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
        selectedItemColor: Theme.of(context).colorScheme.primary,
        unselectedItemColor: Theme.of(
          context,
        ).colorScheme.onSurfaceVariant.withValues(alpha: 0.8),
        backgroundColor: Theme.of(context).colorScheme.surface,
        elevation: 6,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
            if (index != 2) {
              _todayContextForAdvisor = null;
            }
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

  PreferredSizeWidget _buildAppBar(BuildContext context) {
    if (_currentIndex != 2) {
      return AppBar(title: Text(_titles[_currentIndex]));
    }

    return AppBar(
      centerTitle: true,
      leading: IconButton(
        icon: const Icon(Icons.menu_rounded),
        onPressed: () {},
      ),
      title: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '我的顾问',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          Text(
            '随时在线，专为你',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontSize: 12,
                ),
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.edit_outlined),
          onPressed: () {},
        ),
      ],
    );
  }
}

class _FloatingPet extends StatefulWidget {
  const _FloatingPet({
    required this.onTap,
    required this.onDragUpdate,
    required this.onDragEnd,
  });

  final VoidCallback onTap;
  final ValueChanged<Offset> onDragUpdate;
  final VoidCallback onDragEnd;

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
      onPanEnd: (_) => widget.onDragEnd(),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          key: const Key('floating_pet'),
          borderRadius: BorderRadius.circular(24),
          onTap: widget.onTap,
          child: ScaleTransition(
            scale: _scale,
            child: Ink(
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
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
