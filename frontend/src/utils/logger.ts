import { LOG_TEMPLATES } from "../constants/logTemplates";

type LogEntity = keyof typeof LOG_TEMPLATES;

/**
 * 所有写操作都要经过这里记录日志。
 * 字段变更时必须同步改 constants/logTemplates 与调用处。
 */
export function writeLog(entity: LogEntity, template: string, context: Record<string, unknown> = {}): void {
  const prefix = LOG_TEMPLATES[entity].includes(template) ? template : entity;
  console.info(`[${entity}] ${prefix}`, context);
}

export function writeWarn(entity: LogEntity, template: string, context: Record<string, unknown> = {}): void {
  const prefix = LOG_TEMPLATES[entity].includes(template) ? template : entity;
  console.warn(`[${entity}] ${prefix}`, context);
}
