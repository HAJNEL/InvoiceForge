import React, { useEffect, useState, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

export function GoogleMapsAutocomplete({
  value,
  onChange,
  placeholder = "Search location...",
  className = ""
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const placesLib = useMapsLibrary('places');
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (placesLib && !autocompleteService.current) {
      autocompleteService.current = new placesLib.AutocompleteService();
    }
  }, [placesLib]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);

    if (!val.trim() || !autocompleteService.current) {
      setPredictions([]);
      return;
    }

    try {
      autocompleteService.current.getPlacePredictions(
        { 
          input: val,
          componentRestrictions: { country: 'za' } // South Africa default constraint based on ZAR context or general.
        }, 
        (preds, status) => {
          if (status === 'OK' && preds) {
            setPredictions(preds);
            setIsOpen(true);
          } else {
            setPredictions([]);
          }
        }
      );
    } catch (err) {
      console.error('[GoogleMapsAutocomplete] autocomplete service fetch failed:', err);
    }
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          if (predictions.length > 0) setIsOpen(true);
        }}
        onBlur={() => {
          // small delay to allow predicting list selection clicks
          setTimeout(() => setIsOpen(false), 200);
        }}
        className={className || "w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold focus:ring-2 focus:ring-brand-accent/20 focus:bg-white text-xs text-zinc-900"}
        placeholder={placeholder}
      />
      {isOpen && predictions.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-zinc-200 rounded-xl shadow-lg z-[99999] text-left text-zinc-800">
          {predictions.map((p) => (
            <div
              key={p.place_id}
              onMouseDown={() => {
                setInputValue(p.description);
                onChange(p.description);
                setPredictions([]);
                setIsOpen(false);
              }}
              className="p-2.5 hover:bg-zinc-50 cursor-pointer text-xs font-semibold border-b border-zinc-100 last:border-none flex items-center gap-2"
            >
              <span className="text-zinc-400 shrink-0">📍</span>
              <span className="truncate">{p.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
