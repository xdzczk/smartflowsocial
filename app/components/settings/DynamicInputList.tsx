import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
interface DynamicInputListProps {
  items: string[];
  setItems: (items: string[]) => void;
  placeholder: string;
  validate?: (value: string) => boolean;
  disabled?: boolean;
  inputType?: string;
  preventSpaces?: boolean;
  label?: string;
  description?: string;
}

export function DynamicInputList({
  items,
  setItems,
  placeholder,
  validate,
  disabled = false,
  inputType = "text",
  preventSpaces = false,
  label,
  description,
}: DynamicInputListProps) {
  const [errors, setErrors] = useState<(string | null)[]>([]);

  const addItem = () => {
    setItems([...items, ""]);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    setErrors(errors.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, value: string) => {
    const cleanedValue = preventSpaces ? value.replace(/\s/g, "") : value;

    const newItems = [...items];
    newItems[index] = cleanedValue;
    setItems(newItems);

    if (validate) {
      const newErrors = [...errors];
      if (cleanedValue.trim() && !validate(cleanedValue.trim())) {
        newErrors[index] = getErrorMessage(validate);
      } else {
        newErrors[index] = null;
      }
      setErrors(newErrors);
    }
  };

  const getErrorMessage = (validator: (value: string) => boolean): string => {
    // You can customize these based on your validators
    if (validator.toString().includes("wss://")) {
      return "Must start with wss:// and have a valid domain";
    }
    if (validator.toString().includes("npub")) {
      return "Must be a valid npub address (starts with npub1)";
    }
    if (validator.toString().includes("parseInt")) {
      return "Must be a positive whole number";
    }
    return "Invalid format";
  };

  return (
    <div className="space-y-4">
      {label ? <Label className="text-base font-medium">{label}</Label> : null}
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`item-${index}`} className="flex items-start space-x-2">
            <div className="flex-1">
              <Input
                type={inputType}
                value={item ?? ""}
                onChange={(e) => updateItem(index, e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className={errors[index] ? "border-destructive" : ""}
              />
              {errors[index] ? (
                <p className="mt-1 text-sm text-destructive">{errors[index]}</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={() => removeItem(index)}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={addItem}
          disabled={disabled}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>
    </div>
  );
}
