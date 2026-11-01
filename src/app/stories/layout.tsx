import { storyFonts } from "@/modules/stories/fonts";

export default function StoriesLayout({ children }: LayoutProps<"/stories">) {
  return <div className={storyFonts}>{children}</div>;
}
