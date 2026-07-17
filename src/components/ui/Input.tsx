import { forwardRef } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-line bg-panel px-4 py-3 text-sm text-ink placeholder:text-muted outline-none transition-colors focus:border-brand",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-line bg-panel px-4 py-3 text-sm text-ink placeholder:text-muted outline-none transition-colors focus:border-brand",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
