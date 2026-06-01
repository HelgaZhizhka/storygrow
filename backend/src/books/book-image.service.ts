import { Injectable } from '@nestjs/common';
import { S3Service } from '../s3/s3.service';

@Injectable()
export class BookImageService {
  constructor(private readonly s3: S3Service) {}

  async signKeys(keys: readonly string[]): Promise<string[]> {
    return Promise.all(keys.map((key) => this.s3.getSignedUrl(key)));
  }
}
