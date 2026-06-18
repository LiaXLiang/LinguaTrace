import { useState } from "react";

export default function SettingsPanel({
  customLabels,
  labelColors,
  setLabelColors,
  setView,
  signOut,
}) {
  const [activeLabel, setActiveLabel] = useState(null);

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
          <button
            type="button"
            className="nav-link active"
            onClick={() => setView("settings")}
          >
            Settings
          </button>

         <button className="nav-link" onClick={() => setView("reader")}>
             Reader
         </button>

          <button
            type="button"
            className="nav-link"
            onClick={() => setView("history")}
          >
            Note History
          </button>

          <button
            type="button"
            className="nav-link signout-link"
            onClick={signOut}
          >
            Sign Out
          </button>
        </nav>
      </header>

      <main className="settings-page compact-settings-page">
        <div className="settings-page-header compact-settings-header">
          <h2>Settings</h2>
        </div>

        <section className="settings-card compact-settings-card">
          <div className="settings-title-row">
            <h3>Label Colors</h3>
            <span className="settings-title-hint">
              Click a label to change its color.
            </span>
          </div>


          <div className="settings-label-cloud">
            {customLabels.map((label) => {
              const color = labelColors[label] || "#64748b";

              return (
                <div className="settings-label-wrapper" key={label}>
                  <button
                    type="button"
                    className={
                      activeLabel === label
                        ? "settings-label-pill active"
                        : "settings-label-pill"
                    }
                    style={{ "--label-color": color }}
                    onClick={() => setActiveLabel(label)}
                  >
                    {label}
                  </button>

                  <input
                    className="label-native-color-input"
                    type="color"
                    value={color}
                    onChange={(event) =>
                      updateLabelColor(label, event.target.value)
                    }
                    onClick={() => setActiveLabel(label)}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}