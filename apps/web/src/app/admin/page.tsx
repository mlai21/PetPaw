import Link from "next/link";
import { ArrowLeft, Users, MessageSquare, ShieldCheck } from "lucide-react";
import { AuroraText } from "@/components/magic/aurora-text";
import { BlurFade } from "@/components/magic/blur-fade";
import { BorderBeam } from "@/components/magic/border-beam";

const panels = [
  { icon: MessageSquare, title: "顾问 Prompt 管理", desc: "编辑与版本化 advisor 提示词。" },
  { icon: Users, title: "用户管理", desc: "查看用户、坚持数据与分身成长。" },
  { icon: ShieldCheck, title: "内容审核", desc: "审核宣言书与社区内容。" },
];

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> 返回首页
      </Link>

      <BlurFade delay={0.1}>
        <h1 className="mt-6 text-4xl font-extrabold">
          PetPaw <AuroraText>后台</AuroraText>
        </h1>
        <p className="mt-2 text-muted-foreground">管理控制台（占位页，后续接入 services/api）。</p>
      </BlurFade>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {panels.map((p, i) => (
          <BlurFade key={p.title} delay={0.2 + i * 0.1}>
            <div className="relative h-full overflow-hidden rounded-2xl border bg-card p-6">
              <p.icon className="h-7 w-7 text-primary" />
              <h3 className="mt-4 font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
              {i === 0 && <BorderBeam size={100} duration={6} />}
            </div>
          </BlurFade>
        ))}
      </div>
    </main>
  );
}
