import {useEffect, useId, useState, type FC} from 'react';
import {hexToRgb, isChannel, normalizeHex, rgbToHex} from '../domain/color';
import {cn} from '../lib/utils';

type Props = {id: string; label: string; value: string; onChange: (hex: string) => void; hint?: string};

/**
 * Any color, three ways: the native picker, a HEX field (#abc or #aabbcc) and R/G/B fields.
 * Typing keeps a local draft; only a valid color is committed, so the project never holds a broken value.
 */
export const ColorField: FC<Props> = ({id, label, value, onChange, hint}) => {
  const [hexDraft, setHexDraft] = useState(value);
  const [rgbDraft, setRgbDraft] = useState(() => hexToRgb(value));
  const [rgbText, setRgbText] = useState(() => {
    const {r, g, b} = hexToRgb(value);
    return {r: String(r), g: String(g), b: String(b)};
  });
  const [error, setError] = useState<string | null>(null);
  const groupId = useId();

  // Follow outside changes (sample load, reset) without fighting the user's typing.
  useEffect(() => {
    setHexDraft(value);
    const rgb = hexToRgb(value);
    setRgbDraft(rgb);
    setRgbText({r: String(rgb.r), g: String(rgb.g), b: String(rgb.b)});
    setError(null);
  }, [value]);

  const commitHex = (text: string) => {
    setHexDraft(text);
    const hex = normalizeHex(text);
    if (hex) {
      setError(null);
      if (hex !== value) onChange(hex);
    } else {
      setError('Use a HEX color like #4F46E5 or #4AF.');
    }
  };

  const commitChannel = (channel: 'r' | 'g' | 'b', text: string) => {
    setRgbText((current) => ({...current, [channel]: text}));
    const n = Number(text);
    if (text.trim() === '' || !isChannel(n)) {
      setError('R, G and B must be whole numbers from 0 to 255.');
      return;
    }
    const next = {...rgbDraft, [channel]: n};
    setRgbDraft(next);
    const hex = rgbToHex(next);
    if (hex) {
      setError(null);
      if (hex !== value) onChange(hex);
    }
  };

  const errorId = `${id}-error`;
  return (
    <div role="group" aria-labelledby={`${groupId}-label`} className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between">
        <span id={`${groupId}-label`} className="text-sm font-medium text-ink">
          {label}
        </span>
        {hint ? <span className="text-xs text-faint">{hint}</span> : null}
      </div>
      <div className={cn('flex items-center gap-2 rounded-lg border bg-surface p-1.5', error ? 'border-bad' : 'border-line')}>
        <input
          type="color"
          value={value.toLowerCase()}
          onChange={(e) => commitHex(e.target.value)}
          aria-label={`${label} color picker`}
          className="h-8 w-9 shrink-0 cursor-pointer rounded-md border border-line bg-transparent"
        />
        <input
          id={id}
          value={hexDraft}
          onChange={(e) => commitHex(e.target.value)}
          onBlur={() => !error && setHexDraft(value)}
          spellCheck={false}
          maxLength={7}
          aria-label={`${label} HEX`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-8 w-[5.5rem] min-w-0 rounded-md bg-transparent px-1.5 font-mono text-[13px] uppercase text-ink focus:bg-sunken focus:outline-none"
        />
        <div className="ml-auto flex items-center gap-1">
          {(['r', 'g', 'b'] as const).map((channel) => (
            <input
              key={channel}
              inputMode="numeric"
              value={rgbText[channel]}
              onChange={(e) => commitChannel(channel, e.target.value)}
              aria-label={`${label} ${channel.toUpperCase()} (0 to 255)`}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              maxLength={3}
              className="h-8 w-10 rounded-md bg-sunken text-center font-mono text-[12px] tabular-nums text-ink focus:bg-signal-soft focus:outline-none"
            />
          ))}
        </div>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-[12px] text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
};
