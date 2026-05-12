import 'package:flutter/material.dart';
import 'package:pet_paw_app/features/onboarding/avatar_onboarding_models.dart';

class AvatarOnboardingPage extends StatefulWidget {
  const AvatarOnboardingPage({super.key, this.onFinished});

  final void Function({
    required String selectedCandidateId,
    required String advisorName,
    String? expectation,
  })? onFinished;

  @override
  State<AvatarOnboardingPage> createState() => _AvatarOnboardingPageState();
}

class _AvatarOnboardingPageState extends State<AvatarOnboardingPage> {
  static const List<AvatarCandidate> _mockCandidates = [
    AvatarCandidate(id: 'c1', imageUrl: 'mock://c1'),
    AvatarCandidate(id: 'c2', imageUrl: 'mock://c2'),
    AvatarCandidate(id: 'c3', imageUrl: 'mock://c3'),
    AvatarCandidate(id: 'c4', imageUrl: 'mock://c4'),
  ];

  int _step = 1;
  List<AvatarCandidate> _candidates = const <AvatarCandidate>[];
  String? _selectedCandidateId;
  final TextEditingController _advisorNameController = TextEditingController();
  final TextEditingController _expectationController = TextEditingController();
  String? _advisorNameError;

  @override
  void dispose() {
    _advisorNameController.dispose();
    _expectationController.dispose();
    super.dispose();
  }

  void _generateCandidates() {
    setState(() {
      _candidates = List<AvatarCandidate>.from(_mockCandidates);
      _selectedCandidateId = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('创建顾问分身')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: _step == 1 ? _buildStepOne(context) : _buildStepTwo(context),
        ),
      ),
    );
  }

  Widget _buildStepOne(BuildContext context) {
    final hasSelection = _selectedCandidateId != null;
    final hasCandidates = _candidates.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Step 1/2 创建你的顾问分身',
          style: Theme.of(
            context,
          ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        Text(
          '先生成 4 个候选形象，选择最满意的一个再继续。',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 24),
        FilledButton(
          key: const Key('generate_candidates'),
          onPressed: _generateCandidates,
          child: const Text('生成 4 个候选'),
        ),
        if (hasCandidates) ...[
          const SizedBox(height: 12),
          TextButton(
            onPressed: _generateCandidates,
            child: const Text('不满意，重新生成'),
          ),
          const SizedBox(height: 12),
          Wrap(
            key: const Key('candidate_grid'),
            spacing: 8,
            runSpacing: 8,
            children: _candidates.map((candidate) {
              return ChoiceChip(
                key: Key('candidate_${candidate.id}'),
                label: Text(candidate.id.toUpperCase()),
                selected: _selectedCandidateId == candidate.id,
                onSelected: (_) {
                  setState(() {
                    _selectedCandidateId = candidate.id;
                  });
                },
              );
            }).toList(),
          ),
        ],
        const Spacer(),
        FilledButton(
          key: const Key('next_step'),
          onPressed: hasSelection
              ? () {
                  setState(() {
                    _step = 2;
                  });
                }
              : null,
          child: const Text('下一步'),
        ),
      ],
    );
  }

  Widget _buildStepTwo(BuildContext context) {
    void finishOnboarding() {
      final advisorName = _advisorNameController.text.trim();
      if (!validateAdvisorName(advisorName)) {
        setState(() {
          _advisorNameError = '请先给分身起名字';
        });
        return;
      }

      final expectation = _expectationController.text.trim();
      setState(() {
        _advisorNameError = null;
      });
      widget.onFinished?.call(
        selectedCandidateId: _selectedCandidateId ?? '',
        advisorName: advisorName,
        expectation: expectation.isEmpty ? null : expectation,
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Step 2/2 基础信息',
          style: Theme.of(
            context,
          ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 12),
        TextField(
          key: const Key('advisor_name_input'),
          controller: _advisorNameController,
          decoration: InputDecoration(
            labelText: '分身名字',
            hintText: '请输入 2-12 个字符',
            errorText: _advisorNameError,
          ),
          onChanged: (_) {
            if (_advisorNameError != null) {
              setState(() {
                _advisorNameError = null;
              });
            }
          },
        ),
        const SizedBox(height: 12),
        TextField(
          key: const Key('expectation_input'),
          controller: _expectationController,
          decoration: const InputDecoration(
            labelText: '你的期望（选填）',
            hintText: '例如：希望更懂我，沟通更温暖',
          ),
          maxLines: 3,
          minLines: 2,
        ),
        const Spacer(),
        FilledButton(
          key: const Key('finish_onboarding'),
          onPressed: finishOnboarding,
          child: const Text('完成'),
        ),
      ],
    );
  }
}
