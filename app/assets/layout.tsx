import { FavoritesProvider } from "@/components/favorites/FavoritesProvider";

export default function AssetsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FavoritesProvider>{children}</FavoritesProvider>;
}
