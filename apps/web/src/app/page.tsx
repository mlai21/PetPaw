import Link from "next/link";
import { ArrowRight, Sparkles, Flag, MessageCircle, History } from "lucide-react";
import { AuroraText } from "@/components/magic/aurora-text";
import { ShimmerButton } from "@/components/magic/shimmer-button";
import { NumberTicker } from "@/components/magic/number-ticker";
import { Marquee } from "@/components/magic/marquee";
import { BlurFade } from "@/components/magic/blur-fade";
import { BorderBeam } from "@/components/magic/border-beam";
import { TypingAnimation } from "@/components/magic/typing-animation";

const features = [
  {
    icon: Sparkles,
    title: "今日页",
    desc: "肯定昨天、定义今天的一小步，AI 帮你把目标拆到可执行。",
  },
  {
    icon: MessageCircle,
    title: "分身顾问",
    desc: "随时在线、专为你。结合宣言书与当日状态给出建议。",
  },
  {
    icon: Flag,
    title: "宣言书",
    desc: "把想成为的样子写成承诺，让每天的行动自动对齐长期目标。",
  },
  {
    icon: History,
    title: "历史回顾",
    desc: "记录每一次坚持，见证分身与你一同成长进化。",
  },
];

const marqueeTags = [
  "坚持 30 天",
  "专注力 +12%",
  "复盘 156 次",
  "总步数 230k",
  "宣言已签署",
  "连续打卡",
];

export default function Home() {
  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            🐾
          </span>
          PetPaw
        </div>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground">功能</a>
          <a href="#stats" className="hover:text-foreground">数据</a>
          <Link href="/admin" className="hover:text-foreground">后台</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 text-center">
        <BlurFade delay={0.1}>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            AI 分身顾问 · 陪你每天成为更好的自己
          </div>
        </BlurFade>

        <BlurFade delay={0.2}>
          <h1 className="text-balance text-5xl font-extrabold tracking-tight sm:text-6xl">
            遇见更好的
            <AuroraText className="px-2">自己</AuroraText>
          </h1>
        </BlurFade>

        <BlurFade delay={0.35}>
          <div className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            <TypingAnimation duration={45} className="text-lg font-normal">
              把你想成为的样子，写成可以每天兑现的承诺。
            </TypingAnimation>
          </div>
        </BlurFade>

        <BlurFade delay={0.5}>
          <div className="mt-10 flex items-center justify-center gap-4">
            <ShimmerButton className="shadow-2xl">
              <span className="flex items-center gap-2 whitespace-nowrap px-2 text-sm font-medium text-white">
                立即开始 <ArrowRight className="h-4 w-4" />
              </span>
            </ShimmerButton>
            <a
              href="#features"
              className="rounded-full border px-6 py-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              了解功能
            </a>
          </div>
        </BlurFade>
      </section>

      {/* Marquee */}
      <section className="border-y bg-muted/30 py-6">
        <Marquee pauseOnHover className="[--duration:25s]">
          {marqueeTags.map((tag) => (
            <div
              key={tag}
              className="mx-2 rounded-full border bg-background px-5 py-2 text-sm text-muted-foreground"
            >
              {tag}
            </div>
          ))}
        </Marquee>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <BlurFade delay={0.1}>
          <h2 className="text-center text-3xl font-bold">一套陪你坚持的系统</h2>
          <p className="mx-auto mt-3 max-w-md text-center text-muted-foreground">
            今日、顾问、宣言书、历史，四个模块闭环驱动每天的成长。
          </p>
        </BlurFade>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <BlurFade key={f.title} delay={0.15 + i * 0.1}>
              <div className="relative h-full overflow-hidden rounded-2xl border bg-card p-6">
                <f.icon className="h-7 w-7 text-primary" />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
                {i === 1 && <BorderBeam size={120} duration={6} />}
              </div>
            </BlurFade>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="border-t bg-muted/30 py-20">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-10 px-6 text-center sm:grid-cols-3">
          {[
            { value: 12480, label: "累计坚持步数", suffix: "" },
            { value: 156, label: "累计复盘次数", suffix: "" },
            { value: 98, label: "用户满意度", suffix: "%" },
          ].map((s) => (
            <BlurFade key={s.label} delay={0.1}>
              <div>
                <div className="text-5xl font-extrabold text-primary">
                  <NumberTicker value={s.value} />
                  {s.suffix}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">{s.label}</div>
              </div>
            </BlurFade>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <BlurFade delay={0.1}>
          <h2 className="text-4xl font-bold">
            今天，就和你的<AuroraText className="px-1">分身</AuroraText>一起开始
          </h2>
          <div className="mt-8 flex justify-center">
            <ShimmerButton className="shadow-2xl">
              <span className="whitespace-nowrap px-2 text-sm font-medium text-white">
                免费体验 PetPaw
              </span>
            </ShimmerButton>
          </div>
        </BlurFade>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} PetPaw · 你的分身顾问
      </footer>
    </main>
  );
}
