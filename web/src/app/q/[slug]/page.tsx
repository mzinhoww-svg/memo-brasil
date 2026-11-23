import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Quiz } from "@/features/funnel/Quiz";
import { QUIZZES, quizBySlug } from "@/features/funnel/quizzes";

/** Quizzes do funil: páginas de anúncio, uma por nível de consciência. Fora do índice do Google (o conteúdo indexado é a home). */
export function generateStaticParams() {
  return QUIZZES.map((q) => ({ slug: q.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const quiz = quizBySlug((await params).slug);
  if (!quiz) return {};
  return {
    title: { absolute: `${quiz.title} | Revela` },
    description: quiz.lead,
    robots: { index: false, follow: false },
    openGraph: { type: "website", locale: "pt_BR", siteName: "Revela", title: quiz.title, description: quiz.lead },
  };
}

export default async function QuizPage({ params }: { params: Promise<{ slug: string }> }) {
  const quiz = quizBySlug((await params).slug);
  if (!quiz) notFound();
  return (
    <main className="app-col app-col--card app-fluid">
      <Quiz quiz={quiz} />
    </main>
  );
}
