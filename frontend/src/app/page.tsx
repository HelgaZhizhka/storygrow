export default function HomePage(): React.ReactElement {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        StoryGrow
      </p>
      <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
        Персонализированные детские книги с возрастной адаптацией
      </h1>
      <p className="max-w-xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
        Сайт находится в разработке. Скоро здесь появится конструктор историй с педагогическим
        контролем качества.
      </p>
    </main>
  );
}
