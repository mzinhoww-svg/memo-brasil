/* Base compartilhada do console Master: estados, folha de ação e as três folhas únicas (Exportar, Revelar agora, Conciliar agora).
   API e exemplos: docs/handoff/MASTER-BASE.md */
export { MasterModal, ModalButtons, type MasterModalProps } from "./MasterModal";
export { MasterState, MasterStatePage, skeletonWidth, DENIED_TEXT, DENIED_TITLE, ERROR_TEXT, ERROR_TITLE, type MasterStateProps, type MasterStatePageProps, type StateVariant } from "./MasterState";
export { ActionSheet, ReasonField, ErrLine, useReasonField, AUDIT_NOTE, type ActionSheetProps, type ReasonFieldProps } from "./ActionSheet";
export { ExportSheet, useExport, EXPORT_FORMAT, type ExportSheetProps, type UseExportArgs } from "./ExportSheet";
export { RevealNowSheet, useRevealNow, revealNowRpc, revealFailureOf, REVEAL_MESSAGES, type RevealNowSheetProps, type UseRevealNowArgs, type RevealOutcome, type RevealFailure } from "./RevealNowSheet";
export { ReconcileSheet, useReconcile, clock, RECONCILE_WAIT_SECONDS, type ReconcileSheetProps, type ReconcileStep, type ReconcileResult, type UseReconcileArgs } from "./ReconcileSheet";
