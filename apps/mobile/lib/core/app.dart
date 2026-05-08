import 'package:flutter/material.dart';

class PetPawApp extends StatelessWidget {
  const PetPawApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      home: Scaffold(
        body: Center(
          child: Text('Today'),
        ),
      ),
    );
  }
}
