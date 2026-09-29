import { WORKFLOW_STATES, STATUS_META } from '../../constants/workflow.js';

const LEGACY_MAP = {
  pending: WORKFLOW_STATES.SUBMITTED,
  "in-progress": WORKFLOW_STATES.IN_PROGRESS,
  "in progress": WORKFLOW_STATES.IN_PROGRESS,
  resolved: WORKFLOW_STATES.CLOSED,
  rejected: WORKFLOW_STATES.REJECTED
};

export default function StatusBadge({ status }) {
  if (!status) status = WORKFLOW_STATES.SUBMITTED;
  
  const rawKey = String(status).trim();
  const canonicalKey = WORKFLOW_STATES[rawKey.toUpperCase()] || LEGACY_MAP[rawKey.toLowerCase()] || WORKFLOW_STATES.SUBMITTED;
  const meta = STATUS_META[canonicalKey] || STATUS_META[WORKFLOW_STATES.SUBMITTED];

  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${meta.badge}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      {meta.label}
    </span>
  );
}

export { STATUS_META, WORKFLOW_STATES };
