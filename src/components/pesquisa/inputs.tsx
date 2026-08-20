"use client";

/**
 * Controles de resposta da pesquisa: escala numérica, escolha única,
 * escolha múltipla (com limite e opções exclusivas) e campos de texto.
 * Todos usam inputs nativos (radio/checkbox) — navegação por teclado e
 * leitores de tela funcionam sem ARIA artificial.
 */

import { useId, type ReactNode } from "react";
import type { Option } from "./survey-data";

/** Bloco de pergunta: título + apoio + conteúdo, com semântica de fieldset. */
export function QuestionBlock({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="border-0 p-0 m-0">
      <legend className="np-display text-balance text-xl md:text-2xl leading-snug">
        {title}
      </legend>
      {hint && (
        <p className="mt-2 text-sm md:text-[0.95rem] text-[var(--ap-text-dim)]">
          {hint}
        </p>
      )}
      <div className="mt-6">{children}</div>
    </fieldset>
  );
}

/** Escala numérica (0–10 ou 1–5) com âncoras nas pontas. */
export function ScaleInput({
  name,
  min,
  max,
  value,
  onChange,
  minLabel,
  maxLabel,
}: {
  name: string;
  min: number;
  max: number;
  value: number | null;
  onChange: (v: number) => void;
  minLabel: string;
  maxLabel: string;
}) {
  const groupId = useId();
  const size = max - min + 1;
  return (
    <div>
      <div
        className="np-scale"
        data-size={size <= 6 ? "5" : undefined}
        role="radiogroup"
        aria-labelledby={groupId}
      >
        <span id={groupId} className="sr-only">
          Escala de {min} a {max}. {min} = {minLabel}. {max} = {maxLabel}.
        </span>
        {Array.from({ length: size }, (_, i) => {
          const n = min + i;
          const checked = value === n;
          return (
            <label key={n} className="np-scale-cell" data-checked={checked}>
              <input
                type="radio"
                name={name}
                value={n}
                checked={checked}
                onChange={() => onChange(n)}
                aria-label={`${n}${n === min ? ` — ${minLabel}` : ""}${
                  n === max ? ` — ${maxLabel}` : ""
                }`}
              />
              {n}
            </label>
          );
        })}
      </div>
      <div className="mt-2.5 flex justify-between gap-4 text-xs md:text-sm text-[var(--ap-text-dim)]">
        <span>
          {min} = {minLabel}
        </span>
        <span className="text-right">
          {max} = {maxLabel}
        </span>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden="true">
      <path
        d="M2 6.2 4.8 9 10 3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Escolha única em cartões. */
export function SingleChoice({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-2.5">
      {options.map((opt) => {
        const checked = value === opt.value;
        return (
          <label key={opt.value} className="np-option relative" data-checked={checked}>
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onChange(opt.value)}
            />
            <span className="np-dot" aria-hidden="true">
              <CheckIcon />
            </span>
            <span>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Escolha múltipla com limite e opções exclusivas (ex.: "Não identifico…").
 * Selecionar uma exclusiva desmarca as demais; selecionar qualquer outra
 * desmarca as exclusivas.
 */
export function MultiChoice({
  name,
  options,
  values,
  onChange,
  max,
  exclusiveValues = [],
}: {
  name: string;
  options: Option[];
  values: string[];
  onChange: (v: string[]) => void;
  max?: number;
  exclusiveValues?: string[];
}) {
  const toggle = (value: string) => {
    const isExclusive = exclusiveValues.includes(value);
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
      return;
    }
    if (isExclusive) {
      onChange([value]);
      return;
    }
    let next = values.filter((v) => !exclusiveValues.includes(v));
    if (max && next.length >= max) return; // limite atingido — nada muda
    next = [...next, value];
    onChange(next);
  };

  const limitReached = Boolean(max && values.length >= max);

  return (
    <div className="grid gap-2.5">
      {options.map((opt) => {
        const checked = values.includes(opt.value);
        const blocked =
          !checked && limitReached && !exclusiveValues.includes(opt.value);
        return (
          <label
            key={opt.value}
            className={`np-option relative ${blocked ? "opacity-45" : ""}`}
            data-checked={checked}
          >
            <input
              type="checkbox"
              name={name}
              value={opt.value}
              checked={checked}
              disabled={blocked}
              onChange={() => toggle(opt.value)}
            />
            <span className="np-dot" data-shape="square" aria-hidden="true">
              <CheckIcon />
            </span>
            <span>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}

/** Campo de texto longo. */
export function OpenText({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="mb-2 block text-sm font-medium text-[var(--ap-text)]"
        >
          {label}
        </label>
      )}
      <textarea
        id={id}
        className="np-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={2000}
        aria-label={label ? undefined : placeholder}
      />
    </div>
  );
}

/** Campo de texto curto. */
export function ShortText({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-[var(--ap-text)]"
      >
        {label}
      </label>
      <input
        id={id}
        className="np-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={300}
        autoComplete={autoComplete}
      />
    </div>
  );
}
