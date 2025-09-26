import { StatusBadge } from '../StatusBadge';

export default function StatusBadgeExample() {
  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Payment Status Badges</h3>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="paid" />
          <StatusBadge status="pending" />
          <StatusBadge status="overdue" />
        </div>
      </div>
    </div>
  );
}