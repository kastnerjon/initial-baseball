import type { ChangeEvent, JSX } from 'react';

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchInput({ value, onChange }: SearchInputProps): JSX.Element {
  return (
    <label className="search-field">
      <span className="field-label">Guess the player</span>
      <input
        type="text"
        value={value}
        placeholder="Type a player name"
        autoComplete="off"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const nextValue = 'value' in event.target && typeof event.target.value === 'string'
            ? event.target.value
            : '';
          onChange(nextValue);
        }}
      />
    </label>
  );
}
