import type { BookStatus } from '@/lib/types';

const CONFIG: Record<BookStatus, { label: string; variant: string }> = {
  ready: { label: 'Готова', variant: 'sg-badge-success' },
  generating: { label: 'Создаётся…', variant: 'sg-badge-primary' },
  pending: { label: 'Ожидает', variant: 'sg-badge-warning' },
  failed: { label: 'Ошибка', variant: 'sg-badge-danger' },
  images_failed: { label: 'Ошибка изображений', variant: 'sg-badge-danger' },
};

interface Props {
  status: BookStatus;
}

export function StatusBadge({ status }: Props): React.ReactElement {
  const { label, variant } = CONFIG[status] ?? { label: status, variant: '' };
  return <span className={`sg-badge sg-badge-dot ${variant}`}>{label}</span>;
}
