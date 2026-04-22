/**
 * Form field primitives — canonical Label + Control + Description + Error
 * shape used across SmartFlowSocial forms.
 *
 * Phase 1j-1. Before this primitive, the codebase had ~20 ad-hoc form-field
 * shapes that all rendered the same DOM (a label, a control, an optional
 * helper line, an optional error line) with subtly different colors,
 * spacing, and aria wiring. Most omitted `aria-describedby` /
 * `aria-invalid`, so screen-readers couldn't connect controls to their
 * helper or error text.
 *
 * The primitives below collapse the shape to:
 *
 *   <FormField error={errors.email?.message}>
 *     <FormLabel>Email</FormLabel>
 *     <FormControl>
 *       <Input type="email" value={...} onChange={...} />
 *     </FormControl>
 *     <FormDescription>We'll never share your email.</FormDescription>
 *     <FormMessage />
 *   </FormField>
 *
 * <FormField> generates a stable id and exposes it (plus descriptionId /
 * errorId / invalid) to descendants via context. <FormControl> uses
 * Radix's <Slot> to inject those ids and `aria-describedby` /
 * `aria-invalid` onto whatever control sits inside (Input, Textarea,
 * Select trigger, custom component, …) without forcing callers to
 * juggle ids by hand. <FormMessage> auto-hides when there's no error.
 * Shared primitives (Input, Textarea, SelectTrigger, Checkbox) use the
 * `focus-ring` class: with `aria-invalid="true"`, a danger border and
 * danger-tinted focus ring are applied in `app/tailwind.css` (Phase 1j-3).
 *
 * Layout: <FormField> uses `stack-tight` (≈8px gap) so label / control /
 * description / error are spaced consistently regardless of caller.
 * Override with `className` if a tighter or looser rhythm is needed.
 *
 * Required state: pass `required` to <FormField> (or to <FormLabel>) and
 * a small visual asterisk renders next to the label. The DOM `required`
 * attribute is NOT auto-injected onto the control — callers still pass
 * `required` to the input itself; the FormField's `required` prop only
 * drives the label decoration.
 */
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

interface FormFieldContextValue {
  id: string;
  descriptionId: string;
  errorId: string;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
  hasDescription: boolean;
  hasError: boolean;
  errorMessage: React.ReactNode | null;
  registerDescription: (present: boolean) => void;
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(
  null
);

function useFormFieldContext(component: string): FormFieldContextValue {
  const ctx = React.useContext(FormFieldContext);
  if (!ctx) {
    throw new Error(`<${component}> must be used inside <FormField>`);
  }
  return ctx;
}

function useFormFieldId(explicit?: string): string {
  const reactId = React.useId();
  return React.useMemo(
    () => explicit ?? `field-${reactId.replace(/:/g, "")}`,
    [explicit, reactId]
  );
}

export interface FormFieldProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "id"
> {
  /** Stable id for the control. Auto-generated if omitted. */
  id?: string;
  /** Error message — string, ReactNode, or `null`/`undefined` for none. */
  error?: React.ReactNode | null;
  /** Marks the field as required (drives the label asterisk). */
  required?: boolean;
  /** Marks the field as disabled (forwarded to label opacity). */
  disabled?: boolean;
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  (
    {
      id: explicitId,
      error,
      required = false,
      disabled = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const id = useFormFieldId(explicitId);
    const descriptionId = `${id}-description`;
    const errorId = `${id}-error`;
    const hasError = error !== null && error !== undefined && error !== false;
    const errorMessage = hasError ? (error as React.ReactNode) : null;

    const [hasDescription, setHasDescription] = React.useState(false);
    const registerDescription = React.useCallback((present: boolean) => {
      setHasDescription(present);
    }, []);

    const value = React.useMemo<FormFieldContextValue>(
      () => ({
        id,
        descriptionId,
        errorId,
        invalid: hasError,
        required,
        disabled,
        hasDescription,
        hasError,
        errorMessage,
        registerDescription,
      }),
      [
        id,
        descriptionId,
        errorId,
        hasError,
        required,
        disabled,
        hasDescription,
        errorMessage,
        registerDescription,
      ]
    );

    return (
      <FormFieldContext.Provider value={value}>
        <div
          ref={ref}
          className={cn("stack-tight", className)}
          data-invalid={hasError ? "" : undefined}
          data-disabled={disabled ? "" : undefined}
          {...props}
        >
          {children}
        </div>
      </FormFieldContext.Provider>
    );
  }
);
FormField.displayName = "FormField";

export interface FormLabelProps extends Omit<
  React.ComponentPropsWithoutRef<typeof Label>,
  "htmlFor" | "children"
> {
  /** Mark required visually (overrides the field-level `required`). */
  required?: boolean;
  children: React.ReactNode;
}

const FormLabel = React.forwardRef<
  React.ElementRef<typeof Label>,
  FormLabelProps
>(({ className, required, children, ...props }, ref) => {
  const ctx = useFormFieldContext("FormLabel");
  const showRequired = required ?? ctx.required;
  return (
    <Label
      ref={ref}
      htmlFor={ctx.id}
      className={cn(
        "text-text",
        ctx.disabled && "opacity-60",
        ctx.hasError && "text-danger-text",
        className
      )}
      {...props}
    >
      {children}
      {showRequired ? (
        <span aria-hidden className="text-danger ml-0.5">
          *
        </span>
      ) : null}
    </Label>
  );
});
FormLabel.displayName = "FormLabel";

export interface FormControlProps {
  children: React.ReactElement;
}

/**
 * Slot wrapper that injects `id`, `aria-describedby`, and `aria-invalid`
 * onto its single child control.
 */
function FormControl({ children }: FormControlProps) {
  const ctx = useFormFieldContext("FormControl");
  const ariaDescribedBy =
    [
      ctx.hasDescription ? ctx.descriptionId : null,
      ctx.hasError ? ctx.errorId : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <Slot
      id={ctx.id}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ctx.invalid || undefined}
    >
      {children}
    </Slot>
  );
}

export interface FormDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  FormDescriptionProps
>(({ className, ...props }, ref) => {
  const ctx = useFormFieldContext("FormDescription");
  React.useEffect(() => {
    ctx.registerDescription(true);
    return () => ctx.registerDescription(false);
  }, [ctx]);
  return (
    <p
      ref={ref}
      id={ctx.descriptionId}
      className={cn(
        "text-text-secondary text-xs leading-relaxed",
        ctx.disabled && "opacity-60",
        className
      )}
      {...props}
    />
  );
});
FormDescription.displayName = "FormDescription";

export interface FormMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Override the message from context (rare). */
  children?: React.ReactNode;
}

const FormMessage = React.forwardRef<HTMLParagraphElement, FormMessageProps>(
  ({ className, children, ...props }, ref) => {
    const ctx = useFormFieldContext("FormMessage");
    const body = children ?? ctx.errorMessage;
    if (!body) return null;
    return (
      <p
        ref={ref}
        id={ctx.errorId}
        role="alert"
        className={cn("text-danger-text text-xs leading-relaxed", className)}
        {...props}
      >
        {body}
      </p>
    );
  }
);
FormMessage.displayName = "FormMessage";

export { FormField, FormLabel, FormControl, FormDescription, FormMessage };
