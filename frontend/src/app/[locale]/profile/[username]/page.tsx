import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ username: string; locale: string }>;
}

export default async function ProfileRedirectPage({ params }: Props) {
  const { username, locale } = await params;
  redirect(`/${locale}/u/${username}`);
}
