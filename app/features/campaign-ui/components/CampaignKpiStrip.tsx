import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export interface CampaignKpiItem {
  id: string;
  label: string;
  value: string | number;
}

export function CampaignKpiStrip({
  items,
  columnsClassName = "sm:grid-cols-2 lg:grid-cols-5",
}: {
  items: CampaignKpiItem[];
  columnsClassName?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className={`grid gap-3 ${columnsClassName}`}>
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader className="pb-2">
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {item.value}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
