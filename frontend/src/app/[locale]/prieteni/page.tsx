import type { Metadata } from "next";
import { FriendsPageClient } from "./prieteni-client";

export const metadata: Metadata = {
  title: "Prieteni — ReInfo",
};

export default function FriendsPage() {
  return <FriendsPageClient />;
}
