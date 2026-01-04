# TanStack Query Integration

This module provides TanStack Query (React Query) integration for the application, enabling efficient data fetching, caching, and state management.

## Features

- ✅ Automatic caching and background refetching
- ✅ Optimistic updates for mutations
- ✅ Integration with Remix loaders
- ✅ Type-safe API queries
- ✅ React Hook Form integration
- ✅ React Query Devtools in development

## Usage

### Basic Query

```tsx
import { useUploadProvider } from "~/lib/query";

function MyComponent() {
  const { data, isLoading, error } = useUploadProvider();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return <div>Provider: {data?.provider}</div>;
}
```

### Custom API Query

```tsx
import { useApiQuery } from "~/lib/query";

function ThreadView({ eventId }: { eventId: string }) {
  const { data, isLoading } = useApiQuery(
    `/api/thread-view?event_id=${eventId}`,
    {
      queryKey: ["thread-view", eventId],
      enabled: !!eventId,
      staleTime: 1000 * 60 * 2, // 2 minutes
    }
  );
  
  // ...
}
```

### Mutation with Form

```tsx
import { useZodForm } from "~/lib/validation";
import { useFormMutation } from "~/lib/query";
import { updateSettingsSchema } from "~/lib/validation/schemas/settings.schemas";

function SettingsForm() {
  const form = useZodForm(updateSettingsSchema);
  const { mutate, isPending } = useFormMutation({
    form,
    endpoint: "/dashboard/settings",
    action: "update_settings",
    invalidateQueries: [["settings"]],
    onSuccess: () => {
      toast.success("Settings updated!");
    },
  });
  
  const onSubmit = form.handleSubmit((data) => {
    mutate(data);
  });
  
  return (
    <form onSubmit={onSubmit}>
      {/* form fields */}
    </form>
  );
}
```

### Optimistic Updates

```tsx
const { mutate } = useFormMutation({
  form,
  endpoint: "/api/update-post",
  optimisticUpdate: {
    queryKey: ["posts", postId],
    updateFn: (oldData, newData) => ({
      ...oldData,
      ...newData,
    }),
  },
});
```

## Configuration

The QueryClient is configured with:
- **Stale time**: 5 minutes (data is fresh for 5 minutes)
- **Cache time**: 10 minutes (data stays in cache for 10 minutes)
- **Retry**: 1 attempt for failed requests
- **Refetch on window focus**: Only in development

## Integration with Remix

TanStack Query works alongside Remix loaders:
- Use `useLoaderData()` for initial server-rendered data
- Use TanStack Query for client-side refetching and caching
- Use `useRemixQuery()` to combine both approaches



