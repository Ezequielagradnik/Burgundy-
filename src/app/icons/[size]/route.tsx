import { brandIcon } from "@/lib/icon";

export async function GET(_request: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size } = await ctx.params;
  const px = size === "512" ? 512 : 192;
  return brandIcon(px);
}
