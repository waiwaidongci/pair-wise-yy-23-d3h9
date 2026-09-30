import { ERROR_MESSAGES } from "../constants/errorMessages";
import type { ErrorCode } from "../constants/errorCodes";

/** 把错误消息模板里的 {name} 占位符替换成上下文参数 */
export function renderMessage(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : `{${key}}`
  );
}

/**
 * service / api / controller 三层分别包装异常，
 * 不允许只在一个全局位置吞掉全部异常。
 */
export class LayeredError extends Error {
  readonly code: ErrorCode;
  readonly cause: unknown;

  constructor(code: ErrorCode, params: Record<string, string | number> = {}, cause?: unknown) {
    super(renderMessage(ERROR_MESSAGES[code] ?? code, params));
    this.name = "LayeredError";
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

/** service 层抛出的业务异常（校验、锁冲突、台账状态等） */
export class ServiceError extends LayeredError {
  constructor(code: ErrorCode, params: Record<string, string | number> = {}, cause?: unknown) {
    super(code, params, cause);
    this.name = "ServiceError";
  }
}

/** api 层再次包装，模拟前后端分离时的接口异常 */
export class ApiError extends LayeredError {
  readonly apiCode: ErrorCode;

  constructor(apiCode: ErrorCode, cause: unknown, params: Record<string, string | number> = {}) {
    super("API_ERROR", { detail: cause instanceof Error ? cause.message : String(cause), ...params }, cause);
    this.name = "ApiError";
    this.apiCode = apiCode;
  }
}

/** controller（页面 hook）层再次包装后才允许提示给用户 */
export class ControllerError extends LayeredError {
  readonly controllerCode: ErrorCode;

  constructor(controllerCode: ErrorCode, cause: unknown, params: Record<string, string | number> = {}) {
    super("CONTROLLER_ERROR", { detail: cause instanceof Error ? cause.message : String(cause), ...params }, cause);
    this.name = "ControllerError";
    this.controllerCode = controllerCode;
  }
}
