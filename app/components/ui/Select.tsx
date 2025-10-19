'use client';

import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helpText?: string;
  options: { value: string; label: string }[];
}

export function Select({
  label,
  error,
  helpText,
  options,
  className = '',
  id,
  ...props
}: SelectProps) {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="label">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`input-field ${error ? 'border-error ring-error' : ''} ${className}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${selectId}-error` : helpText ? `${selectId}-help` : undefined}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${selectId}-error`} className="mt-1 text-xs text-error" role="alert">
          {error}
        </p>
      )}
      {helpText && !error && (
        <p id={`${selectId}-help`} className="mt-1 text-xs text-gray-500">
          {helpText}
        </p>
      )}
    </div>
  );
}

