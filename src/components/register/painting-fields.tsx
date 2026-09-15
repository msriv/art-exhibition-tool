"use client";

export type PaintingDraft = {
  title: string;
  medium: string;
  file: File | null;
};

export function emptyPaintingDraft(): PaintingDraft {
  return { title: "", medium: "", file: null };
}

type PaintingFieldsProps = {
  index: number;
  value: PaintingDraft;
  onChange: (patch: Partial<PaintingDraft>) => void;
  onRemove?: () => void;
  /** Constrains medium to a select of these options; free-text input if omitted (Participation, §9). */
  mediumOptions?: readonly string[];
};

export function PaintingFields({ index, value, onChange, onRemove, mediumOptions }: PaintingFieldsProps) {
  return (
    <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-4">
      <legend className="fieldset-legend">
        Painting {index + 1}
        {onRemove && (
          <button type="button" onClick={onRemove} className="btn btn-ghost btn-xs text-error">
            Remove
          </button>
        )}
      </legend>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="fieldset-label flex-col items-start">
          Title
          <input
            type="text"
            required
            value={value.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="input w-full"
          />
        </label>

        <label className="fieldset-label flex-col items-start">
          Medium
          {mediumOptions ? (
            <select
              required
              value={value.medium}
              onChange={(e) => onChange({ medium: e.target.value })}
              className="select w-full"
            >
              <option value="" disabled>
                Select a medium
              </option>
              {mediumOptions.map((medium) => (
                <option key={medium} value={medium}>
                  {medium}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              required
              value={value.medium}
              onChange={(e) => onChange({ medium: e.target.value })}
              placeholder="e.g. Watercolour"
              className="input w-full"
            />
          )}
        </label>
      </div>

      <label className="fieldset-label flex-col items-start">
        Artwork file
        <input
          type="file"
          required
          accept="image/*"
          onChange={(e) => onChange({ file: e.target.files?.[0] ?? null })}
          className="file-input w-full"
        />
      </label>
    </fieldset>
  );
}
