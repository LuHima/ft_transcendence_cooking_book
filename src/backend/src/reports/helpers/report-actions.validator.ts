import { ReportAction, ReportStatus } from '@prisma/client';

export interface ActionValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Validates report resolution action combinations:
 * - 'dismiss' must stand alone.
 * - 'warn' and 'ban' are strictly mutually exclusive.
 * - 'action_taken' status requires at least one resolution action.
 */
export function validateReportActions(
  actions: ReportAction[] | undefined | null,
  status?: ReportStatus,
): ActionValidationResult {
  if (actions === undefined || actions === null) {
    if (status === ReportStatus.action_taken) {
      return {
        valid: false,
        message: "Status 'action_taken' requires at least one resolution action",
      };
    }
    return { valid: true };
  }

  if (!Array.isArray(actions)) {
    return { valid: false, message: 'Actions must be an array' };
  }

  if (actions.includes(ReportAction.dismiss) && actions.length > 1) {
    return {
      valid: false,
      message:
        "Action 'dismiss' must stand alone and cannot be combined with other actions",
    };
  }

  if (
    actions.includes(ReportAction.warn) &&
    actions.includes(ReportAction.ban)
  ) {
    return {
      valid: false,
      message:
        "Actions 'warn' and 'ban' are mutually exclusive and cannot be combined",
    };
  }

  if (status === ReportStatus.action_taken && actions.length === 0) {
    return {
      valid: false,
      message: "Status 'action_taken' requires at least one resolution action",
    };
  }

  return { valid: true };
}
