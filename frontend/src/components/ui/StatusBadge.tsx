import type { BookStatus } from '@/lib/types';

const CONFIG: Record<BookStatus, { label: string; className: string }> = {
  ready: {
    label: 'Готова',
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  },
  generating: {
    label: 'Создаётся…',
    className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  },
  pending: {
    label: 'Ожидает',
    className: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  },
  failed: {
    label: 'Ошибка',
    className: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  },
  images_failed: {
    label: 'Ошибка изображений',
    className: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  },
};

interface Props {
  status: BookStatus;
}

export function StatusBadge({ status }: Props): React.ReactElement {
  const { label, className } = CONFIG[status] ?? {
    label: status,
    className: 'bg-zinc-100 text-zinc-500',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
