import {
  convertWeightValue,
  formatEntryDate,
  formatWeightValue,
  type WeightEntry,
  type WeightUnit,
} from "../appSupport";

type WeightEntryRowProps = {
  entry: WeightEntry;
  chronologicalEntries: WeightEntry[];
  displayUnit: WeightUnit;
  onEdit: (entry: WeightEntry) => void;
  onDelete: (entry: WeightEntry) => void;
};

export function WeightEntryRow({
  entry,
  chronologicalEntries,
  displayUnit,
  onEdit,
  onDelete,
}: WeightEntryRowProps) {
  const index = chronologicalEntries.findIndex((item) => item.id === entry.id);
  const previous = index > 0 ? chronologicalEntries[index - 1] : null;
  const entryWeight = convertWeightValue(entry.weight, entry.unit, displayUnit);
  const previousWeight = previous ? convertWeightValue(previous.weight, previous.unit, displayUnit) : null;
  const change = previousWeight === null ? null : entryWeight - previousWeight;

  return (
    <div className="weight-entry-row">
      <div className="weight-entry-info">
        <strong>
          {formatEntryDate(entry.date)} — {formatWeightValue(entryWeight, displayUnit)}
        </strong>
        {change !== null && (
          <span
            className={
              change < 0
                ? "weight-change-loss"
                : change > 0
                  ? "weight-change-gain"
                  : "weight-change-neutral"
            }
          >
            {change > 0 ? "+" : ""}
            {formatWeightValue(change, displayUnit)}
          </span>
        )}
        {entry.note && <small className="weight-entry-note">{entry.note}</small>}
      </div>

      <div className="weight-entry-actions">
        <button type="button" onClick={() => onEdit(entry)}>
          Edit
        </button>
        <button type="button" onClick={() => onDelete(entry)}>
          Delete
        </button>
      </div>
    </div>
  );
}
