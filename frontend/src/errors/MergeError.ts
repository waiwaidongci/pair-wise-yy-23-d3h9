import { ERROR_MESSAGES } from "../constants/errorMessages";
import { ERROR_CODES } from "../constants/errorCodes";

/**
 * 归并业务异常。
 * service 层抛出带错误码的异常，controller/store 层分别包装，
 * 不在全局吞掉异常。
 */
export class MergeError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] ?? code);
    this.name = "MergeError";
    this.code = code;
  }
}

export function isMergeError(error: unknown): error is MergeError {
  return error instanceof MergeError;
}

export function mergeErrorCode(error: unknown): string | null {
  return isMergeError(error) ? error.code : null;
}

export { ERROR_CODES };
