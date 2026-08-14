export class ApiResponse<T = unknown> {
  code: number;
  msg: string;
  data: T;

  constructor(data: T, code = 0, msg = 'success') {
    this.code = code;
    this.msg = msg;
    this.data = data;
  }

  static ok<T>(data: T): ApiResponse<T> {
    return new ApiResponse(data, 0, 'success');
  }

  static fail(msg: string, code = 1): ApiResponse<null> {
    return new ApiResponse(null, code, msg);
  }

  static error(msg: string, code = 500): ApiResponse<null> {
    return new ApiResponse(null, code, msg);
  }
}

export class PaginatedResponse<T> {
  content: T[];
  list: T[];
  records: T[];
  totalPages: number;
  totalPage: number;
  totalSize: number;
  total: number;
  totalCount: number;
  pageNo: number;
  pageSize: number;

  constructor(items: T[], total: number, pageNo: number, pageSize: number) {
    this.content = items;
    this.list = items;
    this.records = items;
    this.totalSize = total;
    this.total = total;
    this.totalCount = total;
    this.pageNo = pageNo;
    this.pageSize = pageSize;
    this.totalPages = Math.ceil(total / pageSize);
    this.totalPage = this.totalPages;
  }
}
