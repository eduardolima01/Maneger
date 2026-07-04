import { MdDarkMode, MdLightMode } from "react-icons/md";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      onClick={() =>
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
      }
      className="rounded-lg p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800"
    >
      {resolvedTheme === "dark" ? (
        <MdLightMode size={20} />
      ) : (
        <MdDarkMode size={20} />
      )}
    </button>
  );
}
