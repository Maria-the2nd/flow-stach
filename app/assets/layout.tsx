import { FavoritesProvider } from "@/components/favorites/FavoritesProvider";
import { InitUser } from "@/components/auth/InitUser";

export default function AssetsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FavoritesProvider>
      <InitUser />
      {children}
    </FavoritesProvider>
  );
}
