import { Link } from "@/i18n/routing";
import NotificationsMenu from "./NotificationsMenu";

export default function TopBar({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between py-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="flex items-center gap-4">
        <NotificationsMenu />
      </div>
    </div>
  );
}