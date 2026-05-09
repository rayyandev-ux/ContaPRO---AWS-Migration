import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function MetricCard({
  title,
  value,
  note,
  trend,
}: {
  title: string;
  value: string;
  note: string;
  trend?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-600 font-medium flex items-center justify-between">
          <span>{title}</span>
          {trend ? (
            <span className="text-xs font-normal text-green-600">{trend}</span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <p className="mt-2 text-xs text-gray-500">{note}</p>
      </CardContent>
    </Card>
  );
}