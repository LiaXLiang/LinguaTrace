const LABEL_COLOR_OPTIONS = [
  "#3b82f6",
  "#8b5cf6",
  "#22c55e",
  "#f97316",
  "#ef4444",
  "#14b8a6",
  "#ec4899",
  "#eab308",
  "#06b6d4",
  "#64748b",
];

export default function SettingsPanel({
  customLabels,
  labelColors,
  setLabelColors,
  setView,
  signOut,
}) {
  function updateLabelColor(label, color) {
    setLabelColors((prev) => ({
      ...prev,
      [label]: color,
    }));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" onClick={() => setView("reader")}>
          <span className="brand-mark">LT</span>
          <div>
            <h1>LinguaTrace</h1>
            <p>语迹 · Language Learning Notebook</p>
          </div>
        </div>

        <nav className="topnav" aria-label="Main navigation">
          <button className="nav-link active" onClick={() => setView("settings")}>
            Settings
          </button>

          <button className="nav-link" onClick={() => setView("history")}>
            Note History
          </button>

          <button className="nav-link signout-link" onClick={signOut}>
            Sign Out
          </button>
        </nav>
      </header>

      <main className="settings-page">
        <div className="settings-page-header">
          <div>
            <h2>Settings</h2>
            <p className="muted">
              Customize the colors of your own labels. Changes are applied
              immediately to Latest Notes and Note History.
            </p>
          </div>

          <button className="ghost-button" onClick={() => setView("reader")}>
            Back to Reader
          </button>
        </div>

        <section className="settings-section">
          <h3>Label Colors</h3>

          <div className="label-color-list">
            {customLabels.map((label) => {
              const currentColor = labelColors[label] || "#64748b";

              return (
                <div className="label-color-row" key={label}>
                  <span
                    className="settings-label-preview"
                    style={{ "--label-color": currentColor }}
                  >
                    {label}
                  </span>

                  <div className="label-color-options">
                    {LABEL_COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={
                          currentColor.toLowerCase() === color.toLowerCase()
                            ? "label-color-dot active"
                            : "label-color-dot"
                        }
                        style={{ backgroundColor: color }}
                        onClick={() => updateLabelColor(label, color)}
                        aria-label={`Set ${label} color`}
                      />
                    ))}

                    <input
                      className="label-custom-color-input"
                      type="color"
                      value={currentColor}
                      onChange={(event) => updateLabelColor(label, event.target.value)}
                      aria-label={`Choose custom color for ${label}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
