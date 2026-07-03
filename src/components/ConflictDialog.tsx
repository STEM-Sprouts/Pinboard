/**
 * Save-conflict prompt (persistence.md §4): the cloud copy changed since
 * this browser last synced. No auto-merge in MVP+ — the student chooses,
 * and until they do, cloud saves pause while local saves keep working.
 */
export default function ConflictDialog({
  onKeepLocal,
  onUseCloud,
  onDuplicate,
}: {
  onKeepLocal: () => void;
  onUseCloud: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-testid="conflict-dialog">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-bold text-gray-800 mb-2">This project changed in the cloud</h2>
        <p className="text-sm text-gray-600 mb-4">
          Another device saved a newer copy of this project to your account. Your local work is safe — pick
          which copy to keep. (Local saves keep working either way.)
        </p>
        <div className="space-y-2">
          <button
            onClick={onKeepLocal}
            className="w-full px-4 py-2 bg-accent text-white rounded-md font-semibold text-sm hover:bg-[#00654c]"
          >
            Keep my local copy (overwrite cloud)
          </button>
          <button
            onClick={onUseCloud}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md font-semibold text-sm hover:bg-gray-200"
          >
            Use the cloud copy (replace what I have here)
          </button>
          <button
            onClick={onDuplicate}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md font-semibold text-sm hover:bg-gray-200"
          >
            Save my local copy as a duplicate
          </button>
        </div>
      </div>
    </div>
  );
}
