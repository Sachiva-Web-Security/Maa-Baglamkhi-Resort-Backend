export function withAudit(action, config = {}) {
  return {
    ...config,
    auditAction: action,
  };
}
