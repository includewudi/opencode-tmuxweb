# iTermPro

## Overview
`iTermPro` is a native iOS terminal application built with SwiftUI. It appears to be a modern, feature-rich terminal client focusing on developer productivity with built-in tools for snippets and AI assistance.

## Directory Structure
*   **`Sources/`**
    *   **`App/`**: Application entry point (`iTermProApp.swift`).
    *   **`Views/`**: SwiftUI views including `MainView` and `ToolboxView`.
    *   **`ViewModels/`**: State management (e.g., `AppViewModel`).
    *   **`Models/`**: Data definitions for the application.
    *   **`Services/`**: Background services and logic.
    *   **`Terminal/`**: Core terminal emulation and handling code.
*   **`Packages/`**: Local Swift package dependencies.
*   **`Assets.xcassets/`**: App icons and image assets.

## Key Features
*   **Terminal Emulation:** dedicated `Terminal` module.
*   **Productivity Toolbox:** A `ToolboxView` providing:
    *   **Quick Keys:** Customizable function keys (Esc, Tab, Arrows, etc.).
    *   **Command Snippets:** Saved common commands for quick execution.
    *   **AI Integration:** A dedicated AI tab (`AICommandView`) for generating or executing commands.
*   **Modern UI:** Built entirely with SwiftUI, using a dark theme (`preferredColorScheme(.dark)`).

## Development
*   **Entry Point:** `iTermProApp.swift` initializes `AppViewModel` and `MainView`.
*   **Architecture:** MVVM (Model-View-ViewModel) pattern.
