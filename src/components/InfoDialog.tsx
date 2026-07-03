import { X } from 'lucide-react';

export default function InfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-testid="info-dialog">
      <div className="ss-card p-6 max-w-lg w-full mx-4 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">Info</p>
            <h2 className="text-xl font-bold text-ink mt-1">About Pinboard</h2>
          </div>
          <button
            onClick={onClose}
            className="text-ink font-bold text-sm px-1 hover:opacity-60"
            title="Close info"
            aria-label="Close info"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm text-gray-700 leading-6">
          <p>
            Pinboard is developed by <span className="font-semibold text-ink">STEM Sprouts</span>.
          </p>
          <p>
            Donation link:{' '}
            <a
              href="https://hcb.hackclub.com/donations/start/stem-sprouts"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline underline-offset-2"
            >
              hcb.hackclub.com/donations/start/stem-sprouts
            </a>
          </p>
          <p>
            Privacy policy:{' '}
            <a
              href="https://www.stem-sprouts.org/privacy"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline underline-offset-2"
            >
              stem-sprouts.org/privacy
            </a>
          </p>
          <p>
            Inquiries:{' '}
            <a href="mailto:hello@stem-sprouts.org" className="text-accent underline underline-offset-2">
              hello@stem-sprouts.org
            </a>
          </p>
          <p>
            Contributing:{' '}
            <a
              href="https://github.com/STEM-Sprouts/Pinboard"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline underline-offset-2"
            >
              STEM-Sprouts/Pinboard
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
