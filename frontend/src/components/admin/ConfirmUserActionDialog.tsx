import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import type { AdminManagedUser } from "../../types/admin-user";

export type PendingUserAction =
  | { type: "lock" | "unlock" | "delete"; user: AdminManagedUser }
  | null;

interface ConfirmUserActionDialogProps {
  action: PendingUserAction;
  loading: boolean;
  error: string | null;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

const content = {
  lock: {
    title: (name: string) => `Lock ${name}'s account?`,
    description: "This user will not be able to sign in until the account is unlocked.",
    label: "Lock Account",
    className: "bg-amber-600 hover:bg-amber-700",
  },
  unlock: {
    title: (name: string) => `Unlock ${name}'s account?`,
    description: "This user will be able to sign in again.",
    label: "Unlock Account",
    className: "bg-teal-600 hover:bg-teal-700",
  },
  delete: {
    title: (name: string) => `Delete ${name}?`,
    description: "This account will be soft-deleted and will no longer be available from this page.",
    label: "Delete User",
    className: "bg-red-600 hover:bg-red-700",
  },
};

export function ConfirmUserActionDialog({
  action,
  loading,
  error,
  onConfirm,
  onCancel,
}: ConfirmUserActionDialogProps) {
  const details = action ? content[action.type] : null;

  return (
    <Dialog open={action !== null} onOpenChange={(open) => { if (!open && !loading) onCancel(); }}>
      <DialogContent
        onEscapeKeyDown={(event) => { if (loading) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (loading) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{details && action ? details.title(action.user.full_name) : "Confirm action"}</DialogTitle>
          <DialogDescription>{details?.description}</DialogDescription>
        </DialogHeader>
        {action?.type === "delete" && (
          <p className="text-sm text-red-700">This action cannot be undone from User Management.</p>
        )}
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <DialogFooter>
          <button type="button" disabled={loading} onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:cursor-not-allowed disabled:opacity-50 ${details?.className ?? ""}`}
            onClick={() => void onConfirm()}
          >
            {loading ? "Working..." : details?.label}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
