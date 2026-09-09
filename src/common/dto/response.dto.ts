export interface ResponseMeta {
  [key: string]: unknown;
}

export class ResponseDto<T> {
  success = true;
  data: T;
  meta?: ResponseMeta;

  constructor(data: T, meta?: ResponseMeta) {
    this.data = data;
    this.meta = meta;
  }
}
