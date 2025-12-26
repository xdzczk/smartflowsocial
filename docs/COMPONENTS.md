# Component Library Documentation

This guide documents the UI component library used in SmartFlowSocial.

## Table of Contents

- [Overview](#overview)
- [UI Components](#ui-components)
- [Layout Components](#layout-components)
- [Feature Components](#feature-components)
- [Styling Guidelines](#styling-guidelines)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)

---

## Overview

SmartFlowSocial uses a component-based architecture with:

- **Base UI Components**: Reusable primitives (Button, Input, Card, etc.)
- **Layout Components**: Header, Footer, Navigation
- **Feature Components**: Domain-specific components (PostBlock, Calendar, etc.)

### Technology Stack

- **React**: Component framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **Radix UI**: Accessible primitives
- **Headless UI**: Unstyled components

### Component Location

```
app/components/
├── ui/              # Base UI components
├── layout/          # Layout components
├── dashboard/       # Dashboard-specific components
├── settings/      # Settings components
└── types.ts         # Shared types
```

---

## UI Components

### Button

Primary button component with multiple variants.

**Location:** `app/components/ui/button.tsx`

**Props:**
```typescript
interface ButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
  className?: string;
  children: React.ReactNode;
}
```

**Usage:**
```tsx
import { Button } from "~/components/ui/button";

<Button variant="default" size="default">
  Click Me
</Button>

<Button variant="destructive" size="sm">
  Delete
</Button>

<Button variant="outline" size="lg">
  Cancel
</Button>
```

**Variants:**
- `default`: Primary action button
- `destructive`: Destructive actions (delete, remove)
- `outline`: Secondary actions
- `secondary`: Alternative primary
- `ghost`: Minimal styling
- `link`: Link-style button

---

### Input

Text input component.

**Location:** `app/components/ui/input.tsx`

**Props:**
```typescript
interface InputProps extends React.ComponentProps<"input"> {
  // Standard HTML input props
}
```

**Usage:**
```tsx
import { Input } from "~/components/ui/input";

<Input 
  type="text" 
  placeholder="Enter text..."
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

---

### Textarea

Multi-line text input.

**Location:** `app/components/ui/textarea.tsx`

**Usage:**
```tsx
import { Textarea } from "~/components/ui/textarea";

<Textarea 
  placeholder="Enter description..."
  rows={4}
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

---

### Card

Container component for grouping content.

**Location:** `app/components/ui/card.tsx`

**Sub-components:**
- `CardHeader`: Card header section
- `CardTitle`: Card title
- `CardDescription`: Card description
- `CardContent`: Main content area
- `CardFooter`: Footer section

**Usage:**
```tsx
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardContent,
  CardFooter 
} from "~/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

---

### Dialog

Modal dialog component.

**Location:** `app/components/ui/dialog.tsx`

**Sub-components:**
- `DialogTrigger`: Button that opens dialog
- `DialogContent`: Dialog content container
- `DialogHeader`: Header section
- `DialogTitle`: Dialog title
- `DialogDescription`: Dialog description
- `DialogFooter`: Footer section
- `DialogClose`: Close button

**Usage:**
```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>
        Dialog description text
      </DialogDescription>
    </DialogHeader>
    <div>
      Dialog content
    </div>
    <DialogFooter>
      <Button>Close</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### Select

Dropdown select component.

**Location:** `app/components/ui/select.tsx`

**Sub-components:**
- `SelectTrigger`: Select button
- `SelectValue`: Displayed value
- `SelectContent`: Dropdown content
- `SelectItem`: Individual option

**Usage:**
```tsx
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";

<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
    <SelectItem value="option3">Option 3</SelectItem>
  </SelectContent>
</Select>
```

---

### Tabs

Tab navigation component.

**Location:** `app/components/ui/tabs.tsx`

**Sub-components:**
- `TabsList`: Container for tabs
- `TabsTrigger`: Individual tab button
- `TabsContent`: Tab content panel

**Usage:**
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">
    Content for tab 1
  </TabsContent>
  <TabsContent value="tab2">
    Content for tab 2
  </TabsContent>
</Tabs>
```

---

### Checkbox

Checkbox input component.

**Location:** `app/components/ui/checkbox.tsx`

**Usage:**
```tsx
import { Checkbox } from "~/components/ui/checkbox";

<Checkbox 
  checked={checked}
  onCheckedChange={setChecked}
/>
```

---

### Switch

Toggle switch component.

**Location:** `app/components/ui/switch.tsx`

**Usage:**
```tsx
import { Switch } from "~/components/ui/switch";

<Switch 
  checked={enabled}
  onCheckedChange={setEnabled}
/>
```

---

### Badge

Badge/label component.

**Location:** `app/components/ui/badge.tsx`

**Props:**
```typescript
interface BadgeProps {
  variant?: "default" | "secondary" | "destructive" | "outline";
}
```

**Usage:**
```tsx
import { Badge } from "~/components/ui/badge";

<Badge variant="default">New</Badge>
<Badge variant="secondary">Draft</Badge>
<Badge variant="destructive">Error</Badge>
```

---

### Avatar

User avatar component.

**Location:** `app/components/ui/avatar.tsx`

**Usage:**
```tsx
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";

<Avatar>
  <AvatarImage src={user.picture} alt={user.name} />
  <AvatarFallback>{user.name[0]}</AvatarFallback>
</Avatar>
```

---

### Label

Form label component.

**Location:** `app/components/ui/label.tsx`

**Usage:**
```tsx
import { Label } from "~/components/ui/label";

<Label htmlFor="input-id">Label Text</Label>
<Input id="input-id" />
```

---

### Sheet

Slide-over panel component.

**Location:** `app/components/ui/sheet.tsx`

**Usage:**
```tsx
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";

<Sheet>
  <SheetTrigger asChild>
    <Button>Open Sheet</Button>
  </SheetTrigger>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>Sheet Title</SheetTitle>
    </SheetHeader>
    <div>Sheet content</div>
  </SheetContent>
</Sheet>
```

---

### Media Components

#### MediaPlayer

Video/image player component.

**Location:** `app/components/ui/MediaPlayer.tsx`

**Props:**
```typescript
interface MediaPlayerProps {
  src: string;
  type: "image" | "video";
  poster?: string;
}
```

**Usage:**
```tsx
import { MediaPlayer } from "~/components/ui/MediaPlayer";

<MediaPlayer 
  src={mediaUrl}
  type="video"
  poster={thumbnailUrl}
/>
```

#### MediaThumbnail

Thumbnail component for media.

**Location:** `app/components/ui/MediaThumbnail.tsx`

**Usage:**
```tsx
import { MediaThumbnail } from "~/components/ui/MediaThumbnail";

<MediaThumbnail 
  src={imageUrl}
  alt="Description"
  onClick={() => openModal(imageUrl)}
/>
```

#### MediaModal

Modal for viewing media.

**Location:** `app/components/ui/MediaModal.tsx`

**Usage:**
```tsx
import { MediaModal } from "~/components/ui/MediaModal";

<MediaModal 
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  src={mediaUrl}
  type="image"
/>
```

---

## Layout Components

### DashboardHeader

Main dashboard navigation header.

**Location:** `app/components/layout/DashboardHeader.tsx`

**Features:**
- Navigation menu
- User account menu
- Feature access controls
- Upgrade prompts

**Usage:**
```tsx
import DashboardHeader from "~/components/layout/DashboardHeader";

<DashboardHeader />
```

### DashboardFooter

Dashboard footer component.

**Location:** `app/components/layout/DashboardFooter.tsx`

### FrontendHeader

Public-facing header.

**Location:** `app/components/layout/FrontendHeader.tsx`

### FrontendFooter

Public-facing footer.

**Location:** `app/components/layout/FrontendFooter.tsx`

---

## Feature Components

### PostBlock

Calendar post block component.

**Location:** `app/features/posts/components/Calendar/PostBlock.tsx`

**Features:**
- Drag and drop
- Post preview
- Status indicators
- Reschedule functionality

### HashtagPresetSelector

Hashtag preset selection component.

**Location:** `app/components/dashboard/HashtagPresetSelector.tsx`

**Usage:**
```tsx
import HashtagPresetSelector from "~/components/dashboard/HashtagPresetSelector";

<HashtagPresetSelector
  presets={presets}
  selectedPresetId={selectedId}
  onPresetChange={setSelectedId}
/>
```

### RelaysSettings

Relay configuration component.

**Location:** `app/components/settings/RelaysSettings.tsx`

**Usage:**
```tsx
import RelaysSettings from "~/components/settings/RelaysSettings";

<RelaysSettings
  relays={userRelays}
  onRelaysChange={handleRelaysChange}
/>
```

---

## Styling Guidelines

### Tailwind CSS

All components use Tailwind CSS for styling.

**Class Naming:**
- Use utility classes
- Group related classes
- Use `cn()` helper for conditional classes

**Example:**
```tsx
import { cn } from "~/lib/utils";

<div className={cn(
  "base-classes",
  condition && "conditional-classes",
  className // Allow override
)}>
```

### Color Scheme

Components support light/dark mode via CSS variables:

- `bg-background`: Background color
- `text-foreground`: Text color
- `border`: Border color
- `primary`: Primary accent
- `secondary`: Secondary accent

### Spacing

Use Tailwind spacing scale:
- `p-4`: Padding
- `m-2`: Margin
- `gap-4`: Gap between items

### Typography

- `text-sm`: Small text
- `text-base`: Base text
- `text-lg`: Large text
- `font-semibold`: Semibold weight

---

## Usage Examples

### Form with Validation

```tsx
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";

function MyForm() {
  const [value, setValue] = useState("");
  
  return (
    <form>
      <div className="space-y-2">
        <Label htmlFor="input">Label</Label>
        <Input 
          id="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <Button type="submit">Submit</Button>
    </form>
  );
}
```

### Modal with Form

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

function MyModal({ isOpen, onClose }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modal Title</DialogTitle>
        </DialogHeader>
        <div>
          Modal content
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Card Layout

```tsx
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";

function MyCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
      </CardHeader>
      <CardContent>
        Card content
      </CardContent>
    </Card>
  );
}
```

---

## Best Practices

### 1. Component Composition

- ✅ Compose smaller components
- ✅ Use compound components (Card, Dialog)
- ✅ Keep components focused and reusable

### 2. Props Design

- ✅ Use TypeScript interfaces
- ✅ Provide sensible defaults
- ✅ Allow className override
- ✅ Support asChild pattern (Radix UI)

### 3. Accessibility

- ✅ Use semantic HTML
- ✅ Include ARIA labels
- ✅ Support keyboard navigation
- ✅ Ensure color contrast

### 4. Performance

- ✅ Memoize expensive components
- ✅ Lazy load heavy components
- ✅ Optimize re-renders
- ✅ Use React.memo when appropriate

### 5. Styling

- ✅ Use Tailwind utilities
- ✅ Support dark mode
- ✅ Use CSS variables for theming
- ✅ Maintain consistent spacing

---

## Additional Resources

- [Radix UI Documentation](https://www.radix-ui.com/)
- [Headless UI Documentation](https://headlessui.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Remix Documentation](https://remix.run/docs)

---

## Component Checklist

When creating new components:

- [ ] TypeScript types defined
- [ ] Props documented
- [ ] Accessibility tested
- [ ] Dark mode supported
- [ ] Responsive design
- [ ] Usage examples provided
- [ ] Tests written (if applicable)


