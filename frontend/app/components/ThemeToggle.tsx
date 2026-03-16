import { useTheme } from "~/contexts/ThemeContext";

export default function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const isDark = theme === "dark";

    function toggle() {
        setTheme(isDark ? "light" : "dark");
    }

    return (
        <button
            onClick={toggle}
            title={isDark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all"
            style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-2)",
                cursor: "pointer",
            }}
        >
            {isDark ? "☀️" : "🌙"}
        </button>
    );
}
