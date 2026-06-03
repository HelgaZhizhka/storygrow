import Link from 'next/link';

export default function SubscriptionSuccessPage(): React.ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="text-5xl">🎉</div>
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Подписка оформлена!
      </h1>
      <p className="max-w-sm text-zinc-500 dark:text-zinc-400">
        Теперь вы можете создавать персонализированные книги для своего ребёнка.
      </p>
      <Link
        href="/books/new"
        className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Создать первую книгу
      </Link>
    </main>
  );
}
