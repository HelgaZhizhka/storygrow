export type BookStatus = 'pending' | 'generating' | 'ready' | 'failed' | 'images_failed';

export interface Quota {
  plan: string;
  used: number;
  limit: number;
}
