import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export type ProgressEventType = 'generating' | 'progress' | 'ready' | 'failed';

export interface ProgressEvent {
  type: ProgressEventType;
  progress?: number;
  message?: string;
}

@Injectable()
export class BookProgressService {
  private readonly subjects = new Map<string, Subject<ProgressEvent>>();

  emit(bookId: string, event: ProgressEvent): void {
    const subject = this.subjects.get(bookId);
    if (!subject) return;
    subject.next(event);
    if (event.type === 'ready' || event.type === 'failed') {
      subject.complete();
      this.subjects.delete(bookId);
    }
  }

  stream(bookId: string): Observable<ProgressEvent> {
    if (!this.subjects.has(bookId)) {
      this.subjects.set(bookId, new Subject<ProgressEvent>());
    }
    return this.subjects.get(bookId)!.asObservable();
  }
}
